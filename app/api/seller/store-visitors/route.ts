import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getUserFromBearer, } from '@/lib/server/supabase';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const RANGE_OPTIONS = [7, 14, 30, 90] as const;
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
        const row = entry as Record<string, unknown>;
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
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
        return NextResponse.json({ error: 'Sesi berakhir. Silakan masuk kembali.' }, { status: 401 });
    }
    let userId: string | null = null;
    try {
        const user = await getUserFromBearer(authHeader);
        userId = user?.id ?? null;
    }
    catch {
        userId = null;
    }
    if (!userId) {
        return NextResponse.json({ error: 'Sesi berakhir. Silakan masuk kembali.' }, { status: 401 });
    }
    const rangeParam = Number(req.nextUrl.searchParams.get('range') ?? 14);
    const rangeDays = (RANGE_OPTIONS as readonly number[]).includes(rangeParam) ? rangeParam : 14;
    try {
        const service = createServiceClient(10000);
        const { data: store, error: storeError } = await service
            .from('umkm_profiles')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();
        if (storeError || !store?.id) {
            return NextResponse.json({ error: 'Toko tidak ditemukan.' }, { status: 404 });
        }
        const { data, error } = await service.rpc('get_store_visitor_stats', {
            p_store_id: store.id,
            p_days: rangeDays,
        });
        if (error || !data) {
            const message = error?.message ?? '';
            if (message.toLowerCase().includes('not provisioned') || message.includes('function') && message.toLowerCase().includes('does not exist')) {
                return NextResponse.json({ notProvisioned: true, rangeDays }, { status: 200 });
            }
            if (message.includes('42501') || message.toLowerCase().includes('akses ditolak')) {
                return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
            }
            console.warn('[seller/store-visitors] rpc error', message);
            return NextResponse.json({ error: 'Gagal memuat pengunjung toko.' }, { status: 500 });
        }
        const row = data as Record<string, unknown>;
        if (row.not_provisioned === true) {
            return NextResponse.json({ notProvisioned: true, rangeDays }, { status: 200 });
        }
        return NextResponse.json({
            totalVisitors: asCount(row.total_visitors),
            totalVisits: asCount(row.total_visits),
            today: asCount(row.today),
            yesterday: asCount(row.yesterday),
            rangeDays: asCount(row.range_days) || rangeDays,
            rangeVisitors: asCount(row.range_visitors),
            daily: asDaily(row.daily),
        });
    }
    catch (err) {
        console.warn('[seller/store-visitors] unexpected', err instanceof Error ? err.message : err);
        return NextResponse.json({ error: 'Gagal memuat pengunjung toko.' }, { status: 500 });
    }
}
