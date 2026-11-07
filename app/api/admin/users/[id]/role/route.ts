import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, createServiceClient, getAdminActor, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { canChangeUserRole, isSuperAdminUserId, resolveSuperAdminId, } from '@/lib/admin-access';
export const runtime = 'nodejs';
type Row = Record<string, unknown>;
const ALLOWED_ROLES = ['buyer', 'umkm', 'admin'] as const;
type AllowedRole = (typeof ALLOWED_ROLES)[number];
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
        const id = params.id?.trim();
        if (!id) {
            return NextResponse.json({ error: 'ID pengguna wajib.' }, { status: 400 });
        }
        const body = (await req.json().catch(() => null)) as {
            role?: unknown;
        } | null;
        const nextRole = typeof body?.role === 'string' ? body.role.trim() : '';
        if (!(ALLOWED_ROLES as readonly string[]).includes(nextRole)) {
            return NextResponse.json({ error: 'Role tidak valid. Nilai yang diizinkan: buyer, umkm, admin.' }, { status: 400 });
        }
        if (!actor.isSuperAdmin) {
            const configured = resolveSuperAdminId() !== null;
            return NextResponse.json({
                error: configured
                    ? 'Akses ditolak. Perubahan peran hanya dapat dilakukan oleh Super Admin.'
                    : 'Perubahan peran belum aktif: SUPER_ADMIN_USER_ID belum dikonfigurasi di server.',
            }, { status: 403 });
        }
        const db = createAuthedServerClient(authHeader);
        const { data: existing, error: fetchErr } = await db
            .from('profiles')
            .select('id, role')
            .eq('id', id)
            .maybeSingle();
        if (fetchErr) {
            console.error('[admin/users/role] fetch error', fetchErr.message);
            return NextResponse.json({ error: 'Gagal memuat pengguna.' }, { status: 500 });
        }
        if (!existing) {
            return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 });
        }
        const currentRole = ((existing as unknown) as Row).role as string | null;
        const decision = canChangeUserRole(actor, { id, role: currentRole, isSuperAdmin: isSuperAdminUserId(id) }, nextRole as AllowedRole);
        if (!decision.allowed) {
            return NextResponse.json({ error: decision.message }, { status: decision.status });
        }
        if (currentRole === nextRole) {
            return NextResponse.json({ error: `Role sudah '${nextRole}'. Tidak ada perubahan.` }, { status: 409 });
        }
        const service = createServiceClient();
        const { data: result, error: rpcErr } = await service.rpc('apply_role_change', {
            p_target_id: id,
            p_new_role: nextRole,
            p_actor_id: actor.id,
        });
        if (rpcErr) {
            const rpcCode = (rpcErr as {
                code?: string;
            }).code ?? '';
            if (rpcCode === 'PGRST202' || rpcCode === '42883' || rpcCode === '42P01') {
                console.error('[admin/users/role] rpc belum tersedia', rpcCode, rpcErr.message);
                return NextResponse.json({
                    error: 'Fitur ubah peran belum diaktifkan di server: migrasi role_request_approval belum dijalankan.',
                    code: 'ROLE_FEATURE_NOT_PROVISIONED',
                }, { status: 503 });
            }
            console.error('[admin/users/role] rpc error', rpcErr.message);
            return NextResponse.json({ error: 'Gagal mengubah role.' }, { status: 500 });
        }
        const outcome = ((result ?? {}) as unknown) as Row;
        const outcomeCode = typeof outcome.result === 'string' ? outcome.result : '';
        if (outcomeCode === 'no_change') {
            return NextResponse.json({ error: `Role sudah '${nextRole}'. Tidak ada perubahan.` }, { status: 409 });
        }
        if (outcomeCode === 'not_found') {
            return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 });
        }
        if (outcomeCode !== 'ok') {
            console.error('[admin/users/role] respons rpc tidak dikenali', JSON.stringify(outcome));
            return NextResponse.json({ error: 'Respons perubahan role tidak valid.' }, { status: 500 });
        }
        return NextResponse.json({
            user: {
                id,
                old_role: outcome.old_role ?? currentRole,
                role: outcome.new_role ?? nextRole,
            },
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/users/role] unexpected', err);
        return NextResponse.json({ error: "Gagal memproses data pengguna." }, { status: 500 });
    }
}
