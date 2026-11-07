import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
export const runtime = 'nodejs';
const STATUS_HISTORY_SELECT = [
    'id',
    'order_id',
    'status',
    'note',
    'created_at',
].join(', ');
type Row = Record<string, unknown>;
function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}
export async function GET(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
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
        const orderId = params.id?.trim();
        if (!orderId) {
            return NextResponse.json({ error: 'ID pesanan wajib.' }, { status: 400 });
        }
        const db = createAuthedServerClient(authHeader);
        const { data, error } = await db
            .from('order_status_history')
            .select(STATUS_HISTORY_SELECT)
            .eq('order_id', orderId)
            .order('created_at', { ascending: true });
        if (error) {
            console.error('[admin/orders/:id/status-history] fetch error', error.message);
            return NextResponse.json({ error: 'Gagal memuat riwayat status pesanan.' }, { status: 500 });
        }
        const history = ((data ?? []) as unknown as Row[]).map((row) => ({
            id: asString(row.id) ?? '',
            orderId: asString(row.order_id) ?? '',
            status: asString(row.status) ?? '',
            note: asString(row.note) ?? null,
            createdAt: asString(row.created_at) ?? '',
        }));
        return NextResponse.json({ orderId, history });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/orders/:id/status-history] unexpected', err);
        return NextResponse.json({ error: "Gagal memproses riwayat status pesanan." }, { status: 500 });
    }
}
