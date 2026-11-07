import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { canIssueSanction, isSuperAdminUserId } from '@/lib/admin-access';
export const runtime = 'nodejs';
const VALID_LEVELS = [1, 2, 3] as const;
type Row = Record<string, unknown>;
export async function POST(req: NextRequest, { params }: {
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
            level?: unknown;
            category?: unknown;
            reason?: unknown;
        } | null;
        const level = Number(body?.level);
        const category = typeof body?.category === 'string' ? body.category.trim() : '';
        const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
        if (!Number.isInteger(level) || !(VALID_LEVELS as readonly number[]).includes(level)) {
            return NextResponse.json({ error: 'Level harus 1, 2, atau 3.' }, { status: 400 });
        }
        if (!category) {
            return NextResponse.json({ error: 'Kategori wajib diisi.' }, { status: 400 });
        }
        if (!reason) {
            return NextResponse.json({ error: 'Alasan peringatan wajib diisi.' }, { status: 400 });
        }
        if (reason.length > 500) {
            return NextResponse.json({ error: 'Alasan maksimal 500 karakter.' }, { status: 400 });
        }
        const db = createAuthedServerClient(authHeader);
        const { data: product, error: productErr } = await db
            .from('products')
            .select('id, umkm_id, name')
            .eq('id', id)
            .maybeSingle();
        if (productErr) {
            console.error('[admin/products/warn] product fetch error', productErr.message);
            return NextResponse.json({ error: 'Gagal memuat produk.' }, { status: 500 });
        }
        if (!product) {
            return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
        }
        const p = product as unknown as Row;
        const umkmId = typeof p.umkm_id === 'string' ? p.umkm_id : null;
        const productName = typeof p.name === 'string' ? p.name : 'Produk';
        if (!umkmId) {
            return NextResponse.json({ error: 'Produk tidak terikat ke toko.' }, { status: 400 });
        }
        const { data: umkm, error: umkmErr } = await db
            .from('umkm_profiles')
            .select('user_id')
            .eq('id', umkmId)
            .maybeSingle();
        if (umkmErr) {
            console.error('[admin/products/warn] umkm fetch error', umkmErr.message);
            return NextResponse.json({ error: 'Gagal memuat pemilik toko.' }, { status: 500 });
        }
        const ownerId = (umkm as unknown as Row | null)?.user_id as string | undefined;
        if (!ownerId) {
            return NextResponse.json({ error: 'Pemilik toko tidak ditemukan.' }, { status: 404 });
        }
        const { data: ownerRow, error: ownerErr } = await db
            .from('profiles')
            .select('id, role')
            .eq('id', ownerId)
            .maybeSingle();
        if (ownerErr) {
            console.error('[admin/products/warn] owner role error', ownerErr.message);
            return NextResponse.json({ error: 'Gagal memvalidasi pemilik toko.' }, { status: 500 });
        }
        const ownerRole = ((ownerRow ?? {}) as unknown as Record<string, unknown>).role as string | null;
        const decision = canIssueSanction({ id: admin.id, role: 'admin' as const, isSuperAdmin: isSuperAdminUserId(admin.id) }, { id: ownerId, role: ownerRole, isSuperAdmin: isSuperAdminUserId(ownerId) });
        if (!decision.allowed) {
            return NextResponse.json({ error: decision.message }, { status: decision.status });
        }
        const { data: inserted, error: insertErr } = await db
            .from('warnings')
            .insert({
            user_id: ownerId,
            warning_level: level,
            category: `[produk] ${category}`,
            reason: `Produk "${productName}" (${id}): ${reason}`,
            report_id: null,
            issued_by: admin.id,
        })
            .select('id, user_id, warning_level, category, reason, created_at')
            .single();
        if (insertErr) {
            console.error('[admin/products/warn] insert error', insertErr.message);
            return NextResponse.json({ error: 'Gagal menyimpan peringatan.' }, { status: 500 });
        }
        return NextResponse.json({ warning: inserted }, { status: 201 });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/products/warn] unexpected', err);
        return NextResponse.json({ error: "Gagal memproses produk." }, { status: 500 });
    }
}
