'use client';

import { supabase } from './supabase';

export const SELLER_VENDOR_SLUG = 'dapur-ibu-tini';
export const SELLER_VENDOR_NAME = 'Dapur Ibu Tini';

export const PRODUCTS_UPDATED_EVENT = 'rebites-seller-products-updated';

export interface SellerProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  image: string;
  originalPrice: number;
  surplusPrice: number;
  discountPercent: number;
  stock: number;
  startTime: string;
  endTime: string;
  allDay?: boolean;
  isSurplusToday: boolean;
  featured?: boolean;
  flashSale?: {
    price: number;
    startIso: string;
    endIso: string;
  } | null;
  createdAt: string;
  // 7B-2A: data shipping (products.weight_gram/length_cm/width_cm/height_cm).
  // NULL = belum diketahui (produk legacy). Tanpa default/fallback.
  weightGram?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  // Rating produk dari database (products.rating, NOT NULL DEFAULT 5.0).
  // Null berarti belum ada rating tercatat — UI wajib menyembunyikan,
  // bukan mengarang angka. Opsional karena produk baru memakai default DB.
  rating?: number | null;
  // Status verifikasi admin (read-only dari sisi seller; ditulis DB/trigger).
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  // 7B-2B: kapabilitas fulfillment (products.is_delivery/is_pickup NOT NULL).
  // Boolean wajib (bukan opsional): DB selalu punya nilai; legacy -> default true.
  isDelivery: boolean;
  isPickup: boolean;
}

export interface SellerUmkm {
  id: string;
  slug: string | null;
  businessName: string;
}

type ProductRow = Record<string, any>;

function dispatchUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PRODUCTS_UPDATED_EVENT));
}

function rowToSellerProduct(row: ProductRow): SellerProduct {
  return {
    id: row.slug ?? row.id,
    name: row.name ?? '',
    category: row.category ?? 'Lainnya',
    description: row.description ?? '',
    image: row.image_url ?? '/foods/ikansayur.jpg',
    originalPrice: row.original_price ?? 0,
    surplusPrice: row.surplus_price ?? 0,
    discountPercent: row.discount_percent ?? 0,
    stock: row.stock ?? 0,
    startTime: (row.sell_window_start ?? '09:00').slice(0, 5),
    endTime: (row.sell_window_end ?? '21:00').slice(0, 5),
    allDay: row.all_day ?? false,
    isSurplusToday: row.is_surplus_today ?? true,
    featured: row.featured ?? false,
    flashSale:
      row.flash_sale_price != null
        ? {
            price: Number(row.flash_sale_price),
            startIso: row.flash_sale_start,
            endIso: row.flash_sale_end,
          }
        : null,
    createdAt: row.created_at ?? new Date().toISOString(),
    rating: row.rating != null ? Number(row.rating) : null,
    verificationStatus: row.verification_status ?? 'pending',
    rejectionReason: row.rejection_reason ?? null,
    // 7B-2B: DB NOT NULL DEFAULT true -> fallback true untuk baris lama.
    isDelivery: row.is_delivery ?? true,
    isPickup: row.is_pickup ?? true,
    // 7B-2A: kolom shipping baru, NULL untuk produk legacy (backward compat).
    weightGram: row.weight_gram ?? null,
    lengthCm: row.length_cm ?? null,
    widthCm: row.width_cm ?? null,
    heightCm: row.height_cm ?? null,
  };
}

