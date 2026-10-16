'use client';

import { useEffect, useState } from 'react';
import {
  Award,
  HeartHandshake,
  Medal,
  Recycle,
  ShoppingBag,
  Zap,
} from 'lucide-react';
import { getSellerOrders } from '@/lib/order-storage';
import { getSellerProducts } from '@/lib/product-storage';
import type { SellerProduct } from '@/lib/product-storage';
import { getSellerProductReviewCount } from '@/lib/review-storage';
import { ORDERS_UPDATED_EVENT } from '@/lib/order-storage';
import { REVIEWS_UPDATED_EVENT } from '@/lib/review-storage';
import { PRODUCTS_UPDATED_EVENT } from '@/lib/product-storage';
import type {
  AchievementBadge,
  FavoriteCategory,
  MonthCategoryData,
  PartnerScorePeriod,
} from '@/app/components/seller/dashboard-penjual/types';

export interface AnalyticsDayPoint {
  key: string;
  day: string;
  terjual: number;
  tersisa: number;
  revenue: number;
}

export interface AnalyticsPayload {
  hydrated: boolean;
  hasOrders: boolean;
  
  days30: AnalyticsDayPoint[];
  months: Record<string, MonthCategoryData>;
  monthOptions: { value: string; label: string }[];
  partnerScores: Record<string, PartnerScorePeriod>;
  periodOptions: { value: string; label: string }[];
  achievements: AchievementBadge[];
  avgPricePerPorsi: number;
}

const EMPTY: AnalyticsPayload = {
  hydrated: false,
  hasOrders: false,
  days30: [],
  months: {},
  monthOptions: [],
  partnerScores: {},
  periodOptions: [],
  achievements: [],
  avgPricePerPorsi: 0,
};

const PERIODS: { value: string; label: string; days: number }[] = [
  { value: '7-hari', label: '7 Hari', days: 7 },
  { value: '30-hari', label: '30 Hari', days: 30 },
  { value: '90-hari', label: '90 Hari', days: 90 },
];

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

let cache: AnalyticsPayload | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 20_000; // 20 detik
let inflight: Promise<AnalyticsPayload> | null = null;

function invalidateCache() {
  cache = null;
  cacheTimestamp = 0;
  // Lepas inflight agar invalidasi benar-benar memulai fetch baru.
  inflight = null;
}

