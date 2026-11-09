import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { canManageProductDeletion, isSuperAdminUserId } from '@/lib/admin-access';
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
        const id = params.id?.trim();
        if (!id) {
            return NextResponse.json({ error: 'ID produk wajib.' }, { status: 400 });
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
            return NextResponse.json({ error: 'Alasan penghapusan produk wajib diisi.' }, { status: 400 });
        }
        if (reason.length > REASON_MAX) {
            return NextResponse.json({ error: `Alasan maksimal ${REASON_MAX} karakter.` }, { status: 400 });
        }
        const decision = canManageProductDeletion({
            id: admin.id,
            role: 'admin',
            isSuperAdmin: isSuperAdminUserId(admin.id),
        });
        if (!decision.allowed) {
            return NextResponse.json({ error: decision.message, code: decision.code }, { status: decision.status });
        }
        const db = createAuthedServerClient(authHeader);
        const { data: target, error: fetchErr } = await db
            .from('products')
            .select('id, name, deleted_at, deleted_by')
            .eq('id', id)
            .maybeSingle();
        if (fetchErr) {
            console.error('[admin/products/deletion] fetch error', fetchErr.message);
            return NextResponse.json({ error: 'Gagal memuat data produk.' }, { status: 500 });
        }
        if (!target) {
            return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
        }
        const row = (target as unknown) as Row;
        const currentlyDeleted = row.deleted_at !== null && row.deleted_at !== undefined;
        if (currentlyDeleted === shouldDelete) {
            return NextResponse.json({
                id,
                deleted_at: (row.deleted_at as string | null) ?? null,
            });
        }
        const wasDeletedBySeller = row.deleted_by === null || row.deleted_by === undefined;
        if (!shouldDelete && wasDeletedBySeller) {
            return NextResponse.json({ error: 'Produk ini ditarik oleh penjual, bukan oleh admin.' }, { status: 409 });
        }
        const nowIso = new Date().toISOString();
        const patch = shouldDelete
            ? { deleted_at: nowIso, deleted_by: admin.id, deletion_reason: reason }
            : { deleted_at: null, deleted_by: null, deletion_reason: null };
        let query = db.from('products').update(patch).eq('id', id);
        query = shouldDelete
            ? query.is('deleted_at', null)
            : query.not('deleted_at', 'is', null);
        const { data: updated, error: updErr } = await query
            .select('id, deleted_at')
            .maybeSingle();
        if (updErr) {
            console.error('[admin/products/deletion] update error', updErr.message);
            return NextResponse.json({ error: 'Gagal menyimpan status penghapusan produk.' }, { status: 500 });
        }
        if (!updated) {
            return NextResponse.json({ error: 'Status produk sudah diubah admin lain. Muat ulang data.' }, { status: 409 });
        }
        const { error: auditErr } = await db.from('admin_audit_logs').insert({
            admin_id: admin.id,
            action: shouldDelete ? 'soft_delete_product' : 'restore_product',
            target_type: 'product',
            target_id: id,
            reason: reason || null,
            metadata: {
                auto: true,
                product_name: row.name ?? null,
                deleted_at: shouldDelete ? nowIso : null,
            },
        });
        if (auditErr) {
            console.error('[admin/products/deletion] audit error', auditErr.message);
        }
        return NextResponse.json({
            id,
            deleted_at: shouldDelete ? nowIso : null,
            audit_recorded: !auditErr,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/products/deletion] unexpected', err);
        return NextResponse.json({ error: 'Gagal memproses penghapusan produk.' }, { status: 500 });
    }
}
