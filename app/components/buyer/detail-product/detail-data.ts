import { supabase } from '@/lib/supabase';
import { resolveEffectiveUnitPrice } from '@/lib/flash-pricing';
import { resolveImageSrc } from '@/lib/image-path';
import { isMenuScheduleVisible } from '@/lib/menu-schedule';
import type { ProductDetail, RelatedProduct } from './data';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_VENDOR_AVATAR = 'https://images.pexels.com/photos/37193132/pexels-photo-37193132.jpeg?auto=compress&cs=tinysrgb&w=800';
function toPackageInt(value: unknown): number | null {
    if (value == null)
        return null;
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0)
        return null;
    const int = Math.floor(num);
    return int >= 1 ? int : null;
}
function rowToProductDetail(row: Record<string, any>): ProductDetail {
    const umkm = (row.umkm ?? {}) as Record<string, any>;
    const slug: string = row.slug ?? row.id;
    const name: string = row.name ?? 'Produk Surplus';
    const stock: number = row.stock ?? 0;
    const porsiTerselamatkan = Number(umkm.porsi_terselamatkan ?? 0);
    const co2eTotal = Number(umkm.co2e_saved_kg ?? 0);
    const images = [resolveImageSrc(row.image_url)].filter(Boolean) as string[];
    return {
        id: slug,
        slug,
        category: row.category ?? 'Lainnya',
        vendor: {
            id: umkm.slug ?? '',
            name: umkm.business_name ?? '',
            avatar: umkm.logo_url ?? DEFAULT_VENDOR_AVATAR,
            rating: Number(umkm.rating ?? 5),
            isRescuePartner: Boolean(umkm.is_rescue_partner),
        },
        title: name,
        images: images.length > 0 ? images : ['/makanan1.avif'],
        discountPercent: row.discount_percent ?? 0,
        stockLabel: row.stock_label ?? `${stock} porsi tersisa`,
        stockRemaining: stock,
        rating: Number(row.rating ?? 5),
        distanceKm: row.distance_km != null && Number.isFinite(Number(row.distance_km))
            ? Number(row.distance_km)
            : null,
        isDelivery: row.is_delivery ?? true,
        isPickup: row.is_pickup ?? true,
        weightGram: toPackageInt(row.weight_gram),
        lengthCm: toPackageInt(row.length_cm),
        widthCm: toPackageInt(row.width_cm),
        heightCm: toPackageInt(row.height_cm),
        originalPrice: row.original_price ?? 0,
        discountedPrice: resolveEffectiveUnitPrice(row),
        description: row.description?.trim()
            ? row.description
            : `${name} masih segar dan layak dinikmati hari ini, langsung dari ${umkm.business_name ?? 'UMKM pilihan'}.`,
        pickupTime: {
            from: (row.sell_window_start ?? '09:00').slice(0, 5),
            to: (row.sell_window_end ?? '21:00').slice(0, 5),
        },
        storeOpenHours: typeof umkm.open_hours === 'string' && umkm.open_hours.trim() ? umkm.open_hours : null,
        storeIsOpen: umkm.is_open !== false,
        storeIsActive: umkm.is_active !== false,
        pickupLocation: umkm.address ?? '',
        consumeWindow: 'Maks. 3 jam setelah diambil',
        co2eSavedKg: co2eTotal > 0 && porsiTerselamatkan > 0
            ? Math.max(0.4, Math.round((co2eTotal / porsiTerselamatkan) * 10) / 10)
            : 1,
    };
}
export async function fetchProductDetail(id: string): Promise<ProductDetail | undefined> {
    const bySlug = await supabase
        .from('products')
        .select('*, umkm:umkm_profiles(*)')
        .eq('slug', id)
        .maybeSingle();
    if (bySlug.error) {
        console.error('[detail] gagal memuat detail produk:', bySlug.error.message);
        throw new Error('Gagal memuat detail produk.');
    }
    let data = bySlug.data;
    if (!data && UUID_RE.test(id)) {
        const byId = await supabase
            .from('products')
            .select('*, umkm:umkm_profiles(*)')
            .eq('id', id)
            .maybeSingle();
        if (byId.error) {
            console.error('[detail] gagal memuat detail produk:', byId.error.message);
            throw new Error('Gagal memuat detail produk.');
        }
        data = byId.data;
    }
    if (!data)
        return undefined;
    const linkedUmkm = (data as Record<string, any>).umkm;
    if (!linkedUmkm || typeof linkedUmkm !== 'object')
        return undefined;
    if (!isMenuScheduleVisible({
        scheduledStart: (data as Record<string, any>).scheduled_start ?? null,
        scheduledEnd: (data as Record<string, any>).scheduled_end ?? null,
    })) {
        return undefined;
    }
    return rowToProductDetail(data as Record<string, any>);
}
export async function fetchRelatedProducts(category: string, excludeSlug: string): Promise<RelatedProduct[]> {
    if (!category)
        return [];
    try {
        const { data, error } = await supabase
            .from('products')
            .select('slug, name, image_url, original_price, surplus_price, scheduled_start, scheduled_end, umkm:umkm_profiles(business_name)')
            .eq('category', category)
            .neq('slug', excludeSlug)
            .order('rating', { ascending: false })
            .limit(5);
        if (error || !data)
            return [];
        return data
            .filter((row: Record<string, any>) => row.umkm && typeof row.umkm === 'object')
            .filter((row: Record<string, any>) => isMenuScheduleVisible({
            scheduledStart: row.scheduled_start ?? null,
            scheduledEnd: row.scheduled_end ?? null,
        }))
            .map((row: Record<string, any>) => {
            const umkm = row.umkm as Record<string, any>;
            const slug: string = row.slug ?? row.id;
            return {
                id: slug,
                slug,
                vendorName: umkm.business_name ?? 'UMKM ReBites',
                name: row.name ?? '',
                image: resolveImageSrc(row.image_url) || '/makanan1.avif',
                originalPrice: Number(row.original_price ?? 0),
                discountedPrice: Number(row.surplus_price ?? 0),
            };
        });
    }
    catch (error) {
        console.error('[detail] gagal memuat produk terkait:', error);
        return [];
    }
}