// Whitelist kolom yang boleh ditulis seller. Kolom verifikasi
// (verification_status, rejection_reason, reviewed_at, reviewed_by) SENGAJA
// tidak pernah dipetakan dari input client; penegakan final ada di DB
// (RLS products_insert_own + trigger enforce_product_verification_*).
function sellerProductToRow(product: Partial<SellerProduct>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (product.name !== undefined) payload.name = product.name;
  if (product.category !== undefined) payload.category = product.category;
  if (product.description !== undefined) payload.description = product.description;
  if (product.image !== undefined) payload.image_url = product.image;
  if (product.originalPrice !== undefined) payload.original_price = product.originalPrice;
  if (product.surplusPrice !== undefined) payload.surplus_price = product.surplusPrice;
  if (product.discountPercent !== undefined) payload.discount_percent = product.discountPercent;
  if (product.stock !== undefined) {
    payload.stock = product.stock;
    payload.status = product.stock > 0 ? 'available' : 'sold_out';
  }
  if (product.startTime !== undefined) payload.sell_window_start = product.startTime;
  if (product.endTime !== undefined) payload.sell_window_end = product.endTime;
  if (product.allDay !== undefined) payload.all_day = product.allDay;
  if (product.isSurplusToday !== undefined) payload.is_surplus_today = product.isSurplusToday;
  if (product.featured !== undefined) payload.featured = product.featured;
  // 7B-2B: kapabilitas fulfillment seller (boolean, bukan opsional di tipe).
  if (product.isDelivery !== undefined) payload.is_delivery = product.isDelivery;
  if (product.isPickup !== undefined) payload.is_pickup = product.isPickup;
  if (product.flashSale !== undefined) {
    payload.flash_sale_price = product.flashSale?.price ?? null;
    payload.flash_sale_start = product.flashSale?.startIso ?? null;
    payload.flash_sale_end = product.flashSale?.endIso ?? null;
  }
  // 7B-2A: kolom shipping (nullable). Tidak ada fallback; NULL = belum diisi.
  // Belum dipakai form seller/checkout pada tahap ini (hanya mapping).
  if (product.weightGram !== undefined) payload.weight_gram = product.weightGram;
  if (product.lengthCm !== undefined) payload.length_cm = product.lengthCm;
  if (product.widthCm !== undefined) payload.width_cm = product.widthCm;
  if (product.heightCm !== undefined) payload.height_cm = product.heightCm;
  return payload;
}

export async function getSellerUmkm(): Promise<SellerUmkm | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return null;

  const { data, error } = await supabase
    .from('umkm_profiles')
    .select('id, slug, business_name')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    console.error('[product-storage] gagal memuat UMKM penjual:', error.message);
    return null;
  }
  const row = data?.[0];
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug ?? null,
    businessName: row.business_name ?? '',
  };
}

export async function getSellerProducts(): Promise<SellerProduct[]> {
  const umkm = await getSellerUmkm();
  if (!umkm) return [];

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('umkm_id', umkm.id)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[product-storage] gagal memuat produk:', error.message);
    return [];
  }
  return (data ?? []).map(rowToSellerProduct);
}

// Jalur publik (menu toko, katalog) default hanya produk approved agar
// produk pending/rejected tidak bocor ke publik. Jalur seller/internal
// (dashboard Menu Saya) memakai { includeAll: true } agar tetap melihat
// semua produk miliknya termasuk yang pending.
export async function getStoreProductsBySlug(
  slug: string,
  options?: { onlyApproved?: boolean; includeAll?: boolean }
): Promise<{ products: SellerProduct[]; error: string | null }> {
  if (!slug) return { products: [], error: null };

  const STORE_LOAD_ERROR = 'Gagal memuat produk toko.';

  const bySlug = await supabase
    .from('umkm_profiles')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (bySlug.error) {
    console.error('[product-storage] gagal resolusi slug toko:', bySlug.error.message);
    return { products: [], error: STORE_LOAD_ERROR };
  }
  let umkmId: string | null = bySlug.data?.id ?? null;

  if (!umkmId) {
    
    const byId = await supabase
      .from('umkm_profiles')
      .select('id')
      .eq('id', slug)
      .maybeSingle();
    if (byId.error) {
      console.error('[product-storage] gagal resolusi id toko:', byId.error.message);
      return { products: [], error: STORE_LOAD_ERROR };
    }
    umkmId = byId.data?.id ?? null;
  }

  if (!umkmId) return { products: [], error: null };

  let storeQuery = supabase
    .from('products')
    .select('*')
    .eq('umkm_id', umkmId)
    .order('created_at', { ascending: false });
  const onlyApproved = options?.includeAll ? false : (options?.onlyApproved ?? true);
  if (onlyApproved) {
    storeQuery = storeQuery.eq('verification_status', 'approved');
  }
  const { data, error } = await storeQuery;
  if (error) {
    console.error('[product-storage] gagal memuat produk toko:', error.message);
    return { products: [], error: STORE_LOAD_ERROR };
  }
  return { products: (data ?? []).map(rowToSellerProduct), error: null };
}

export async function getSellerProductCount(): Promise<number> {
  const products = await getSellerProducts();
  return products.length;
}