async function loadAnalytics(): Promise<AnalyticsPayload> {
  const now = Date.now();
  if (cache && now - cacheTimestamp < CACHE_TTL_MS) return cache;
  if (!inflight) {
    const current: Promise<AnalyticsPayload> = (async () => {
      const [orders, products, reviewCount] = await Promise.all([
        getSellerOrders(),
        getSellerProducts(),
        getSellerProductReviewCount(),
      ]);

      const totalStock = products.reduce(
        (sum, product: SellerProduct) => sum + (product.stock ?? 0),
        0
      );

      const today = startOfDay(new Date());
      const buckets = new Map<string, AnalyticsDayPoint>();
      for (let i = 29; i >= 0; i -= 1) {
        const day = new Date(today);
        day.setDate(today.getDate() - i);
        const key = day.toISOString().slice(0, 10);
        buckets.set(key, {
          key,
          day: day.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
          terjual: 0,
          tersisa: totalStock,
          revenue: 0,
        });
      }

      let porsiTotal = 0;
      let pendapatanTotal = 0;
      let completedCount = 0;
      let firstOrderAt: number | null = null;
      const activeDays = new Set<string>();

      for (const order of orders) {
        const created = new Date(order.createdAt);
        const key = startOfDay(created).toISOString().slice(0, 10);
        const bucket = buckets.get(key);
        const qty = order.quantity ?? 0;
        porsiTotal += qty;
        pendapatanTotal += order.total ?? 0;
        if (bucket) {
          bucket.terjual += qty;
          bucket.revenue += order.total ?? 0;
        }
        if (order.status === 'completed') {
          completedCount += 1;
          activeDays.add(key);
        }
        const ts = created.getTime();
        if (firstOrderAt === null || ts < firstOrderAt) firstOrderAt = ts;
      }

      const days30 = Array.from(buckets.values());
      const avgPricePerPorsi =
        porsiTotal > 0 ? Math.round(pendapatanTotal / porsiTotal) : 21000;

      const categoryBySlug = new Map(
        products.map((product) => [product.id, product.category])
      );
      const monthMap = new Map<
        string,
        { label: string; total: number; byCategory: Map<string, number> }
      >();
      for (let i = 2; i >= 0; i -= 1) {
        const cursor = new Date();
        cursor.setDate(1);
        cursor.setMonth(cursor.getMonth() - i);
        const key = `${cursor.getFullYear()}-${String(
          cursor.getMonth() + 1
        ).padStart(2, '0')}`;
        monthMap.set(key, {
          label: cursor.toLocaleDateString('id-ID', {
            month: 'long',
            year: 'numeric',
          }),
          total: 0,
          byCategory: new Map(),
        });
      }
      for (const order of orders) {
        const created = new Date(order.createdAt);
        const key = `${created.getFullYear()}-${String(
          created.getMonth() + 1
        ).padStart(2, '0')}`;
        const entry = monthMap.get(key);
        if (!entry) continue;
        entry.total += order.total ?? 0;
        const category =
          categoryBySlug.get(order.productId ?? '') ?? 'Lainnya';
        entry.byCategory.set(
          category,
          (entry.byCategory.get(category) ?? 0) + (order.total ?? 0)
        );
      }
      const months: Record<string, MonthCategoryData> = {};
      const monthOptions: { value: string; label: string }[] = [];
      Array.from(monthMap.entries()).forEach(([key, entry]) => {
        const categories: FavoriteCategory[] = Array.from(
          entry.byCategory.entries() as unknown as [string, number][]
        )
          .map(([category, amount]) => ({
            category,
            percent:
              entry.total > 0
                ? Math.round((amount / entry.total) * 100)
                : 0,
          }))
          .sort((a, b) => b.percent - a.percent);
        const top = categories.slice(0, 5);
        const restPercent = categories.slice(5).reduce(
          (sum, item) => sum + item.percent,
          0
        );
        if (restPercent > 0) top.push({ category: 'Lainnya', percent: restPercent });
        months[key] = { label: entry.label, total: entry.total, categories: top };
        monthOptions.push({ value: key, label: entry.label });
      });

      const partnerScores: Record<string, PartnerScorePeriod> = {};
      for (const period of PERIODS) {
        const compute = (offsetDays: number) => {
          const end = Date.now() - offsetDays * 24 * 60 * 60 * 1000;
          const start = end - period.days * 24 * 60 * 60 * 1000;
          let porsi = 0;
          let done = 0;
          let total = 0;
          for (const order of orders) {
            const ts = new Date(order.createdAt).getTime();
            if (ts < start || ts >= end) continue;
            total += 1;
            porsi += order.quantity ?? 0;
            if (order.status === 'completed') done += 1;
          }
          const completionRate = total > 0 ? done / total : 0;
          const demand = Math.min(1, porsi / period.days / 5);
          return Math.round((completionRate * 60 + demand * 40) * 100) / 100;
        };
        const score = Math.min(100, compute(0));
        const previous = Math.min(100, compute(period.days));
        partnerScores[period.value] = {
          label: period.label,
          score,
          deltaPercent: Math.max(0, score - previous),
        };
      }
      const periodOptions = PERIODS.map(({ value, label }) => ({ value, label }));

      const activeDays14 = Array.from(activeDays).filter((key) => {
        const ts = new Date(`${key}T00:00:00`).getTime();
        return ts >= today.getTime() - 13 * 24 * 60 * 60 * 1000;
      }).length;
      const monthsActive = firstOrderAt
        ? Math.max(
            0,
            Math.round(
              (Date.now() - firstOrderAt) / (30 * 24 * 60 * 60 * 1000)
            )
          )
        : 0;
      const completionRate =
        orders.length > 0 ? Math.round((completedCount / orders.length) * 100) : 0;

      const achievements: AchievementBadge[] = [
        {
          id: 'umkm-teraktif',
          icon: Award,
          name: 'UMKM Teraktif',
          current: completedCount,
          target: 20,
          unit: 'kali',
          unlocked: completedCount >= 20,
          group: 'terkumpul',
        },
        {
          id: '100-porsi',
          icon: ShoppingBag,
          name: '100 Porsi Terjual',
          current: Math.min(porsiTotal, 999),
          target: 100,
          unit: 'porsi',
          unlocked: porsiTotal >= 100,
          group: porsiTotal >= 100 ? 'terkumpul' : 'sedang-diusahakan',
        },
        {
          id: 'mitra-terpercaya',
          icon: HeartHandshake,
          name: 'Mitra Terpercaya',
          current: monthsActive,
          target: 12,
          unit: 'bulan',
          unlocked: monthsActive >= 12,
          group: monthsActive >= 12 ? 'terkumpul' : 'sedang-diusahakan',
        },
        {
          id: 'zero-waste-vendor',
          icon: Recycle,
          name: 'Zero Waste Vendor',
          current: activeDays14,
          target: 10,
          unit: 'hari',
          unlocked: activeDays14 >= 10,
          group: 'sedang-diusahakan',
        },
        {
          id: 'penjual-andal',
          icon: Zap,
          name: 'Penjual Andal',
          current: completionRate,
          target: 90,
          unit: '%',
          unlocked: completionRate >= 90,
          group: 'sedang-diusahakan',
        },
        {
          id: 'kolektor-ulasan',
          icon: Medal,
          name: 'Kolektor Ulasan',
          current: reviewCount,
          target: 25,
          unit: 'ulasan',
          unlocked: reviewCount >= 25,
          group: 'sedang-diusahakan',
        },
      ];

      const payload: AnalyticsPayload = {
        hydrated: true,
        hasOrders: orders.length > 0,
        days30,
        months,
        monthOptions,
        partnerScores,
        periodOptions,
        achievements,
        avgPricePerPorsi,
      };
      return payload;
    })();
    inflight = current;
    // Set cache + lepas inflight setelah selesai: awaiter yang sedang berjalan
    // tetap mendapat payload yang sama, pemanggil berikutnya memulai fetch baru.
    // Lewati bila sudah ada invalidasi/fetch baru di tengah jalan, supaya
    // hasil basi tidak menimpa hasil segar.
    current.then(
      (payload) => {
        if (inflight !== current) return;
        cache = payload;
        cacheTimestamp = Date.now();
        inflight = null;
      },
      () => {
        if (inflight === current) inflight = null;
      }
    );
  }
  try {
    return await inflight;
  } catch {
    return { ...EMPTY, hydrated: true };
  }
}

/** Analitik penjual dari data pesanan & produk Supabase (dengan cache modul + TTL + event invalidation). */
export function useSellerAnalytics(): AnalyticsPayload {
  const [payload, setPayload] = useState<AnalyticsPayload>(cache ?? EMPTY);

  useEffect(() => {
    let active = true;
    loadAnalytics().then((result) => {
      if (active) setPayload(result);
    });
    return () => {
      active = false;
    };
  }, []);

  // Invalidate cache & re-fetch saat ada event order/review/product update
  useEffect(() => {
    const onUpdate = () => {
      invalidateCache();
      loadAnalytics().then((result) => setPayload(result));
    };
    window.addEventListener(ORDERS_UPDATED_EVENT, onUpdate);
    window.addEventListener(REVIEWS_UPDATED_EVENT, onUpdate);
    window.addEventListener(PRODUCTS_UPDATED_EVENT, onUpdate);
    return () => {
      window.removeEventListener(ORDERS_UPDATED_EVENT, onUpdate);
      window.removeEventListener(REVIEWS_UPDATED_EVENT, onUpdate);
      window.removeEventListener(PRODUCTS_UPDATED_EVENT, onUpdate);
    };
  }, []);

  return payload;
}
