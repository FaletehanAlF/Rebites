/**
 * Laporan penjualan penjual — agregasi MURNI.
 *
 * Satu sumber angka untuk dua tempat: tabel di dashboard penjual dan berkas
 * Excel yang diunduh penjual. Bila keduanya menghitung sendiri-sendiri,
 * cepat atau lambat angkanya berbeda dan penjual berhenti mempercayai
 * laporannya.
 *
 * Batas hari memakai WIB (UTC+7, tanpa daylight saving) supaya "hari ini"
 * berarti hari kalender Indonesia, bukan hari menurut jam server.
 *
 * Aturan angka:
 * - Pesanan yang dibatalkan TIDAK menambah porsi maupun pendapatan; ia
 *   dihitung di kolom terpisah supaya tetap terlihat, bukan disembunyikan.
 * - Pendapatan memakai `orders.total_price` apa adanya (sudah termasuk
 *   ongkir dan potongan koin yang benar-benar dibayar pembeli).
 *
 * Modul ini SENGAJA tidak mengimpor apa pun: tesnya dijalankan lewat
 * `node --test` (type-stripping ESM) yang menolak impor relatif tanpa
 * ekstensi — lihat tests/seller-report.test.ts.
 */

export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Rentang laporan.
 *
 * 'semua' berarti sejak pesanan PERTAMA toko itu masuk — bukan sejak 30 hari
 * — supaya penjual bisa melihat seluruh riwayatnya sejak awal berjualan.
 */
export type SellerReportPeriod = '7-hari' | '14-hari' | '30-hari' | 'semua';

export interface SellerReportPeriodOption {
  value: SellerReportPeriod;
  label: string;
}

export const SELLER_REPORT_PERIODS: readonly SellerReportPeriodOption[] = [
  { value: '7-hari', label: '7 Hari' },
  { value: '14-hari', label: '14 Hari' },
  { value: '30-hari', label: '30 Hari' },
  { value: 'semua', label: 'Semua' },
];

/**
 * Parse parameter `periode` dari URL.
 *
 * Nilai tak dikenal jatuh ke '30-hari' (bukan 'semua'): permintaan yang cacat
 * tidak boleh diam-diam memaksa ekspor seluruh riwayat toko.
 */
export function parseSellerReportPeriod(
  raw: string | null | undefined
): SellerReportPeriod {
  const value = (raw ?? '').trim();
  const found = SELLER_REPORT_PERIODS.find((option) => option.value === value);
  return found ? found.value : '30-hari';
}

/** Jumlah hari rentang, atau null untuk 'semua'. */
export function sellerReportPeriodDays(
  period: SellerReportPeriod
): number | null {
  switch (period) {
    case '7-hari':
      return 7;
    case '14-hari':
      return 14;
    case '30-hari':
      return 30;
    default:
      return null;
  }
}

/** Bentuk pesanan yang dibutuhkan laporan (dipetakan dari `StoredOrder`/baris `orders`). */
export interface SellerReportOrder {
  orderCode: string;
  createdAt: string;
  productName: string;
  quantity: number;
  total: number;
  /** `orders.order_status` — sumber kebenaran fase operasional. */
  orderStatus?: string | null;
  /** `orders.lifecycle_status` — 'ongoing' | 'completed'. */
  status?: string | null;
}

const CANCELLED_PHASES = new Set(['cancelled', 'refunded', 'failed']);

/** Pesanan batal tidak dihitung sebagai penjualan. */
export function isCancelledReportOrder(order: SellerReportOrder): boolean {
  const orderStatus = (order.orderStatus ?? '').trim().toLowerCase();
  const lifecycle = (order.status ?? '').trim().toLowerCase();
  return CANCELLED_PHASES.has(orderStatus) || lifecycle === 'cancelled';
}

/** Awal hari WIB (epoch ms) yang memuat `ms`. */
export function startOfWibDay(ms: number): number {
  const shifted = new Date(ms + WIB_OFFSET_MS);
  return (
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate()
    ) - WIB_OFFSET_MS
  );
}

