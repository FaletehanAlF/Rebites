'use client';

import { supabase } from './supabase';
import { readSellerPlan, type SellerEntitlements } from './seller-plan';
import { resolveImageSrc } from './image-path';
import { isMenuScheduleVisible } from './menu-schedule';
import {
  slotFromStartIso,
  validateFlashSaleSchedule,
} from './flash-sale-schedule';
import {
  SELLER_VENDOR_NAME,
  SELLER_VENDOR_SLUG,
  getSellerProducts,
  isProductAvailable,
  patchSellerProduct,
  type SellerProduct,
} from './product-storage';
import type { UrgentItem } from './types';

export type FlashSaleStatus = 'inactive' | 'scheduled' | 'active' | 'ended';

export interface FlashSaleConfig {
  price: number;
  startIso: string;
  endIso: string;
}

export interface FlashSaleResult {
  ok: boolean;
  error?: string;
}

export function getFlashQuota(plan: SellerEntitlements): number {
  return plan.maxFlashSaleProducts ?? Infinity;
}

export function countFlashSaleProducts(products: SellerProduct[]): number {
  return products.filter((product) => product.flashSale != null).length;
}

function quotaErrorMessage(plan: SellerEntitlements): string {
  if (plan.tier === 'basic') {
    return 'Fitur Flash Sale tersedia mulai dari paket Standar. Upgrade paket untuk menambahkan produk ke Flash Sale.';
  }
  return `Paket ${plan.label.replace('ReBites ', '')} hanya dapat memasukkan ${plan.maxFlashSaleProducts} produk ke Flash Sale.`;
}

