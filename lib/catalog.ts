'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { FoodItem, PromoCode, UrgentItem, UrgentSlot, Vendor } from './types';
import { STORE_SETTINGS_UPDATED_EVENT } from './store-settings-storage';
import { displayBusinessName } from './business-name';
import { resolveImageSrc } from './image-path';

export interface CatalogData {
  foodItems: FoodItem[];
  urgentItems: UrgentItem[];
  vendors: Vendor[];
  
  error: string | null;
}

const EMPTY_CATALOG: CatalogData = {
  foodItems: [],
  urgentItems: [],
  vendors: [],
  error: null,
};

type ProductRow = Record<string, any>;
type UmkmRow = Record<string, any>;

function parseStockFromLabel(label: string | null | undefined, fallback: number): number {
  const match = (label ?? '').match(/\d+/);
  return match ? Number(match[0]) : fallback;
}

function productToFoodItem(row: ProductRow): FoodItem {
  // Sumber kebenaran stok adalah kolom numerik; label hanya output presentasional.
  const stock = Number(row.stock ?? 0);
  return {
    id: row.slug ?? row.id,
    name: row.name ?? '',
    vendorName: row.umkm?.business_name ?? '',
    image: resolveImageSrc(row.image_url) || '/foods/ikansayur.avif',
    category: row.category ?? 'Lainnya',
    rating: row.rating != null ? Number(row.rating) : null,
    distanceKm: row.distance_km != null ? Number(row.distance_km) : null,
    availableFrom: (row.sell_window_start ?? '09:00').slice(0, 5),
    availableTo: (row.sell_window_end ?? '21:00').slice(0, 5),
    stockLabel:
      row.stock_label ?? (stock <= 0 ? 'Habis' : `${stock} porsi tersisa`),
    originalPrice: row.original_price ?? 0,
    discountedPrice: row.surplus_price ?? 0,
    discountPercent: row.discount_percent ?? 0,
    expiresAt: row.expires_at ?? undefined,
    // tambahan untuk lookup robust foto makanan disukai (id slug vs uuid)
    // + stok numerik agar kartu memakai angka, bukan teks label.
    ...({ slug: row.slug ?? row.id, rawId: row.id, stock } as {
      slug: string;
      rawId: string;
      stock: number;
    }),
  } as FoodItem;
}

function umkmToVendor(row: UmkmRow, itemCount: number): Vendor {
  return {
    id: row.slug ?? row.id,
    name: displayBusinessName(row.business_name),
    image:
      row.logo_url ??
      'https://images.pexels.com/photos/37193132/pexels-photo-37193132.jpeg?auto=compress&cs=tinysrgb&w=800',
    isRescuePartner: row.is_rescue_partner ?? false,
    isVerified: row.is_verified ?? false,
    rating: Number(row.rating ?? 5),
    distanceKm: row.distance_km != null ? Number(row.distance_km) : null,
    category: row.category ?? 'Makanan Berat',
    itemCount,
    address: row.address ?? '',
    openHours: row.open_hours ?? '09.00-21.00',
    isOpen: row.is_open ?? true,
    description: row.description ?? '',
    tagline: row.tagline ?? undefined,
    tier: row.partner_tier ?? undefined,
    followers:
      row.followers === null || row.followers === undefined
        ? undefined
        : Number(row.followers),
    memberSince:
      row.member_since === null || row.member_since === undefined
        ? undefined
        : Number(row.member_since),
    responseTime: row.response_time ?? undefined,
    porsiTerselamatkan:
      row.porsi_terselamatkan === null || row.porsi_terselamatkan === undefined
        ? undefined
        : Number(row.porsi_terselamatkan),
    co2eSavedKg:
      row.co2e_saved_kg === null || row.co2e_saved_kg === undefined
        ? undefined
        : Number(row.co2e_saved_kg),
  };
}

type FetchResult<T> = { items: T[]; error: string | null };

export async function fetchFoodItems(): Promise<FoodItem[]> {
  return (await queryFoodItems()).items;
}

/**
 * Produk dari toko yang dinonaktifkan admin tidak boleh muncul di katalog.
 *
 * RLS menahan baris umkm_profiles, tetapi baris products-nya sendiri tetap
 * approved dan bisa saja dikembalikan; karena itu hasil query disaring dengan
 * ada-tidaknya relasi `umkm`. Ini penjaga kedua setelah RLS, bukan pengganti.
 */
function hasActiveStore(row: ProductRow): boolean {
  return Boolean(row.umkm) && typeof row.umkm === 'object';
}

async function queryFoodItems(): Promise<FetchResult<FoodItem>> {
  const { data, error } = await supabase
    .from('products')
    .select('*, umkm:umkm_profiles(business_name)')
    .is('slot', null)
    .eq('status', 'available')
    .eq('verification_status', 'approved')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[catalog] gagal memuat produk:', error.message);
    return { items: [], error: error.message };
  }
  return {
    items: (data ?? []).filter(hasActiveStore).map(productToFoodItem),
    error: null,
  };
}

export async function fetchUrgentItems(): Promise<UrgentItem[]> {
  return (await queryUrgentItems()).items;
}

