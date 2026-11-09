import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const LOGS_SELECT = [
    'id',
    'admin_id',
    'action',
    'target_type',
    'target_id',
    'reason',
    'metadata',
    'created_at',
    'admin:profiles!admin_audit_logs_admin_id_fkey(id, full_name, email)',
].join(', ');
type LogRow = Record<string, unknown>;
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
        const action = params.get('action');
        const targetType = params.get('targetType');
        const adminId = params.get('adminId');
        const targetId = params.get('targetId');
        const from = params.get('from');
        const to = params.get('to');
        const db = createAuthedServerClient(authHeader);
        let query = db
            .from('admin_audit_logs')
            .select(LOGS_SELECT, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (action) {
            query = query.eq('action', action);
        }
        if (targetType) {
            query = query.eq('target_type', targetType);
        }
        if (adminId) {
            query = query.eq('admin_id', adminId);
        }
        if (targetId) {
            query = query.eq('target_id', targetId);
        }
        if (from) {
            query = query.gte('created_at', from);
        }
        if (to) {
            query = query.lte('created_at', to);
        }
        const { data, error, count } = await query;
        if (error) {
            console.error('[admin/audit-logs] fetch error', error.message);
            return NextResponse.json({ error: 'Gagal memuat log audit admin.' }, { status: 500 });
        }
        const logs = (data ?? []).map((row) => {
            const r = row as unknown as LogRow;
            const adminRow = asRecord(r.admin);
            return {
                id: asString(r.id) ?? '',
                adminId: asString(r.admin_id) ?? asString(adminRow?.id),
                adminName: asString(adminRow?.full_name) ?? asString(adminRow?.email) ?? 'Tidak diketahui',
                adminEmail: asString(adminRow?.email),
                action: asString(r.action) ?? '',
                targetType: asString(r.target_type) ?? '',
                targetId: asString(r.target_id),
                reason: asString(r.reason),
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
        console.error('[admin/audit-logs] unexpected', err);
        return NextResponse.json({ error: "Gagal memuat audit log." }, { status: 500 });
    }
}
