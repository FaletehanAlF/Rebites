import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { canManageStoreDeletion, isSuperAdminUserId } from '@/lib/admin-access';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const REASON_MAX = 500;
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
            deleted?: unknown;
            reason?: unknown;
        } | null;
        if (!body || typeof body.deleted !== 'boolean') {
            return NextResponse.json({ error: 'Field deleted wajib bernilai boolean.' }, { status: 400 });
        }
        const shouldDelete = body.deleted;
        const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
        if (shouldDelete && !reason) {
            return NextResponse.json({ error: 'Alasan penghapusan toko wajib diisi.' }, { status: 400 });
        }
        if (reason.length > REASON_MAX) {
            return NextResponse.json({ error: `Alasan maksimal ${REASON_MAX} karakter.` }, { status: 400 });
        }
        const db = createAuthedServerClient(authHeader);
        const { data: target, error: fetchErr } = await db
            .from('umkm_profiles')
            .select('id, user_id, business_name, is_active, deleted_at')
            .eq('id', umkmId)
            .maybeSingle();
        if (fetchErr) {
            console.error('[admin/umkm/deletion] fetch error', fetchErr.message);
            return NextResponse.json({ error: 'Gagal memuat data toko.' }, { status: 500 });
        }
        if (!target) {
            return NextResponse.json({ error: 'Toko tidak ditemukan.' }, { status: 404 });
        }
        const row = (target as unknown) as Row;
        const ownerId = typeof row.user_id === 'string' ? row.user_id : null;
        const decision = canManageStoreDeletion({ id: admin.id, role: 'admin', isSuperAdmin: isSuperAdminUserId(admin.id) }, {
            id: umkmId,
            ownerId: ownerId ?? '',
            ownerIsSuperAdmin: isSuperAdminUserId(ownerId),
        });
        if (!decision.allowed) {
            return NextResponse.json({ error: decision.message, code: decision.code }, { status: decision.status });
        }
        const currentlyDeleted = row.deleted_at !== null && row.deleted_at !== undefined;
        if (currentlyDeleted === shouldDelete) {
            return NextResponse.json({
                id: umkmId,
                deleted_at: (row.deleted_at as string | null) ?? null,
                is_active: row.is_active !== false,
            });
        }
        const nowIso = new Date().toISOString();
        const patch = shouldDelete
            ? {
                deleted_at: nowIso,
                deleted_by: admin.id,
                deletion_reason: reason,
                is_active: false,
                deactivation_reason: reason,
            }
            : {
                deleted_at: null,
                deleted_by: null,
                deletion_reason: null,
                is_active: true,
            };
        let query = db.from('umkm_profiles').update(patch).eq('id', umkmId);
        query = shouldDelete
            ? query.is('deleted_at', null)
            : query.not('deleted_at', 'is', null);
        const { data: updated, error: updErr } = await query
            .select('id, deleted_at, is_active')
            .maybeSingle();
        if (updErr) {
            console.error('[admin/umkm/deletion] update error', updErr.message);
            return NextResponse.json({ error: 'Gagal menyimpan status penghapusan toko.' }, { status: 500 });
        }
        if (!updated) {
            return NextResponse.json({ error: 'Status toko sudah diubah admin lain. Muat ulang data.' }, { status: 409 });
        }
        const updatedRow = (updated as unknown) as Row;
        const { error: auditErr } = await db.from('admin_audit_logs').insert({
            admin_id: admin.id,
            action: shouldDelete ? 'soft_delete_store' : 'restore_store',
            target_type: 'store',
            target_id: umkmId,
            reason: reason || null,
            metadata: {
                auto: true,
                umkm_id: umkmId,
                business_name: row.business_name ?? null,
                deleted_at: shouldDelete ? nowIso : null,
            },
        });
        if (auditErr) {
            console.error('[admin/umkm/deletion] audit error', auditErr.message);
        }
        return NextResponse.json({
            id: umkmId,
            deleted_at: shouldDelete ? nowIso : null,
            is_active: updatedRow.is_active !== false,
            audit_recorded: !auditErr,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/umkm/deletion] unexpected', err);
        return NextResponse.json({ error: 'Gagal memproses penghapusan toko.' }, { status: 500 });
    }
}
