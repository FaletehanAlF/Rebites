import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
export const runtime = 'nodejs';
const PRODUCT_SELECT = [
    'id',
    'umkm_id',
    'slug',
    'name',
    'description',
    'image_url',
    'category',
    'original_price',
    'surplus_price',
    'discount_percent',
    'stock',
    'status',
    'verification_status',
    'rejection_reason',
    'reviewed_at',
    'reviewed_by',
    'sell_window_start',
    'sell_window_end',
    'all_day',
    'is_surplus_today',
    'featured',
    'is_delivery',
    'is_pickup',
    'weight_gram',
    'length_cm',
    'width_cm',
    'height_cm',
    'rating',
    'created_at',
    'deleted_at',
    'deleted_by',
    'deletion_reason',
].join(', ');
type Row = Record<string, unknown>;
function asRecord(value: unknown): Row | null {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    return value as Row;
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
        const id = params.id?.trim();
        if (!id) {
            return NextResponse.json({ error: 'ID produk wajib.' }, { status: 400 });
        }
        const db = createAuthedServerClient(authHeader);
        const { data: product, error: productErr } = await db
            .from('products')
            .select(PRODUCT_SELECT)
            .eq('id', id)
            .maybeSingle();
        if (productErr) {
            console.error('[admin/products/detail] fetch error', productErr.message);
            return NextResponse.json({ error: 'Gagal memuat detail produk.' }, { status: 500 });
        }
        if (!product) {
            return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
        }
        const p = product as unknown as Row;
        const umkmId = typeof p.umkm_id === 'string' ? p.umkm_id : null;
        const [umkmRes, moderationRes, activityRes] = await Promise.all([
            umkmId
                ? db
                    .from('umkm_profiles')
                    .select('id, user_id, business_name, slug, city, is_verified, logo_url, created_at')
                    .eq('id', umkmId)
                    .maybeSingle()
                : Promise.resolve({ data: null, error: null }),
            db
                .from('moderation_logs')
                .select('id, action, reason, created_at, moderator:profiles!moderation_logs_moderator_id_fkey(id, full_name, email)')
                .eq('product_id', id)
                .order('created_at', { ascending: false })
                .limit(20),
            db
                .from('activity_logs')
                .select('id, user_id, activity_type, description, metadata, created_at')
                .eq('target_type', 'product')
                .eq('target_id', id)
                .order('created_at', { ascending: false })
                .limit(20),
        ]);
        if (umkmRes.error)
            console.error('[admin/products/detail] umkm error', umkmRes.error.message);
        if (moderationRes.error)
            console.error('[admin/products/detail] moderation error', moderationRes.error.message);
        if (activityRes.error)
            console.error('[admin/products/detail] activity error', activityRes.error.message);
        const umkm = umkmRes.data ? ((umkmRes.data as unknown) as Row) : null;
        const moderation = ((moderationRes.data ?? []) as unknown as Row[]).map((m) => {
            const mod = asRecord(m.moderator);
            return {
                id: m.id ?? null,
                action: m.action ?? null,
                reason: (m.reason as string | null) ?? null,
                created_at: m.created_at ?? null,
                moderator_name: (mod?.full_name as string | null) ?? (mod?.email as string | null) ?? 'Tidak diketahui',
            };
        });
        const activity = ((activityRes.data ?? []) as unknown as Row[]).map((a) => ({
            id: a.id ?? null,
            activity_type: a.activity_type ?? null,
            description: a.description ?? null,
            metadata: (a.metadata as Record<string, unknown> | null) ?? {},
            created_at: a.created_at ?? null,
        }));
        return NextResponse.json({
            product: {
                id: p.id ?? null,
                umkm_id: p.umkm_id ?? null,
                slug: p.slug ?? null,
                name: p.name ?? 'Tidak diketahui',
                description: (p.description as string | null) ?? null,
                image_url: (p.image_url as string | null) ?? null,
                category: (p.category as string | null) ?? null,
                original_price: (p.original_price as number | null) ?? null,
                surplus_price: (p.surplus_price as number | null) ?? null,
                discount_percent: (p.discount_percent as number | null) ?? null,
                stock: (p.stock as number | null) ?? null,
                status: (p.status as string | null) ?? null,
                verification_status: (p.verification_status as string | null) ?? null,
                rejection_reason: (p.rejection_reason as string | null) ?? null,
                reviewed_at: (p.reviewed_at as string | null) ?? null,
                reviewed_by: (p.reviewed_by as string | null) ?? null,
                weight_gram: (p.weight_gram as number | null) ?? null,
                length_cm: (p.length_cm as number | null) ?? null,
                width_cm: (p.width_cm as number | null) ?? null,
                height_cm: (p.height_cm as number | null) ?? null,
                is_delivery: (p.is_delivery as boolean | null) ?? null,
                is_pickup: (p.is_pickup as boolean | null) ?? null,
                rating: p.rating != null ? Number(p.rating) : null,
                created_at: (p.created_at as string | null) ?? null,
                deleted_at: (p.deleted_at as string | null) ?? null,
                deleted_by: (p.deleted_by as string | null) ?? null,
                deletion_reason: (p.deletion_reason as string | null) ?? null,
            },
            umkm: umkm
                ? {
                    id: umkm.id ?? null,
                    user_id: umkm.user_id ?? null,
                    business_name: umkm.business_name ?? 'Tidak diketahui',
                    slug: umkm.slug ?? null,
                    city: umkm.city ?? null,
                    is_verified: umkm.is_verified ?? false,
                    logo_url: umkm.logo_url ?? null,
                    created_at: umkm.created_at ?? null,
                }
                : null,
            moderation,
            activity,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/products/detail] unexpected', err);
        return NextResponse.json({ error: "Gagal memproses produk." }, { status: 500 });
    }
}
