import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { canManageAccountDeletion, isSuperAdminUserId } from '@/lib/admin-access';
export const runtime = 'nodejs';
const REASON_MAX = 500;
function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}
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
        const id = params.id?.trim();
        if (!id) {
            return NextResponse.json({ error: 'ID pengguna wajib.' }, { status: 400 });
        }
        const body = (await req.json().catch(() => null)) as {
            deleted?: unknown;
            reason?: unknown;
        } | null;
        if (!body || typeof body.deleted !== 'boolean') {
            return NextResponse.json({ error: 'Field deleted wajib bernilai boolean.' }, { status: 400 });
        }
        const shouldDelete = body.deleted;
        const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
        if (shouldDelete && !reason) {
            return NextResponse.json({ error: 'Alasan penghapusan wajib diisi.' }, { status: 400 });
        }
        if (reason.length > REASON_MAX) {
            return NextResponse.json({ error: `Alasan maksimal ${REASON_MAX} karakter.` }, { status: 400 });
        }
        const db = createAuthedServerClient(authHeader);
        const { data: target, error: fetchErr } = await db
            .from('profiles')
            .select('id, role, deleted_at')
            .eq('id', id)
            .maybeSingle();
        if (fetchErr) {
            console.error('[admin/users/deletion] fetch error', fetchErr.message);
            return NextResponse.json({ error: 'Gagal memuat data pengguna.' }, { status: 500 });
        }
        if (!target) {
            return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 });
        }
        const row = (target as unknown) as Row;
        const decision = canManageAccountDeletion({ id: admin.id, role: 'admin', isSuperAdmin: isSuperAdminUserId(admin.id) }, {
            id,
            role: typeof row.role === 'string' ? row.role : null,
            isSuperAdmin: isSuperAdminUserId(id),
        });
        if (!decision.allowed) {
            return NextResponse.json({ error: decision.message, code: decision.code }, { status: decision.status });
        }
        const currentlyDeleted = row.deleted_at !== null && row.deleted_at !== undefined;
        if (currentlyDeleted === shouldDelete) {
            return NextResponse.json({
                id,
                deleted_at: (row.deleted_at as string | null) ?? null,
            });
        }
        const nowIso = new Date().toISOString();
        const patch = shouldDelete
            ? { deleted_at: nowIso, deleted_by: admin.id, deletion_reason: reason }
            : { deleted_at: null, deleted_by: null, deletion_reason: null };
        let query = db.from('profiles').update(patch).eq('id', id);
        query = shouldDelete
            ? query.is('deleted_at', null)
            : query.not('deleted_at', 'is', null);
        const { data: updated, error: updErr } = await query
            .select('id, deleted_at')
            .maybeSingle();
        if (updErr) {
            console.error('[admin/users/deletion] update error', updErr.message);
            return NextResponse.json({ error: 'Gagal menyimpan status penghapusan.' }, { status: 500 });
        }
        if (!updated) {
            return NextResponse.json({ error: 'Status pengguna sudah diubah admin lain. Muat ulang data.' }, { status: 409 });
        }
        let storeDeactivated = false;
        if (shouldDelete) {
            const { data: storeRow, error: storeErr } = await db
                .from('umkm_profiles')
                .select('id, is_active')
                .eq('user_id', id)
                .maybeSingle();
            if (storeErr) {
                console.error('[admin/users/deletion] store fetch error', storeErr.message);
            }
            else {
                const storeId = storeRow ? asString(((storeRow as unknown) as Row).id) : null;
                const storeActive = storeRow
                    ? ((storeRow as unknown) as Row).is_active !== false
                    : false;
                if (storeId && storeActive) {
                    const { error: deactErr } = await db
                        .from('umkm_profiles')
                        .update({
                        is_active: false,
                        deactivation_reason: 'Akun pemilik dihapus oleh admin.',
                    })
                        .eq('id', storeId)
                        .eq('is_active', true);
                    if (deactErr) {
                        console.error('[admin/users/deletion] deactivate store error', deactErr.message);
                    }
                    else {
                        storeDeactivated = true;
                    }
                }
            }
        }
        const { error: auditErr } = await db.from('admin_audit_logs').insert({
            admin_id: admin.id,
            action: shouldDelete ? 'soft_delete_user' : 'restore_user',
            target_type: 'user',
            target_id: id,
            reason: reason || null,
            metadata: {
                auto: true,
                deleted_at: shouldDelete ? nowIso : null,
                store_deactivated: storeDeactivated,
            },
        });
        if (auditErr) {
            console.error('[admin/users/deletion] audit error', auditErr.message);
        }
        return NextResponse.json({
            id,
            deleted_at: shouldDelete ? nowIso : null,
            store_deactivated: storeDeactivated,
            audit_recorded: !auditErr,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/users/deletion] unexpected', err);
        return NextResponse.json({ error: 'Gagal memproses penghapusan pengguna.' }, { status: 500 });
    }
}
