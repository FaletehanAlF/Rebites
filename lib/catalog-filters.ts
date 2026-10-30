/**
 * Aturan katalog makanan & UMKM — modul MURNI (tanpa React/Supabase) supaya
 * perilaku search, filter, dan sort bisa diuji langsung dengan `node --test`.
 *
 * Semua fungsi di sini bekerja pada data katalog ASLI (`FoodItem`/`Vendor`
 * dari `useCatalog`). Tidak ada nilai karangan: filter yang tidak punya data
 * pendukung tidak ditawarkan sama sekali (lihat `availableFoodCategories`).
 */

export type FoodSortKey =
  | 'relevan'
  | 'diskon-terbesar'
  | 'harga-rendah'
  | 'harga-tinggi'
  | 'rating';

export type StockFilter = 'semua' | 'tersedia';

export interface FoodFilterInput {
  /** Kata kunci bebas: dicocokkan ke nama makanan dan nama toko. */
  query?: string;
  /** id kategori (slug) dari CATEGORIES, bukan label tampilan. */
  categoryId?: string | null;
  /** Batas harga atas (rupiah) berdasarkan harga setelah diskon. */
  maxPrice?: number | null;
  /** Batas harga bawah (rupiah). */
  minPrice?: number | null;
  stock?: StockFilter;
  sort?: FoodSortKey;
}

interface FilterableFood {
  name: string;
  vendorName: string;
  category: string;
  discountedPrice: number;
  discountPercent: number;
  rating: number | null;
  stockLabel: string;
}

/** Label stok yang berarti produk tidak bisa dibeli. */
const OUT_OF_STOCK_LABELS = new Set(['habis', 'tidak tersedia']);

export function isOutOfStockLabel(stockLabel: string): boolean {
  return OUT_OF_STOCK_LABELS.has(stockLabel.trim().toLowerCase());
}

/**
 * Pencarian sederhana yang sengaja tidak memakai regex: istilah pengguna
 * dianggap teks literal, sehingga karakter seperti `.` atau `(` tidak bisa
 * membuat pola pencarian berperilaku aneh.
 */
export function matchesQuery(
  haystack: string[],
  query: string | undefined
): boolean {
  const needle = (query ?? '').trim().toLowerCase();
  if (!needle) return true;
  return haystack.some((value) => value.toLowerCase().includes(needle));
}

function compareRating(a: FilterableFood, b: FilterableFood): number {
  // Rating null (belum ada rating) diperlakukan paling rendah, bukan 0 palsu.
  return (b.rating ?? -1) - (a.rating ?? -1);
}

export function filterAndSortFoods<T extends FilterableFood>(
  items: T[],
  filters: FoodFilterInput
): T[] {
  const {
    query,
    categoryId,
    minPrice = null,
    maxPrice = null,
    stock = 'semua',
    sort = 'relevan',
  } = filters;

  const filtered = items.filter((item) => {
    if (categoryId && item.category !== categoryId) return false;
    if (maxPrice != null && item.discountedPrice > maxPrice) return false;
    if (minPrice != null && item.discountedPrice < minPrice) return false;
    if (stock === 'tersedia' && isOutOfStockLabel(item.stockLabel)) return false;
    return matchesQuery([item.name, item.vendorName], query);
  });

  // Salinan: jangan pernah mengurutkan array milik pemanggil (katalog bersama).
  const sorted = [...filtered];
  switch (sort) {
    case 'diskon-terbesar':
      sorted.sort((a, b) => b.discountPercent - a.discountPercent);
      break;
    case 'harga-rendah':
      sorted.sort((a, b) => a.discountedPrice - b.discountedPrice);
      break;
    case 'harga-tinggi':
      sorted.sort((a, b) => b.discountedPrice - a.discountedPrice);
      break;
    case 'rating':
      sorted.sort(compareRating);
      break;
    default:
      // 'relevan': urutan katalog apa adanya (sudah diurutkan sumbernya).
      break;
  }
  return sorted;
}

