import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, queryFailureResponse, upstreamUnavailableResponse, } from '@/lib/server/supabase';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const RANGE_ALLOWLIST = [7, 14, 30, 90] as const;
type Row = Record<string, unknown>;
function asCount(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed))
        return 0;
    return Math.max(0, Math.trunc(parsed));
}
function asDaily(value: unknown): {
    day: string;
    visitors: number;
    visits: number;
}[] {
    if (!Array.isArray(value))
        return [];
    return value
        .map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry))
            return null;
        const row = entry as Row;
        const day = typeof row.day === 'string' ? row.day : null;
        if (!day)
            return null;
        return { day, visitors: asCount(row.visitors), visits: asCount(row.visits) };
    })
        .filter((entry): entry is {
        day: string;
        visitors: number;
        visits: number;
    } => entry !== null);
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
        const rawRange = Number(req.nextUrl.searchParams.get('range') ?? '14');
        const rangeDays = (RANGE_ALLOWLIST as readonly number[]).includes(rawRange) ? rawRange : 14;
        const db = createAuthedServerClient(authHeader);
        const { data, error } = await db.rpc('get_visitor_stats', { p_days: rangeDays });
        if (error) {
            if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01') {
                return NextResponse.json({ not_provisioned: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
            }
            console.error('[admin/visitors] rpc error', error.message);
            return queryFailureResponse(error, 'Gagal memuat data pengunjung.');
        }
        const row = (data ?? {}) as Row;
        return NextResponse.json({
            totalVisitors: asCount(row.total_visitors),
            totalVisits: asCount(row.total_visits),
            anonymousVisitors: asCount(row.anonymous_visitors),
            registeredVisitors: asCount(row.registered_visitors),
            today: asCount(row.today),
            yesterday: asCount(row.yesterday),
            rangeDays: asCount(row.range_days) || rangeDays,
            rangeVisitors: asCount(row.range_visitors),
            daily: asDaily(row.daily),
        }, { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/visitors] unexpected', err);
        return NextResponse.json({ error: 'Gagal memuat data pengunjung.' }, { status: 500 });
    }
}
