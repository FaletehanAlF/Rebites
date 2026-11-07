import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
export const runtime = 'nodejs';
const ACTIVITY_SELECT = [
    'id',
    'user_id',
    'activity_type',
    'description',
    'target_type',
    'target_id',
    'metadata',
    'created_at',
    'user:profiles(id, full_name, email, role)',
].join(', ');
type ActivityLogRow = Record<string, unknown>;
function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    return value as Record<string, unknown>;
}
function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const admin = await getAdminUser(authHeader);
        if (!admin) {
            const user = await getUserFromBearer(authHeader);
            return NextResponse.json({ error: user ? 'Akses ditolak. Hanya admin.' : 'Unauthorized. Silakan login ulang.' }, { status: user ? 403 : 401 });
        }
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
        }
        const params = req.nextUrl.searchParams;
        const rawLimit = Number(params.get('limit') ?? '20');
        const rawOffset = Number(params.get('offset') ?? '0');
        const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 20;
        const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;
        const db = createAuthedServerClient(authHeader);
        let query = db
            .from('activity_logs')
            .select(ACTIVITY_SELECT, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        const activityType = params.get('activityType');
        const targetType = params.get('targetType');
        const userId = params.get('userId');
        const targetId = params.get('targetId');
        const id = params.get('id');
        const from = params.get('from');
        const to = params.get('to');
        if (activityType)
            query = query.eq('activity_type', activityType);
        if (targetType)
            query = query.eq('target_type', targetType);
        if (userId)
            query = query.eq('user_id', userId);
        if (targetId)
            query = query.eq('target_id', targetId);
        if (id)
            query = query.eq('id', id);
        if (from)
            query = query.gte('created_at', from);
        if (to)
            query = query.lte('created_at', to);
        const { data, error, count } = await query;
        if (error) {
            console.error('[admin/activity-logs] fetch error', error.message);
            return NextResponse.json({ error: 'Gagal memuat log aktivitas.' }, { status: 500 });
        }
        const logs = (data ?? []).map((row) => {
            const r = row as unknown as ActivityLogRow;
            const user = asRecord(r.user);
            return {
                id: asString(r.id) ?? '',
                userId: asString(r.user_id) ?? asString(user?.id),
                userName: asString(user?.full_name) ?? asString(user?.email) ?? 'Tidak diketahui',
                userEmail: asString(user?.email),
                userRole: asString(user?.role),
                activityType: asString(r.activity_type) ?? '',
                description: asString(r.description) ?? '',
                targetType: asString(r.target_type),
                targetId: asString(r.target_id),
                metadata: r.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata)
                    ? (r.metadata as Record<string, unknown>)
                    : {},
                createdAt: asString(r.created_at) ?? '',
            };
        });
        return NextResponse.json({
            logs,
            total: count ?? logs.length,
            limit,
            offset,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/activity-logs] unexpected', err);
        return NextResponse.json({ error: "Gagal memuat log aktivitas." }, { status: 500 });
    }
}