/** Kunci hari WIB `YYYY-MM-DD`. */
export function wibDayKey(ms: number): string {
  return new Date(ms + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const MONTH_LONG = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/**
 * Label hari untuk layar, mis. `4 Nov`.
 *
 * Nama bulan ditulis eksplisit (bukan lewat locale) supaya hasilnya sama di
 * server, di browser, dan di tes.
 */
export function formatReportDayLabel(dayKey: string): string {
  const [year, month, day] = dayKey.split('-');
  const monthIndex = Number(month) - 1;
  if (!year || !Number.isFinite(monthIndex) || !MONTH_SHORT[monthIndex]) {
    return dayKey;
  }
  return `${Number(day)} ${MONTH_SHORT[monthIndex]}`;
}

/** Label bulan untuk layar, mis. `November 2026`. */
export function formatReportMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const monthIndex = Number(month) - 1;
  if (!year || !Number.isFinite(monthIndex) || !MONTH_LONG[monthIndex]) {
    return monthKey;
  }
  return `${MONTH_LONG[monthIndex]} ${year}`;
}

/**
 * Label rentang untuk layar, mis. `6 Okt – 4 Nov 2026`.
 *
 * Tahun ditulis sekali saja bila kedua ujungnya sama tahun; rentang yang
 * melewati pergantian tahun menuliskan tahun pada kedua ujung agar tidak
 * menimbulkan tebakan.
 */
export function formatReportRangeLabel(
  firstDayKey: string | null,
  lastDayKey: string | null
): string | null {
  if (!firstDayKey || !lastDayKey) return null;
  const firstYear = firstDayKey.split('-')[0] ?? '';
  const lastYear = lastDayKey.split('-')[0] ?? '';
  if (firstDayKey === lastDayKey) {
    return `${formatReportDayLabel(firstDayKey)} ${firstYear}`.trim();
  }
  if (firstYear === lastYear) {
    return `${formatReportDayLabel(firstDayKey)} – ${formatReportDayLabel(lastDayKey)} ${lastYear}`.trim();
  }
  return `${formatReportDayLabel(firstDayKey)} ${firstYear} – ${formatReportDayLabel(lastDayKey)} ${lastYear}`.trim();
}

export interface SellerReportDayRow {
  dayKey: string;
  /** Label siap tampil (`4 Nov`); berkas Excel memakai `dayKey`. */
  day: string;
  orders: number;
  porsi: number;
  revenue: number;
  cancelled: number;
}

export interface SellerReportMonthRow {
  monthKey: string;
  label: string;
  orders: number;
  porsi: number;
  revenue: number;
  cancelled: number;
}

export interface SellerReportSummary {
  orders: number;
  porsi: number;
  revenue: number;
  cancelled: number;
  /** Jumlah hari yang benar-benar ada pesanan masuk. */
  activeDays: number;
  /** Hari beraktivitas paling awal, atau null bila belum ada pesanan. */
  firstDayKey: string | null;
  lastDayKey: string | null;
  /**
   * Pesanan yang tanggalnya tidak terbaca. Dilaporkan, bukan dibuang diam-diam
   * — penghapusan tanpa jejak membuat total terlihat "benar" padahal kurang.
   */
  skipped: number;
}

export interface SellerReport {
  period: SellerReportPeriod;
  /** Urut naik (paling lama → terbaru); tampilan membalik urutannya sendiri. */
  rows: SellerReportDayRow[];
  months: SellerReportMonthRow[];
  summary: SellerReportSummary;
}

interface Bucket {
  orders: number;
  porsi: number;
  revenue: number;
  cancelled: number;
}

function emptyBucket(): Bucket {
  return { orders: 0, porsi: 0, revenue: 0, cancelled: 0 };
}

function addToBucket(bucket: Bucket, order: SellerReportOrder): void {
  bucket.orders += 1;
  if (isCancelledReportOrder(order)) {
    bucket.cancelled += 1;
    return;
  }
  bucket.porsi += Number.isFinite(order.quantity)
    ? Math.max(0, Math.trunc(order.quantity))
    : 0;
  bucket.revenue += Number.isFinite(order.total) ? order.total : 0;
}

/**
 * Bangun laporan dari daftar pesanan.
 *
 * Untuk rentang 7/14/30 hari, hari tanpa pesanan tetap muncul sebagai baris
 * nol supaya tabel selalu utuh sepanjang rentang yang dipilih. Untuk 'semua',
 * hanya hari beraktivitas yang muncul — deretan hari kosong sejak toko berdiri
 * hanya akan mengubur data yang dicari.
 */
export function buildSellerReport(
  orders: readonly SellerReportOrder[],
  options: { period: SellerReportPeriod; now?: number }
): SellerReport {
  const period = options.period;
  const now =
    typeof options.now === 'number' && Number.isFinite(options.now)
      ? options.now
      : Date.now();
  const days = sellerReportPeriodDays(period);
  const todayStart = startOfWibDay(now);
  const windowStart = days === null ? null : todayStart - (days - 1) * DAY_MS;

  const dayBuckets = new Map<string, Bucket>();
  let skipped = 0;

  for (const order of orders) {
    const ts = new Date(order.createdAt).getTime();
    if (!Number.isFinite(ts)) {
      skipped += 1;
      continue;
    }
    if (windowStart !== null && ts < windowStart) continue;
    const key = wibDayKey(ts);
    const bucket = dayBuckets.get(key) ?? emptyBucket();
    addToBucket(bucket, order);
    dayBuckets.set(key, bucket);
  }

  if (days !== null) {
    for (let i = days - 1; i >= 0; i -= 1) {
      const key = wibDayKey(todayStart - i * DAY_MS);
      if (!dayBuckets.has(key)) dayBuckets.set(key, emptyBucket());
    }
  }

  const rows: SellerReportDayRow[] = Array.from(dayBuckets.entries())
    .map(([dayKey, bucket]) => ({
      dayKey,
      day: formatReportDayLabel(dayKey),
      orders: bucket.orders,
      porsi: bucket.porsi,
      revenue: bucket.revenue,
      cancelled: bucket.cancelled,
    }))
    .sort((a, b) => (a.dayKey < b.dayKey ? -1 : a.dayKey > b.dayKey ? 1 : 0));

  const monthBuckets = new Map<string, Bucket>();
  for (const row of rows) {
    const monthKey = row.dayKey.slice(0, 7);
    const bucket = monthBuckets.get(monthKey) ?? emptyBucket();
    bucket.orders += row.orders;
    bucket.porsi += row.porsi;
    bucket.revenue += row.revenue;
    bucket.cancelled += row.cancelled;
    monthBuckets.set(monthKey, bucket);
  }

  const months: SellerReportMonthRow[] = Array.from(monthBuckets.entries())
    .map(([monthKey, bucket]) => ({
      monthKey,
      label: formatReportMonthLabel(monthKey),
      orders: bucket.orders,
      porsi: bucket.porsi,
      revenue: bucket.revenue,
      cancelled: bucket.cancelled,
    }))
    .sort((a, b) => (a.monthKey < b.monthKey ? -1 : a.monthKey > b.monthKey ? 1 : 0));

  const activeRows = rows.filter((row) => row.orders > 0);

  return {
    period,
    rows,
    months,
    summary: {
      orders: rows.reduce((sum, row) => sum + row.orders, 0),
      porsi: rows.reduce((sum, row) => sum + row.porsi, 0),
      revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
      cancelled: rows.reduce((sum, row) => sum + row.cancelled, 0),
      activeDays: activeRows.length,
      firstDayKey: activeRows[0]?.dayKey ?? null,
      lastDayKey: activeRows[activeRows.length - 1]?.dayKey ?? null,
      skipped,
    },
  };
}

/** Nilai yang aman disisipkan ke sintaks filter PostgREST. */
const SAFE_FILTER_VALUE = /^[A-Za-z0-9._-]+$/;

/**
 * Filter `orders` milik satu toko, untuk `.or()` PostgREST.
 *
 * `.or()` menyisipkan nilai MENTAH ke sintaks filter, sehingga koma, tanda
 * kurung, atau `%` di dalam slug/ID bisa mengubah arti query. Nilai di sini
 * karena itu divalidasi lebih dulu; nilai yang tidak lolos dibuang (bukan
 * di-escape), dan pemanggil menerima null bila tidak ada yang tersisa.
 *
 * `orders.vendor_slug` bisa berisi SLUG maupun ID UMKM — tergantung nilai
 * yang dipakai saat checkout — dan sebagian pesanan lama hanya punya
 * `vendor_slug` tanpa `umkm_id`. Karena itu ketiganya dicocokkan:
 * vendor_slug=song, vendor_slug=id, dan umkm_id=id. Tanpa pencocokan id pada
 * vendor_slug, pesanan checkout versi lama hilang dari laporan.
 */
export function buildSellerOrderFilter(umkm: {
  id?: string | null;
  slug?: string | null;
}): string | null {
  const parts: string[] = [];
  const slug = (umkm.slug ?? '').trim();
  const id = (umkm.id ?? '').trim();
  const safeSlug = slug && SAFE_FILTER_VALUE.test(slug) ? slug : null;
  const safeId = id && SAFE_FILTER_VALUE.test(id) ? id : null;

  if (safeSlug) parts.push(`vendor_slug.eq.${safeSlug}`);
  if (safeId) parts.push(`vendor_slug.eq.${safeId}`);
  if (safeId) parts.push(`umkm_id.eq.${safeId}`);

  return parts.length > 0 ? parts.join(',') : null;
}

export interface SellerReportColumn {
  header: string;
  width: number;
  wrap?: boolean;
}

export interface SellerReportSheet {
  name: string;
  columns: readonly SellerReportColumn[];
  rows: readonly (readonly (string | number | null)[])[];
}

const MONTHLY_COLUMNS: readonly SellerReportColumn[] = [
  { header: 'Bulan', width: 20, wrap: true },
  { header: 'Pesanan Masuk', width: 15 },
  { header: 'Porsi Terjual', width: 14 },
  { header: 'Pendapatan (Rp)', width: 18 },
  { header: 'Pesanan Dibatalkan', width: 20 },
];

const DAILY_COLUMNS: readonly SellerReportColumn[] = [
  { header: 'Tanggal', width: 14 },
  { header: 'Pesanan Masuk', width: 15 },
  { header: 'Porsi Terjual', width: 14 },
  { header: 'Pendapatan (Rp)', width: 18 },
  { header: 'Pesanan Dibatalkan', width: 20 },
];

/**
 * Susun isi berkas Excel: rekap per bulan lebih dulu (gambaran besar), lalu
 * rincian harian. Keduanya diakhiri baris TOTAL supaya penjual tidak perlu
 * menjumlahkan sendiri.
 *
 * Tanggal di berkas memakai `YYYY-MM-DD` (bukan `4 Nov`) agar bisa diurutkan
 * dan difilter sebagai tanggal di Excel.
 */
export function buildSellerReportSheets(
  report: SellerReport
): SellerReportSheet[] {
  const monthlyRows: (string | number)[][] = report.months.map((month) => [
    month.label,
    month.orders,
    month.porsi,
    month.revenue,
    month.cancelled,
  ]);
  monthlyRows.push([
    'TOTAL',
    report.summary.orders,
    report.summary.porsi,
    report.summary.revenue,
    report.summary.cancelled,
  ]);

  const dailyRows: (string | number)[][] = report.rows.map((row) => [
    row.dayKey,
    row.orders,
    row.porsi,
    row.revenue,
    row.cancelled,
  ]);
  dailyRows.push([
    'TOTAL',
    report.summary.orders,
    report.summary.porsi,
    report.summary.revenue,
    report.summary.cancelled,
  ]);

  return [
    { name: 'Rekap Bulanan', columns: MONTHLY_COLUMNS, rows: monthlyRows },
    { name: 'Detail Harian', columns: DAILY_COLUMNS, rows: dailyRows },
  ];
}

function sanitizeSlug(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

/** Nama berkas unduhan: `laporan-penjualan-<toko>-<rentang>-<tanggal>.xlsx`. */
export function sellerReportFilename(
  period: SellerReportPeriod,
  options: { storeSlug?: string | null; now?: number } = {}
): string {
  const days = sellerReportPeriodDays(period);
  const scope = days === null ? 'semua' : `${days}-hari`;
  const now =
    typeof options.now === 'number' && Number.isFinite(options.now)
      ? options.now
      : Date.now();
  const slug = sanitizeSlug(options.storeSlug);
  const prefix = slug ? `laporan-penjualan-${slug}` : 'laporan-penjualan';
  return `${prefix}-${scope}-${wibDayKey(now)}.xlsx`;
}
