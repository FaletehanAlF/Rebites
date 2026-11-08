import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, createServiceClient, getAdminActor, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { isSuperAdminUserId } from '@/lib/admin-access';
import { syncAccountBan } from '@/lib/server/account-ban';
export const runtime = 'nodejs';
const BAN_SYNC_TIMEOUT_MS = 10000;
export async function PATCH(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
    try {
        const authHeader = req.headers.get('authorization');
        const actor = await getAdminActor(authHeader);
        if (!actor) {
            const user = await getUserFromBearer(authHeader);
            return NextResponse.json({ error: user ? 'Akses ditolak. Hanya admin.' : 'Unauthorized. Silakan login ulang.' }, { status: user ? 403 : 401 });
        }
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
        }
        const sanctionId = params.id?.trim();
        if (!sanctionId) {
            return NextResponse.json({ error: 'ID sanksi wajib.' }, { status: 400 });
        }
        const body = (await req.json().catch(() => null)) as {
            action?: unknown;
        } | null;
        const action = typeof body?.action === 'string' ? body.action.trim() : '';
        if (action !== 'revoke') {
            return NextResponse.json({ error: "Aksi tidak valid. Gunakan 'revoke' untuk mencabut sanksi." }, { status: 400 });
        }
        const db = createAuthedServerClient(authHeader);
        const { data: sanction, error: fetchErr } = await db
            .from('sanctions')
            .select('id, user_id, sanction_type, start_at, end_at, issued_by')
            .eq('id', sanctionId)
            .maybeSingle();
        if (fetchErr) {
            console.error('[admin/sanctions/:id] fetch error', fetchErr.message);
            return NextResponse.json({ error: 'Gagal memuat sanksi.' }, { status: 500 });
        }
        if (!sanction) {
            return NextResponse.json({ error: 'Sanksi tidak ditemukan.' }, { status: 404 });
        }
        const s = sanction as unknown as Record<string, unknown>;
        const targetUserId = typeof s.user_id === 'string' ? s.user_id : '';
        const sanctionType = typeof s.sanction_type === 'string' ? s.sanction_type : '';
        const issuedBy = typeof s.issued_by === 'string' ? s.issued_by : '';
        const currentEndAt = typeof s.end_at === 'string' ? s.end_at : null;
        const startAtMs = typeof s.start_at === 'string' ? new Date(s.start_at).getTime() : NaN;
        if (currentEndAt !== null) {
            const endMs = new Date(currentEndAt).getTime();
            if (Number.isFinite(endMs) && endMs <= Date.now()) {
                return NextResponse.json({ error: 'Sanksi sudah berakhir; tidak ada yang perlu dicabut.' }, { status: 409 });
            }
        }
        if (!targetUserId) {
            return NextResponse.json({ error: 'Sanksi tidak terikat ke pengguna.' }, { status: 400 });
        }
        const { data: targetRow, error: targetErr } = await db
            .from('profiles')
            .select('id, role, account_status')
            .eq('id', targetUserId)
            .maybeSingle();
        if (targetErr) {
            console.error('[admin/sanctions/:id] target check', targetErr.message);
            return NextResponse.json({ error: 'Gagal memvalidasi pengguna target.' }, { status: 500 });
        }
        if (!targetRow) {
            return NextResponse.json({ error: 'Pengguna target tidak ditemukan.' }, { status: 404 });
        }
        const target = targetRow as unknown as Record<string, unknown>;
        const targetRole = typeof target.role === 'string' ? target.role : null;
        const actorIsSuperAdmin = actor.isSuperAdmin === true;
        if (isSuperAdminUserId(targetUserId)) {
            return NextResponse.json({ error: 'Akun Super Admin dilindungi dan tidak dapat dicabut sanksinya lewat jalur ini.' }, { status: 403 });
        }
        if (!actorIsSuperAdmin) {
            if (targetRole === 'admin' && issuedBy !== actor.id) {
                return NextResponse.json({ error: 'Admin tim tidak dapat mencabut sanksi pada akun admin lain.' }, { status: 403 });
            }
            if (issuedBy !== actor.id && targetRole !== 'buyer' && targetRole !== 'umkm') {
                return NextResponse.json({ error: 'Admin tim hanya dapat mencabut sanksi yang sendiri terbitkan.' }, { status: 403 });
            }
        }
        const safeEndMs = Math.max(Date.now(), Number.isFinite(startAtMs) ? startAtMs + 1 : 0);
        const endedAtIso = new Date(safeEndMs).toISOString();
        const { error: updErr } = await db
            .from('sanctions')
            .update({ end_at: endedAtIso })
            .eq('id', sanctionId);
        if (updErr) {
            console.error('[admin/sanctions/:id] update error', updErr.message);
            return NextResponse.json({ error: 'Gagal mengakhiri sanksi.' }, { status: 500 });
        }
        if (sanctionType === 'suspend' || sanctionType === 'ban') {
            const { error: statusErr } = await db.rpc('restore_account_status_if_clear', {
                p_user: targetUserId,
            });
            if (statusErr) {
                console.error('[admin/sanctions/:id] restore status error', statusErr.message);
                return NextResponse.json({ error: 'Sanksi diakhiri, tetapi gagal memulihkan status akun.' }, { status: 500 });
            }
        }
        let banSynced = false;
        if (sanctionType === 'suspend' || sanctionType === 'ban') {
            const ban = await syncAccountBan(createServiceClient(BAN_SYNC_TIMEOUT_MS), targetUserId);
            banSynced = ban.synced;
        }
        return NextResponse.json({
            sanction: { id: sanctionId, action: 'revoked', endedAt: endedAtIso },
            ban_synced: banSynced,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/sanctions/:id] unexpected', err);
        return NextResponse.json({ error: "Gagal memproses pencabutan sanksi." }, { status: 500 });
    }
}
