import { supabase } from '@/lib/supabase';
import type { ProductDetail, RelatedProduct } from './data';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_VENDOR_AVATAR =
  'https://images.pexels.com/photos/37193132/pexels-photo-37193132.jpeg?auto=compress&cs=tinysrgb&w=800';

function rowToProductDetail(row: Record<string, any>): ProductDetail {
  const umkm = (row.umkm ?? {}) as Record<string, any>;
  const slug: string = row.slug ?? row.id;
  const name: string = row.name ?? 'Produk Surplus';
  const stock: number = row.stock ?? 0;
  const soldCount = Number(row.sold_count ?? 0);
  const porsiTerselamatkan = Number(umkm.porsi_terselamatkan ?? 0);
  const co2eTotal = Number(umkm.co2e_saved_kg ?? 0);
  const images = [row.image_url].filter(Boolean) as string[];

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
    images: images.length > 0 ? images : ['/makanan1.jpeg'],
    discountPercent: row.discount_percent ?? 0,
    stockLabel: row.stock_label ?? `${stock} porsi tersisa`,
    stockRemaining: stock,
    rating: Number(row.rating ?? 5),
    reviewCount: soldCount > 0 ? soldCount : 32,
    distanceKm: Number(row.distance_km ?? 1),
    originalPrice: row.original_price ?? 0,
    discountedPrice: row.surplus_price ?? 0,
    description: row.description?.trim()
      ? row.description
      : `${name} masih segar dan layak dinikmati hari ini, langsung dari ${
          umkm.business_name ?? 'UMKM pilihan'
        }.`,
    pickupTime: {
      from: (row.sell_window_start ?? '09:00').slice(0, 5),
      to: (row.sell_window_end ?? '21:00').slice(0, 5),
    },
    pickupLocation: umkm.address ?? '',
    consumeWindow: 'Maks. 3 jam setelah diambil',
    co2eSavedKg:
      co2eTotal > 0 && porsiTerselamatkan > 0
        ? Math.max(0.4, Math.round((co2eTotal / porsiTerselamatkan) * 10) / 10)
        : 1,
    packageContents: [name, 'Box + sendok'],
  };
}

export async function fetchProductDetail(
  id: string
): Promise<ProductDetail | undefined> {
  try {
    let { data } = await supabase
      .from('products')
      .select('*, umkm:umkm_profiles(*)')
      .eq('slug', id)
      .maybeSingle();

    if (!data && UUID_RE.test(id)) {
      ({ data } = await supabase
        .from('products')
        .select('*, umkm:umkm_profiles(*)')
        .eq('id', id)
        .maybeSingle());
    }

    if (!data) return undefined;
    return rowToProductDetail(data as Record<string, any>);
  } catch (error) {
    console.error('[detail] gagal memuat detail produk:', error);
    return undefined;
  }
}

export async function fetchRelatedProducts(
  category: string,
  excludeSlug: string
): Promise<RelatedProduct[]> {
  if (!category) return [];
  try {
    const { data, error } = await supabase
      .from('products')
      .select(
        'slug, name, image_url, original_price, surplus_price, umkm:umkm_profiles(business_name)'
      )
      .eq('category', category)
      .neq('slug', excludeSlug)
      .order('rating', { ascending: false })
      .limit(5);
    if (error || !data) return [];
    return data.map((row: Record<string, any>) => {
      const umkm = (row.umkm ?? {}) as Record<string, any>;
      const slug: string = row.slug ?? row.id;
      return {
        id: slug,
        slug,
        vendorName: umkm.business_name ?? 'UMKM ReBites',
        name: row.name ?? '',
        image:
          row.image_url && row.image_url.length > 0
            ? row.image_url
            : '/makanan1.jpeg',
        originalPrice: Number(row.original_price ?? 0),
        discountedPrice: Number(row.surplus_price ?? 0),
      };
    });
  } catch (error) {
    console.error('[detail] gagal memuat produk terkait:', error);
    return [];
  }
}
