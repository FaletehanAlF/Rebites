'use client';

import { CATEGORIES } from '@/lib/categories';
import type { FoodItem } from '@/lib/types';

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

export async function fetchFeaturedProducts(
  count: number,
  skip = 0,
): Promise<FoodItem[]> {
  return pick(await loadAvailableItems(), count, skip);
}