async function queryUrgentItems(): Promise<FetchResult<UrgentItem>> {
  const { data, error } = await supabase
    .from('products')
    .select('*, umkm:umkm_profiles(business_name)')
    .not('slot', 'is', null)
    .eq('status', 'available')
    .eq('verification_status', 'approved')
    .order('expires_at', { ascending: true });
  if (error) {
    console.error('[catalog] gagal memuat urgent deals:', error.message);
    return { items: [], error: error.message };
  }
  return {
    items: (data ?? []).filter(hasActiveStore).map((row) => ({
      ...productToFoodItem(row),
      expiresAt:
        row.expires_at ?? new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      slot: (row.slot ?? '09-12') as UrgentSlot,
    })),
    error: null,
  };
}

export async function fetchVendors(): Promise<Vendor[]> {
  return (await queryVendors()).items;
}

export async function fetchCategoryCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('products')
    .select('category')
    .eq('status', 'available')
    .eq('verification_status', 'approved');
  if (error) {
    console.error('[catalog] gagal memuat kategori:', error.message);
    return {};
  }
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const key = (row as Record<string, any>).category;
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

async function queryVendors(): Promise<FetchResult<Vendor>> {
  const [umkmResult, productResult] = await Promise.all([
    // RLS umkm_select_public hanya mengembalikan toko aktif, sehingga toko
    // yang dinonaktifkan admin hilang dari beranda dan halaman /toko.
    supabase.from('umkm_profiles').select('*').order('rating', { ascending: false }),
    supabase.from('products').select('umkm_id').eq('verification_status', 'approved'),
  ]);
  if (umkmResult.error) {
    console.error('[catalog] gagal memuat vendor:', umkmResult.error.message);
    return { items: [], error: umkmResult.error.message };
  }

  const counts = new Map<string, number>();
  for (const p of productResult.data ?? []) {
    counts.set(p.umkm_id, (counts.get(p.umkm_id) ?? 0) + 1);
  }
  return {
    items: (umkmResult.data ?? []).map((row: UmkmRow) =>
      umkmToVendor(row, counts.get(row.id) ?? 0)
    ),
    error: null,
  };
}

export async function fetchCatalog(): Promise<CatalogData> {
  const [foodResult, urgentResult, vendorResult] = await Promise.all([
    queryFoodItems(),
    queryUrgentItems(),
    queryVendors(),
  ]);
  return {
    foodItems: foodResult.items,
    urgentItems: urgentResult.items,
    vendors: vendorResult.items,
    error:
      foodResult.error ??
      urgentResult.error ??
      vendorResult.error ??
      null,
  };
}

const CATALOG_CACHE_TTL_MS = 15_000; // 15 detik
let catalogCache: Promise<CatalogData> | null = null;
let catalogCacheTimestamp = 0;

function invalidateCatalogCache() {
  catalogCache = null;
  catalogCacheTimestamp = 0;
}

// Invalidasi di level modul (terdaftar saat import, lebih dulu daripada
// listener instance mana pun) sehingga semua instance useCatalog berbagi
// SATU fetch baru saat pengaturan toko berubah.
if (typeof window !== 'undefined') {
  window.addEventListener(STORE_SETTINGS_UPDATED_EVENT, invalidateCatalogCache);
}

// Cache promise fetchCatalog: mount bersamaan / dalam TTL berbagi satu hasil.
function fetchCatalogCached(): Promise<CatalogData> {
  if (catalogCache && Date.now() - catalogCacheTimestamp < CATALOG_CACHE_TTL_MS) {
    return catalogCache;
  }
  const run = fetchCatalog();
  catalogCache = run;
  catalogCacheTimestamp = Date.now();
  // Hasil gagal jangan di-cache agar percobaan berikutnya fetch ulang.
  run.catch(() => {
    if (catalogCache === run) catalogCache = null;
  });
  return run;
}

export function useCatalog() {
  const [data, setData] = useState<CatalogData>(EMPTY_CATALOG);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (isCancelled?: () => boolean) => {
    setLoading(true);
    const result = await fetchCatalogCached();
    if (isCancelled?.()) return;
    setData(result);
    setLoading(false);
  }, []);

  // API publik: selalu fetch baru seperti sebelumnya.
  const refresh = useCallback(() => {
    invalidateCatalogCache();
    return load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void load(() => cancelled);
    // Instant: saat pengaturan toko disimpan (logo/nama/openHours), refresh vendor di home tanpa reload
    const onStoreUpdated = () => {
      void load(() => cancelled);
    };
    window.addEventListener(STORE_SETTINGS_UPDATED_EVENT, onStoreUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(STORE_SETTINGS_UPDATED_EVENT, onStoreUpdated);
    };
  }, [load]);

  return { ...data, loading, refresh };
}

function rowToPromoCode(row: Record<string, any>): PromoCode {
  return {
    code: row.code,
    percentOff: row.percent_off,
    isValid: Boolean(row.is_valid),
  };
}

export async function getValidPromoCodes(): Promise<PromoCode[]> {
  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('is_valid', true);
  if (error) {
    console.error('[catalog] gagal memuat promo codes:', error.message);
    return [];
  }
  return (data ?? []).map(rowToPromoCode);
}

export async function validatePromoCode(code: string): Promise<PromoCode | null> {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from('promo_codes')
    .select('*')
    .eq('code', trimmed)
    .eq('is_valid', true)
    .maybeSingle();
  if (error || !data) return null;
  return rowToPromoCode(data);
}