function generateProductSlug(): string {
  return `prd-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ownProductMatch(umkmId: string, productId: string): Record<string, unknown> {
  
  return UUID_RE.test(productId)
    ? { umkm_id: umkmId, id: productId }
    : { umkm_id: umkmId, slug: productId };
}

export async function saveSellerProduct(
  input: Omit<SellerProduct, 'id' | 'createdAt'>
): Promise<SellerProduct | null> {
  const umkm = await getSellerUmkm();
  if (!umkm) {
    console.error('[product-storage] tidak ada profil UMKM untuk user ini.');
    return null;
  }
  
  try {
    const { readSellerPlan } = await import('@/lib/seller-plan');
    const plan = await readSellerPlan();
    if (plan.maxProducts !== null) {
      const count = await getSellerProductCount();
      if (count >= plan.maxProducts) {
        console.warn(`[product-storage] kuota ${plan.label} penuh ${count}/${plan.maxProducts}`);
        return null;
      }
    }
    
    const { getActiveSubscription } = await import('@/lib/subscription-storage');
    const sub = await getActiveSubscription();
    if (!sub) {
      console.warn('[product-storage] belum berlangganan aktif - tolak tambah produk');
      return null;
    }
  } catch {}
  // Produk baru selalu 'pending' (fail-safe). DB juga memaksa via default +
  // RLS + trigger, jadi nilai ini tidak bisa di-override dari input client
  // karena sellerProductToRow() tidak memetakan kolom verifikasi.
  const payload = {
    umkm_id: umkm.id,
    slug: generateProductSlug(),
    ...sellerProductToRow({ ...input, flashSale: input.flashSale ?? null }),
    verification_status: 'pending',
  };

  const { data, error } = await supabase
    .from('products')
    .insert(payload)
    .select()
    .maybeSingle();
  if (error || !data) {
    console.error('[product-storage] gagal menyimpan produk:', error?.message);
    return null;
  }
  dispatchUpdated();
  return rowToSellerProduct(data);
}

export async function patchSellerProduct(
  productId: string,
  patch: Partial<Omit<SellerProduct, 'id'>>
): Promise<SellerProduct | undefined> {
  const umkm = await getSellerUmkm();
  if (!umkm) {
    console.error('[product-storage] tidak ada profil UMKM untuk user ini.');
    return undefined;
  }
  const { data, error } = await supabase
    .from('products')
    .update(sellerProductToRow(patch))
    .match(ownProductMatch(umkm.id, productId))
    .select()
    .maybeSingle();
  if (error || !data) {
    console.error('[product-storage] gagal update produk:', error?.message ?? 'produk bukan milik toko ini.');
    return undefined;
  }
  dispatchUpdated();
  return rowToSellerProduct(data);
}

export async function deleteSellerProduct(productId: string): Promise<void> {
  const umkm = await getSellerUmkm();
  if (!umkm) {
    console.error('[product-storage] tidak ada profil UMKM untuk user ini.');
    return;
  }
  const { error } = await supabase
    .from('products')
    .delete()
    .match(ownProductMatch(umkm.id, productId));
  if (error) {
    console.error('[product-storage] gagal menghapus produk:', error.message);
    return;
  }
  dispatchUpdated();
}

export async function getFeaturedProductIds(): Promise<string[]> {
  const products = await getSellerProducts();
  return products.filter((p) => p.featured).map((p) => p.id);
}

export async function getSellerProductById(id: string): Promise<SellerProduct | undefined> {
  const products = await getSellerProducts();
  return products.find((p) => p.id === id);
}

export async function uploadProductImage(
  file: File | Blob,
  fileName?: string
): Promise<string | null> {
  const umkm = await getSellerUmkm();
  const folder = umkm?.id ?? 'misc';
  const safeName = (fileName ?? (file as File).name ?? 'menu.jpg').replace(/[^\w.\-]+/g, '_');
  const path = `${folder}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage.from('product-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) {
    console.error('[product-storage] upload foto gagal:', error.message);
    return null;
  }
  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl ?? null;
}

export function isProductAvailable(product: SellerProduct): boolean {
  if (product.stock <= 0) return false;
  if (product.allDay) return true;
  return isWithinSaleWindow(product.startTime, product.endTime);
}

export function isWithinSaleWindow(startTime: string, endTime: string): boolean {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start <= end) {
    return currentMinutes >= start && currentMinutes < end;
  }
  return currentMinutes >= start || currentMinutes < end;
}

function parseTimeToMinutes(time: string): number {
  const match = time.match(/(\d{1,2})[.:](\d{2})/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}
