export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
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
export function parseSellerReportPeriod(raw: string | null | undefined): SellerReportPeriod {
    const value = (raw ?? '').trim();
    const found = SELLER_REPORT_PERIODS.find((option) => option.value === value);
    return found ? found.value : '30-hari';
}
export function sellerReportPeriodDays(period: SellerReportPeriod): number | null {
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
export interface SellerReportOrder {
    orderCode: string;
    createdAt: string;
    productName: string;
    quantity: number;
    total: number;
    orderStatus?: string | null;
    status?: string | null;
}
const CANCELLED_PHASES = new Set(['cancelled', 'refunded', 'failed']);
export function isCancelledReportOrder(order: SellerReportOrder): boolean {
    const orderStatus = (order.orderStatus ?? '').trim().toLowerCase();
    const lifecycle = (order.status ?? '').trim().toLowerCase();
    return CANCELLED_PHASES.has(orderStatus) || lifecycle === 'cancelled';
}
export function startOfWibDay(ms: number): number {
    const shifted = new Date(ms + WIB_OFFSET_MS);
    return (Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - WIB_OFFSET_MS);
}
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
export function formatReportDayLabel(dayKey: string): string {
    const [year, month, day] = dayKey.split('-');
    const monthIndex = Number(month) - 1;
    if (!year || !Number.isFinite(monthIndex) || !MONTH_SHORT[monthIndex]) {
        return dayKey;
    }
    return `${Number(day)} ${MONTH_SHORT[monthIndex]}`;
}
export function formatReportMonthLabel(monthKey: string): string {
    const [year, month] = monthKey.split('-');
    const monthIndex = Number(month) - 1;
    if (!year || !Number.isFinite(monthIndex) || !MONTH_LONG[monthIndex]) {
        return monthKey;
    }
    return `${MONTH_LONG[monthIndex]} ${year}`;
}
export function formatReportRangeLabel(firstDayKey: string | null, lastDayKey: string | null): string | null {
    if (!firstDayKey || !lastDayKey)
        return null;
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
    activeDays: number;
    firstDayKey: string | null;
    lastDayKey: string | null;
    skipped: number;
}
export interface SellerReport {
    period: SellerReportPeriod;
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
export function buildSellerReport(orders: readonly SellerReportOrder[], options: {
    period: SellerReportPeriod;
    now?: number;
}): SellerReport {
    const period = options.period;
    const now = typeof options.now === 'number' && Number.isFinite(options.now)
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
        if (windowStart !== null && ts < windowStart)
            continue;
        const key = wibDayKey(ts);
        const bucket = dayBuckets.get(key) ?? emptyBucket();
        addToBucket(bucket, order);
        dayBuckets.set(key, bucket);
    }
    if (days !== null) {
        for (let i = days - 1; i >= 0; i -= 1) {
            const key = wibDayKey(todayStart - i * DAY_MS);
            if (!dayBuckets.has(key))
                dayBuckets.set(key, emptyBucket());
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
const SAFE_FILTER_VALUE = /^[A-Za-z0-9._-]+$/;
export function buildSellerOrderFilter(umkm: {
    id?: string | null;
    slug?: string | null;
}): string | null {
    const parts: string[] = [];
    const slug = (umkm.slug ?? '').trim();
    const id = (umkm.id ?? '').trim();
    const safeSlug = slug && SAFE_FILTER_VALUE.test(slug) ? slug : null;
    const safeId = id && SAFE_FILTER_VALUE.test(id) ? id : null;
    if (safeSlug)
        parts.push(`vendor_slug.eq.${safeSlug}`);
    if (safeId)
        parts.push(`vendor_slug.eq.${safeId}`);
    if (safeId)
        parts.push(`umkm_id.eq.${safeId}`);
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
export function buildSellerReportSheets(report: SellerReport): SellerReportSheet[] {
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
export function sellerReportFilename(period: SellerReportPeriod, options: {
    storeSlug?: string | null;
    now?: number;
} = {}): string {
    const days = sellerReportPeriodDays(period);
    const scope = days === null ? 'semua' : `${days}-hari`;
    const now = typeof options.now === 'number' && Number.isFinite(options.now)
        ? options.now
        : Date.now();
    const slug = sanitizeSlug(options.storeSlug);
    const prefix = slug ? `laporan-penjualan-${slug}` : 'laporan-penjualan';
    return `${prefix}-${scope}-${wibDayKey(now)}.xlsx`;
}
