/**
 * Agregasi analytics admin yang murni dan dapat diuji.
 *
 * Definisi yang dipakai (tidak mengarang status baru):
 * - total pesanan = jumlah baris orders yang dibuat dalam jendela WIB.
 * - pesanan dibayar = `payment_status === 'paid'`.
 * - pendapatan = jumlah `total_price` pesanan berstatus `paid`; nilai yang
 *   bukan angka finite tidak dijumlahkan agar tidak menghasilkan NaN.
 *
 * Route tetap membaca SEMUA baris yang relevan (dengan pagination), sehingga
 * angka tidak berasal dari sampel halaman PostgREST.
 */

import {
  DAY_MS,
  formatWibDateOnly,
  startOfDayWib,
  startOfDaysWindowWib,
  wibDayKey,
} from './wib-time.ts';
import type { ReportFilterSeverity, ReportFilterStatus } from './report-filters.ts';

export const ANALYTICS_RANGE_DAYS = [7, 14, 30, 90] as const;
export type AnalyticsRangeDays = (typeof ANALYTICS_RANGE_DAYS)[number];
export const DEFAULT_ANALYTICS_RANGE_DAYS: AnalyticsRangeDays = 14;

/**
 * Parse parameter `range`. String kosong memakai default; nilai di luar
 * allowlist mengembalikan null agar route menjawab 400, bukan menghitung
 * periode yang tidak disepakati.
 */
export function parseAnalyticsRangeDays(
  raw: string | null | undefined
): AnalyticsRangeDays | null {
  if (raw === null || raw === undefined || raw.trim() === '') {
    return DEFAULT_ANALYTICS_RANGE_DAYS;
  }
  const value = Number(raw);
  return (ANALYTICS_RANGE_DAYS as readonly number[]).includes(value)
    ? (value as AnalyticsRangeDays)
    : null;
}

export interface OrderAnalyticsSource {
  created_at?: unknown;
  total_price?: unknown;
  payment_status?: unknown;
}

export interface OrderAnalyticsPoint {
  date: string;
  orders: number;
  paidOrders: number;
  revenue: number;
}

export interface OrderAnalyticsSummary {
  rangeDays: AnalyticsRangeDays;
  from: string;
  to: string;
  total: number;
  paid: number;
  failed: number;
  revenue: number;
  revenueToday: number;
  revenueYesterday: number;
  revenue7d: number;
  byDay: OrderAnalyticsPoint[];
}

function isPaid(source: OrderAnalyticsSource): boolean {
  return source.payment_status === 'paid';
}

function paidAmount(source: OrderAnalyticsSource): number | null {
  if (!isPaid(source)) return null;
  return typeof source.total_price === 'number' && Number.isFinite(source.total_price)
    ? source.total_price
    : null;
}

/**
 * Hitung total dan tren harian dari baris orders yang sudah lengkap.
 *
 * `now` dapat diinjeksi untuk tes. Baris di luar jendela atau dengan timestamp
 * tidak valid diabaikan — query route tetap membatasi rentang, ini hanya jaring
 * pengaman untuk kontrak data yang rusak.
 */
export function buildOrderAnalytics(
  rows: readonly OrderAnalyticsSource[],
  rangeDays: AnalyticsRangeDays,
  now: Date | number = Date.now()
): OrderAnalyticsSummary {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const safeNow = Number.isFinite(nowMs) ? nowMs : Date.now();
  const startMs = startOfDaysWindowWib(rangeDays, safeNow);
  const startToday = startOfDayWib(safeNow);
  const startYesterday = startToday - DAY_MS;
  const start7d = startOfDaysWindowWib(7, safeNow);

  const trend = new Map<string, OrderAnalyticsPoint>();
  for (let i = rangeDays - 1; i >= 0; i -= 1) {
    const date = formatWibDateOnly(safeNow - i * DAY_MS);
    if (date) trend.set(date, { date, orders: 0, paidOrders: 0, revenue: 0 });
  }

  let total = 0;
  let paid = 0;
  let failed = 0;
  let revenue = 0;
  let revenueToday = 0;
  let revenueYesterday = 0;
  let revenue7d = 0;

  for (const row of rows) {
    if (typeof row.created_at !== 'string') continue;
    const timestamp = Date.parse(row.created_at);
    if (!Number.isFinite(timestamp) || timestamp < startMs || timestamp > safeNow) continue;

    const key = wibDayKey(timestamp);
    const bucket = key ? trend.get(key) : null;
    if (!bucket) continue;

    total += 1;
    bucket.orders += 1;

    if (row.payment_status === 'failed') failed += 1;

    if (isPaid(row)) {
      paid += 1;
      bucket.paidOrders += 1;
      const amount = paidAmount(row);
      if (amount !== null) {
        bucket.revenue += amount;
        revenue += amount;
        if (timestamp >= startToday) revenueToday += amount;
        else if (timestamp >= startYesterday) revenueYesterday += amount;
        if (timestamp >= start7d) revenue7d += amount;
      }
    }
  }

  return {
    rangeDays,
    from: new Date(startMs).toISOString(),
    to: new Date(safeNow).toISOString(),
    total,
    paid,
    failed,
    revenue,
    revenueToday,
    revenueYesterday,
    revenue7d,
    byDay: Array.from(trend.values()),
  };
}

export interface AdminAnalyticsReportCounts {
  total: number;
  byStatus: Record<ReportFilterStatus, number>;
  bySeverity: Record<ReportFilterSeverity | 'unknown', number>;
}

export interface AdminAnalyticsData {
  generatedAt: string;
  rangeDays: AnalyticsRangeDays;
  from: string;
  to: string;
  orders: {
    total: number;
    paid: number;
    failed: number;
    revenue: number;
    revenueToday: number;
    revenueYesterday: number;
    revenue7d: number;
    byDay: OrderAnalyticsPoint[];
  };
  reports: AdminAnalyticsReportCounts;
}
