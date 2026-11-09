import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Row = Record<string, unknown>;
export async function PATCH(req: NextRequest, { params }: {
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
        const umkmId = params.id?.trim();
        if (!umkmId) {
            return NextResponse.json({ error: 'ID UMKM wajib.' }, { status: 400 });
        }
        const body = (await req.json().catch(() => null)) as {
            requestId?: unknown;
            action?: unknown;
            note?: unknown;
        } | null;
        const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : '';
        const action = typeof body?.action === 'string' ? body.action.trim() : '';
        const note = typeof body?.note === 'string' ? body.note.trim() : '';
        if (!requestId) {
            return NextResponse.json({ error: 'requestId wajib.' }, { status: 400 });
        }
        if (action !== 'approve' && action !== 'reject') {
            return NextResponse.json({ error: "action tidak valid. Gunakan 'approve' atau 'reject'." }, { status: 400 });
        }
        if (action === 'reject' && !note) {
            return NextResponse.json({ error: 'Alasan penolakan wajib diisi agar penjual tahu sebabnya.' }, { status: 400 });
        }
        if (note.length > 1000) {
            return NextResponse.json({ error: 'Catatan maksimal 1000 karakter.' }, { status: 400 });
        }
        const db = createAuthedServerClient(authHeader);
        const { data: requestRow, error: reqErr } = await db
            .from('store_activation_requests')
            .select('id, umkm_id, status')
            .eq('id', requestId)
            .eq('umkm_id', umkmId)
            .maybeSingle();
        if (reqErr) {
            console.error('[admin/umkm/activation] request fetch error', reqErr.message);
            return NextResponse.json({ error: 'Gagal memuat permintaan aktivasi.' }, { status: 500 });
        }
        if (!requestRow) {
            return NextResponse.json({ error: 'Permintaan aktivasi tidak ditemukan.' }, { status: 404 });
        }
        const requestStatus = ((requestRow as unknown) as Row).status;
        if (requestStatus !== 'pending') {
            return NextResponse.json({ error: 'Permintaan ini sudah diputuskan admin lain. Muat ulang data.' }, { status: 409 });
        }
        const decidedAt = new Date().toISOString();
        if (action === 'approve') {
            const { data: umkmRow, error: umkmErr } = await db
                .from('umkm_profiles')
                .select('id, is_active, deleted_at')
                .eq('id', umkmId)
                .maybeSingle();
            if (umkmErr) {
                console.error('[admin/umkm/activation] umkm fetch error', umkmErr.message);
                return NextResponse.json({ error: 'Gagal memuat data toko.' }, { status: 500 });
            }
            if (!umkmRow) {
                return NextResponse.json({ error: 'Toko tidak ditemukan.' }, { status: 404 });
            }
            if (((umkmRow as unknown) as Row).deleted_at != null) {
                return NextResponse.json({
                    error: 'Toko ini sedang dihapus. Pulihkan dulu dari panel pemulihan sebelum mengaktifkannya.',
                }, { status: 409 });
            }
            if (((umkmRow as unknown) as Row).is_active === false) {
                const { error: updErr } = await db
                    .from('umkm_profiles')
                    .update({ is_active: true })
                    .eq('id', umkmId)
                    .eq('is_active', false);
                if (updErr) {
                    console.error('[admin/umkm/activation] activate error', updErr.message);
                    return NextResponse.json({ error: 'Gagal mengaktifkan kembali toko.' }, { status: 500 });
                }
            }
        }
        const { data: updated, error: decisionErr } = await db
            .from('store_activation_requests')
            .update({
            status: action === 'approve' ? 'approved' : 'rejected',
            decision_note: note || null,
            decided_by: admin.id,
            decided_at: decidedAt,
        })
            .eq('id', requestId)
            .eq('status', 'pending')
            .select('id, status, decided_at')
            .maybeSingle();
        if (decisionErr) {
            console.error('[admin/umkm/activation] decision error', decisionErr.message);
            return NextResponse.json({ error: 'Gagal menyimpan keputusan.' }, { status: 500 });
        }
        if (!updated) {
            return NextResponse.json({ error: 'Permintaan ini sudah diputuskan admin lain. Muat ulang data.' }, { status: 409 });
        }
        return NextResponse.json({
            request: updated,
            is_active: action === 'approve' ? true : false,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/umkm/activation] unexpected', err);
        return NextResponse.json({ error: 'Gagal memproses keputusan aktivasi.' }, { status: 500 });
    }
}