/** Jumlah filter yang aktif, dipakai untuk badge tombol "Filter". */
export function countActiveFoodFilters(filters: FoodFilterInput): number {
  let count = 0;
  if (filters.categoryId) count += 1;
  if (filters.minPrice != null || filters.maxPrice != null) count += 1;
  if ((filters.stock ?? 'semua') !== 'semua') count += 1;
  if ((filters.sort ?? 'relevan') !== 'relevan') count += 1;
  if ((filters.query ?? '').trim()) count += 1;
  return count;
}

/**
 * Kategori yang benar-benar dipakai minimal satu produk.
 *
 * Dipakai untuk menawarkan chip filter. Kategori tanpa produk tidak
 * ditampilkan supaya pengguna tidak memilih filter yang dijamin kosong.
 */
export function availableFoodCategories<T extends { category: string }>(
  items: T[]
): string[] {
  const seen = new Set<string>();
  for (const item of items) seen.add(item.category);
  return Array.from(seen);
}

// ---------------------------------------------------------------------------
// UMKM
// ---------------------------------------------------------------------------

export type VendorSortKey = 'relevan' | 'rating' | 'jarak' | 'nama';

export type VendorOpenFilter = 'semua' | 'buka';

export interface VendorFilterInput {
  query?: string;
  /** Judul/kota yang dicocokkan pada alamat toko. */
  location?: string | null;
  openOnly?: VendorOpenFilter;
  sort?: VendorSortKey;
}

interface FilterableVendor {
  name: string;
  description: string;
  address: string;
  category: string;
  rating: number;
  distanceKm: number | null;
  isOpen: boolean;
}

export function filterAndSortVendors<T extends FilterableVendor>(
  vendors: T[],
  filters: VendorFilterInput
): T[] {
  const {
    query,
    location = null,
    openOnly = 'semua',
    sort = 'relevan',
  } = filters;

  const filtered = vendors.filter((vendor) => {
    if (openOnly === 'buka' && !vendor.isOpen) return false;
    if (
      location &&
      !vendor.address.toLowerCase().includes(location.trim().toLowerCase())
    ) {
      return false;
    }
    // Nama toko dan deskripsi saja — alamat punya filternya sendiri.
    return matchesQuery([vendor.name, vendor.description], query);
  });

  const sorted = [...filtered];
  switch (sort) {
    case 'rating':
      sorted.sort((a, b) => b.rating - a.rating);
      break;
    case 'jarak':
      // Jarak null = tidak diketahui; taruh paling belakang, bukan dianggap 0.
      sorted.sort(
        (a, b) =>
          (a.distanceKm ?? Number.MAX_SAFE_INTEGER) -
          (b.distanceKm ?? Number.MAX_SAFE_INTEGER)
      );
      break;
    case 'nama':
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'id'));
      break;
    default:
      break;
  }
  return sorted;
}

export function countActiveVendorFilters(filters: VendorFilterInput): number {
  let count = 0;
  if ((filters.query ?? '').trim()) count += 1;
  if (filters.location) count += 1;
  if ((filters.openOnly ?? 'semua') !== 'semua') count += 1;
  if ((filters.sort ?? 'relevan') !== 'relevan') count += 1;
  return count;
}

/**
 * Kota/kecamatan yang muncul di alamat toko, diurutkan agar pilihan stabil.
 *
 * Konvensi alamat proyek: "Jl. …, <kecamatan>, <kota>[, <kode pos>]". Yang
 * diambil adalah segmen yang MENGIKUTI kecamatan, yaitu segmen setelah
 * pemisah kedua — bukan sekadar segmen terakhir, karena pada alamat tanpa
 * kode pos segmen terakhir justru kecamatan.
 */
export function availableVendorCities<T extends { address: string }>(
  vendors: T[]
): string[] {
  const cities = new Set<string>();
  for (const vendor of vendors) {
    const parts = vendor.address
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length < 3) continue;
    const city = parts[2];
    if (!city || /^\d{4,6}$/.test(city)) continue;
    cities.add(city);
  }
  return Array.from(cities).sort((a, b) => a.localeCompare(b, 'id'));
}