export function resolveFlashSaleStatus(
  product: SellerProduct,
  now: number = Date.now()
): FlashSaleStatus {
  const flash = product.flashSale;
  if (!flash) return 'inactive';

  const start = new Date(flash.startIso).getTime();
  const end = new Date(flash.endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'inactive';
  if (now < start) return 'scheduled';
  if (now >= end) return 'ended';
  return 'active';
}

export function getFlashDiscountPercent(product: SellerProduct): number {
  const flash = product.flashSale;
  if (!flash || product.originalPrice <= 0) return 0;
  return Math.max(
    0,
    Math.round((1 - flash.price / product.originalPrice) * 100)
  );
}

export function getDisplayPricing(
  product: SellerProduct,
  now: number = Date.now()
): { price: number; isFlash: boolean } {
  if (
    product.flashSale &&
    resolveFlashSaleStatus(product, now) === 'active' &&
    isProductAvailable(product)
  ) {
    return { price: product.flashSale.price, isFlash: true };
  }
  return { price: product.surplusPrice, isFlash: false };
}

export async function setFlashSale(
  productId: string,
  config: FlashSaleConfig,
  planOverride?: SellerEntitlements
): Promise<FlashSaleResult> {
  const products = await getSellerProducts();
  const product = products.find((item) => item.id === productId);
  if (!product) return { ok: false, error: 'Produk tidak ditemukan.' };

  const plan = planOverride ?? (await readSellerPlan());
  const usedByOthers = countFlashSaleProducts(
    products.filter((item) => item.id !== productId && item.flashSale != null)
  );
  if (usedByOthers + 1 > getFlashQuota(plan)) {
    return { ok: false, error: quotaErrorMessage(plan) };
  }

  if (!Number.isFinite(config.price) || config.price <= 0) {
    return { ok: false, error: 'Harga Flash Sale tidak valid.' };
  }
  if (config.price >= product.surplusPrice) {
    return {
      ok: false,
      error: 'Harga Flash Sale harus lebih rendah dari harga normal.',
    };
  }

  const scheduleError = validateFlashSaleSchedule({
    startIso: config.startIso,
    endIso: config.endIso,
    scheduledStart: product.scheduledStart,
    scheduledEnd: product.scheduledEnd,
  });
  if (scheduleError) {
    return { ok: false, error: scheduleError };
  }

  await patchSellerProduct(productId, {
    flashSale: {
      price: config.price,
      startIso: config.startIso,
      endIso: config.endIso,
    },
  });
  return { ok: true };
}

export async function removeFlashSale(productId: string): Promise<FlashSaleResult> {
  const products = await getSellerProducts();
  if (!products.some((item) => item.id === productId)) {
    return { ok: false, error: 'Produk tidak ditemukan.' };
  }
  await patchSellerProduct(productId, { flashSale: null });
  return { ok: true };
}

export interface FlashSaleCardItem extends UrgentItem {
  startsAt?: string;
  endsAt?: string;
  isSellerFlash?: boolean;
}

export {
  FLASH_SLOTS,
  addWibDays,
  flashSlotRange,
  formatFlashDateLabel,
  formatFlashScheduleLabel,
  formatFlashStartLabel,
  isFlashSlotCurrent,
  isFlashSlotPast,
  nextFlashSlotStart,
  slotFromStartIso,
  slotToWibIso,
  todayWibDate,
  validateFlashSaleSchedule,
} from './flash-sale-schedule';

export async function getActiveFlashSaleProducts(
  now: number = Date.now()
): Promise<FlashSaleCardItem[]> {
  const fetchGlobal = async (): Promise<SellerProduct[]> => {
    const { data, error } = await supabase
      .from('products')
      .select('*, umkm:umkm_profiles(business_name)')
      .not('flash_sale_price', 'is', null)
      .eq('status', 'available')
      .eq('verification_status', 'approved')
      .gt('stock', 0)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[flash-sale] gagal memuat flash sale global:', error.message);
      return [];
    }
    return ((data ?? []) as Record<string, unknown>[])
      // Toko nonaktif tidak terbaca publik (RLS), sehingga relasi umkm kosong.
      // Tanpa saringan ini produknya bisa tampil dengan nama vendor fallback.
      .filter((row) => {
        const umkm = (row as Record<string, unknown>).umkm;
        return Boolean(umkm) && typeof umkm === 'object';
      })
      .map((row) => {
      const r = row as Record<string, unknown>;
      const umkm = r.umkm as Record<string, unknown> | null;
      return {
        id: (r.slug as string) ?? (r.id as string),
        name: (r.name as string) ?? '',
        category: (r.category as string) ?? 'Lainnya',
        description: (r.description as string) ?? '',
        image: resolveImageSrc(r.image_url as string) || '/foods/ikansayur.avif',
        originalPrice: Number(r.original_price ?? 0),
        surplusPrice: Number(r.surplus_price ?? 0),
        discountPercent: Number(r.discount_percent ?? 0),
        stock: Number(r.stock ?? 0),
        startTime: ((r.sell_window_start as string) ?? '09:00').slice(0, 5),
        endTime: ((r.sell_window_end as string) ?? '21:00').slice(0, 5),
        allDay: (r.all_day as boolean) ?? false,
        isSurplusToday: (r.is_surplus_today as boolean) ?? true,
        scheduledStart: (r.scheduled_start as string | null) ?? null,
        scheduledEnd: (r.scheduled_end as string | null) ?? null,
        featured: (r.featured as boolean) ?? false,
        // kapabilitas fulfillment (DB NOT NULL DEFAULT true).
        isDelivery: (r.is_delivery as boolean) ?? true,
        isPickup: (r.is_pickup as boolean) ?? true,
        vendorName: (umkm?.business_name as string) ?? (r.vendor_name as string) ?? SELLER_VENDOR_NAME,
        flashSale:
          r.flash_sale_price != null
            ? {
                price: Number(r.flash_sale_price),
                startIso: r.flash_sale_start as string,
                endIso: r.flash_sale_end as string,
              }
            : null,
        createdAt: (r.created_at as string) ?? new Date().toISOString(),
      } as SellerProduct & { vendorName: string };
    });
  };

  let products: (SellerProduct & { vendorName?: string })[] = [];
  try {
    products = await fetchGlobal();
  } catch {
    products = [];
  }
  if (products.length === 0) {
    try {
      const local = await getSellerProducts();
      products = local.filter((p) => p.flashSale != null) as typeof products;
    } catch {}
  }

  return products
    .filter((product) => (product as SellerProduct).flashSale != null)
    // Penjadwalan menu menang atas promo. Promo yang sedang berlangsung wajib
    // tayang SEKARANG; promo mendatang cukup tayang saat jadwalnya dimulai,
    // sehingga pembeli tetap bisa melihat daftar "Akan Datang".
    .filter((product) => {
      const seller = product as SellerProduct;
      const status = resolveFlashSaleStatus(seller, now);
      if (status !== 'active' && status !== 'scheduled') return false;
      const startMs = new Date(seller.flashSale!.startIso).getTime();
      const checkAt =
        status === 'scheduled' && Number.isFinite(startMs)
          ? Math.max(now, startMs)
          : now;
      return isMenuScheduleVisible(seller, checkAt);
    })
    .map((product) => {
      const p = product as SellerProduct & { vendorName?: string };
      const flash = p.flashSale!;
      // Harga Flash Sale juga ditampilkan pada jadwal mendatang supaya
      // pembeli tahu promo apa yang akan datang, bukan harga normal.
      const price = flash.price;
      const discountPercent =
        p.originalPrice > 0
          ? Math.max(0, Math.round((1 - flash.price / p.originalPrice) * 100))
          : p.discountPercent;

      return {
        id: p.id,
        name: p.name,
        vendorName: p.vendorName ?? SELLER_VENDOR_NAME,
        image: p.image,
        category: p.category as UrgentItem['category'],
        rating: 4.7,
        // jarak seller-flash belum diketahui -> NULL (jangan karang 1.8 km).
        distanceKm: null,
        availableFrom: p.startTime,
        availableTo: p.endTime,
        stockLabel: `${p.stock} porsi tersisa`,
        originalPrice: p.originalPrice,
        discountedPrice: price,
        discountPercent,
        expiresAt: flash.endIso,
        slot: slotFromStartIso(flash.startIso),
        startsAt: flash.startIso,
        endsAt: flash.endIso,
        isSellerFlash: true,
      } satisfies FlashSaleCardItem;
    });
}

export const FLASH_SELLER_STORE_HREF = `/detail/toko?id=${SELLER_VENDOR_SLUG}`;
