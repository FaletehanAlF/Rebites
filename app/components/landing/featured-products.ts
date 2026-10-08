'use client';

import { CATEGORIES } from '@/lib/categories';
import type { FoodItem } from '@/lib/types';

/**
 * Seleksi produk unggulan untuk halaman landing.
 *
 * Landing hanya menampilkan produk asli dari Supabase — tidak ada placeholder,
 * tidak ada harga karangan. `@/lib/catalog` di-import secara dinamis di dalam
 * fungsi supaya supabase-js tetap keluar dari critical path; promise hasil
 * fetch di-cache di tingkat modul sehingga hero dan section katalog berbagi
 * satu request.
 *
 * Urutan seleksi:
 *  1. hanya kategori yang benar-benar bisa dibuka pengunjung lewat
 *     `/makanan/[category]` (menyaring baris uji / kategori liar di DB);
 *  2. tier gambar — aset foto makanan milik proyek (`/makanan*`) lebih dulu,
 *     karena foto unggahan penjual bisa berisi gambar yang salah dan tidak
 *     bisa diverifikasi dari sini; gambar eksternal hanya dipakai bila tier
 *     pertama tidak cukup;
 *  3. di dalam tier yang sama, diskon terbesar lebih dulu, dengan satu
 *     produk per penjual supaya showcase memperlihatkan lebih dari satu UMKM;
 *  4. `skip` memakai urutan yang sama sehingga hero dan showcase tidak
 *     menampilkan menu yang berulang.
 */
const BROWSABLE_CATEGORIES = new Set(CATEGORIES.map((category) => category.name));

function imageTier(item: FoodItem): number {
  if (!item.image) return 2;
  return item.image.startsWith('/') ? 0 : 1;
}

let itemsPromise: Promise<FoodItem[]> | null = null;

function loadAvailableItems(): Promise<FoodItem[]> {
  if (!itemsPromise) {
    itemsPromise = import('@/lib/catalog')
      .then(({ fetchFoodItems }) => fetchFoodItems())
      .catch((error) => {
        console.error('[landing] gagal memuat katalog:', error);
        itemsPromise = null;
        return [] as FoodItem[];
      });
  }
  return itemsPromise;
}

function pick(items: FoodItem[], count: number, skip: number): FoodItem[] {
  const browsable = items.filter((item) =>
    BROWSABLE_CATEGORIES.has(item.category),
  );
  const pool = browsable.length > 0 ? browsable : items;
  if (pool.length === 0 || count <= 0) return [];

  const ordered = [...pool].sort(
    (a, b) => imageTier(a) - imageTier(b) || b.discountPercent - a.discountPercent,
  );
  const bestTier = imageTier(ordered[0]);
  const preferred = ordered.filter((item) => imageTier(item) === bestTier);

  const chosen: FoodItem[] = [];
  const chosenIds = new Set<string>();
  const vendors = new Set<string>();

  const fill = (list: FoodItem[], onePerVendor: boolean) => {
    for (const item of list) {
      if (chosen.length >= count + skip) return;
      if (chosenIds.has(item.id)) continue;
      if (onePerVendor && item.vendorName && vendors.has(item.vendorName)) {
        continue;
      }
      chosen.push(item);
      chosenIds.add(item.id);
      if (item.vendorName) vendors.add(item.vendorName);
    }
  };

  fill(preferred, true);
  fill(preferred, false);
  fill(ordered, true);
  fill(ordered, false);

  return chosen
    .slice(skip)
    .sort((a, b) => b.discountPercent - a.discountPercent);
}

/**
 * @param count berapa menu yang dikembalikan
 * @param skip  lewati menu pertama (dipakai showcase agar tidak mengulang
 *              menu unggulan yang sudah tampil di hero)
 */
export async function fetchFeaturedProducts(
  count: number,
  skip = 0,
): Promise<FoodItem[]> {
  return pick(await loadAvailableItems(), count, skip);
}
