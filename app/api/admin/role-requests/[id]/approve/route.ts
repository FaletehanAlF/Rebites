import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, createServiceClient, getAdminActor, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { canDecideRoleRequest, isSuperAdminUserId, resolveSuperAdminId, } from '@/lib/admin-access';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Row = Record<string, unknown>;
const NOTE_MAX = 500;
function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}
export async function POST(req: NextRequest, { params }: {
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
        if (!actor.isSuperAdmin) {
            const configured = resolveSuperAdminId() !== null;
            return NextResponse.json({
                error: configured
                    ? 'Akses ditolak. Hanya Super Admin yang dapat menyetujui permintaan.'
                    : 'Persetujuan belum aktif: SUPER_ADMIN_USER_ID belum dikonfigurasi di server.',
            }, { status: 403 });
        }
        const id = params.id?.trim();
        if (!id) {
            return NextResponse.json({ error: 'ID permintaan wajib.' }, { status: 400 });
        }
        const body = (await req.json().catch(() => null)) as {
            note?: unknown;
        } | null;
        const note = typeof body?.note === 'string' ? body.note.trim() : '';
        if (note.length > NOTE_MAX) {
            return NextResponse.json({ error: `Catatan maksimal ${NOTE_MAX} karakter.` }, { status: 400 });
        }
        const db = createAuthedServerClient(authHeader);
        const { data: existing, error: fetchErr } = await db
            .from('role_change_requests')
            .select('id, status, requested_by, target_user_id, current_role, requested_role')
            .eq('id', id)
            .maybeSingle();
        if (fetchErr) {
            console.error('[admin/role-requests/approve] fetch error', fetchErr.message);
            return NextResponse.json({ error: 'Gagal memuat permintaan.' }, { status: 500 });
        }
        if (!existing) {
            return NextResponse.json({ error: 'Permintaan tidak ditemukan.' }, { status: 404 });
        }
        const row = (existing as unknown) as Row;
        const targetId = asString(row.target_user_id);
        const decision = canDecideRoleRequest(actor, {
            requestedBy: asString(row.requested_by) ?? '',
            status: asString(row.status) ?? '',
            targetIsSuperAdmin: isSuperAdminUserId(targetId),
        });
        if (!decision.allowed) {
            return NextResponse.json({ error: decision.message }, { status: decision.status });
        }
        if (!targetId) {
            return NextResponse.json({ error: 'Pengguna target tidak ditemukan.' }, { status: 404 });
        }
        const { data: targetRow, error: targetErr } = await db
            .from('profiles')
            .select('id, role')
            .eq('id', targetId)
            .maybeSingle();
        if (targetErr) {
            console.error('[admin/role-requests/approve] target error', targetErr.message);
            return NextResponse.json({ error: 'Gagal memuat pengguna target.' }, { status: 500 });
        }
        if (!targetRow) {
            return NextResponse.json({ error: 'Pengguna target tidak ditemukan.' }, { status: 404 });
        }
        const liveRole = asString(((targetRow as unknown) as Row).role);
        if (liveRole === asString(row.requested_role)) {
            return NextResponse.json({
                error: 'Role pengguna target sudah sama dengan role yang diminta. Tolak permintaan ini.',
            }, { status: 409 });
        }
        const service = createServiceClient();
        const { data: result, error: rpcErr } = await service.rpc('decide_role_change_request', {
            p_request_id: id,
            p_actor_id: actor.id,
            p_decision: 'approved',
            p_note: note || null,
        });
        if (rpcErr) {
            console.error('[admin/role-requests/approve] rpc error', rpcErr.message);
            return NextResponse.json({ error: 'Gagal menyetujui permintaan role.' }, { status: 500 });
        }
        const outcome = ((result ?? {}) as unknown) as Row;
        const outcomeCode = asString(outcome.result);
        if (outcomeCode === 'ok') {
            return NextResponse.json({
                request: {
                    id,
                    status: 'approved',
                    old_role: outcome.old_role ?? null,
                    new_role: outcome.new_role ?? null,
                },
            });
        }
        if (outcomeCode === 'already_decided') {
            return NextResponse.json({ error: `Permintaan sudah diputuskan (status: ${asString(outcome.status) ?? 'lain'}).` }, { status: 409 });
        }
        if (outcomeCode === 'requester_cannot_decide') {
            return NextResponse.json({ error: 'Permintaan yang Anda ajukan sendiri tidak dapat Anda putuskan.' }, { status: 403 });
        }
        if (outcomeCode === 'no_change') {
            return NextResponse.json({ error: 'Role pengguna target sudah sama dengan role yang diminta.' }, { status: 409 });
        }
        if (outcomeCode === 'not_found' || outcomeCode === 'target_missing') {
            return NextResponse.json({ error: 'Permintaan atau pengguna target tidak ditemukan.' }, { status: 404 });
        }
        console.error('[admin/role-requests/approve] respons tidak dikenali', JSON.stringify(outcome));
        return NextResponse.json({ error: 'Respons keputusan tidak valid.' }, { status: 500 });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/role-requests/approve] unexpected', err);
        return NextResponse.json({ error: "Gagal memproses permintaan peran." }, { status: 500 });
    }
}
