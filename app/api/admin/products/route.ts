import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { sanitizeSearchTermKeepingWords } from '@/lib/filter-search';
export const runtime = 'nodejs';
const PRODUCT_SELECT = [
    'id',
    'umkm_id',
    'slug',
    'name',
    'category',
    'image_url',
    'original_price',
    'surplus_price',
    'stock',
    'status',
    'verification_status',
    'rejection_reason',
    'reviewed_at',
    'created_at',
    'deleted_at',
    'deleted_by',
    'deletion_reason',
    'umkm:umkm_profiles(id, business_name, city, is_verified)',
].join(', ');
const VERIFICATION_STATUSES = ['pending', 'approved', 'rejected'] as const;
const OPERATIONAL_STATUSES = ['available', 'sold_out', 'hidden'] as const;
type Row = Record<string, unknown>;
function asRecord(value: unknown): Row | null {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    return value as Row;
}
function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}
function asNumber(value: unknown): number | null {
    if (value == null)
        return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}
export async function GET(req: NextRequest) {
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
        const params = req.nextUrl.searchParams;
        const rawLimit = Number(params.get('limit') ?? '20');
        const rawOffset = Number(params.get('offset') ?? '0');
        const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 20;
        const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;
        const verificationStatus = (params.get('verificationStatus') ?? '').trim();
        const status = (params.get('status') ?? '').trim();
        const umkmId = (params.get('umkmId') ?? '').trim();
        const q = (params.get('q') ?? '').trim();
        const db = createAuthedServerClient(authHeader);
        let query = db
            .from('products')
            .select(PRODUCT_SELECT, { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (verificationStatus) {
            if (!VERIFICATION_STATUSES.includes(verificationStatus as (typeof VERIFICATION_STATUSES)[number])) {
                return NextResponse.json({ error: 'Filter status verifikasi tidak dikenal.' }, { status: 400 });
            }
            query = query.eq('verification_status', verificationStatus);
        }
        if (status) {
            if (!OPERATIONAL_STATUSES.includes(status as (typeof OPERATIONAL_STATUSES)[number])) {
                return NextResponse.json({ error: 'Filter status operasional tidak dikenal.' }, { status: 400 });
            }
            query = query.eq('status', status);
        }
        if (umkmId)
            query = query.eq('umkm_id', umkmId);
        if (q) {
            const escaped = sanitizeSearchTermKeepingWords(q);
            if (escaped) {
                query = query.or(`name.ilike.%${escaped}%,category.ilike.%${escaped}%`);
            }
        }
        const { data, error, count } = await query;
        if (error) {
            console.error('[admin/products] fetch error', error.message);
            return NextResponse.json({ error: 'Gagal memuat daftar produk.' }, { status: 500 });
        }
        const products = ((data ?? []) as unknown as Row[]).map((p) => {
            const umkm = asRecord(p.umkm);
            return {
                id: asString(p.id) ?? '',
                umkmId: asString(p.umkm_id),
                slug: asString(p.slug),
                name: asString(p.name) ?? '(tanpa nama)',
                category: asString(p.category),
                imageUrl: asString(p.image_url),
                originalPrice: asNumber(p.original_price),
                surplusPrice: asNumber(p.surplus_price),
                stock: asNumber(p.stock),
                status: asString(p.status),
                verificationStatus: asString(p.verification_status),
                rejectionReason: asString(p.rejection_reason),
                reviewedAt: asString(p.reviewed_at),
                createdAt: asString(p.created_at) ?? '',
                deletedAt: asString(p.deleted_at),
                deletedBy: asString(p.deleted_by),
                store: umkm
                    ? {
                        id: asString(umkm.id),
                        businessName: asString(umkm.business_name) ?? 'Toko tanpa nama',
                        city: asString(umkm.city),
                        isVerified: umkm.is_verified === true,
                    }
                    : null,
            };
        });
        return NextResponse.json({
            products,
            total: count ?? products.length,
            limit,
            offset,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/products] unexpected', err);
        return NextResponse.json({ error: "Gagal memproses produk." }, { status: 500 });
    }
}
