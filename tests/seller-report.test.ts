import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DAY_MS, buildSellerOrderFilter, buildSellerReport, buildSellerReportSheets, formatReportDayLabel, formatReportMonthLabel, formatReportRangeLabel, parseSellerReportPeriod, sellerReportFilename, startOfWibDay, wibDayKey, type SellerReportOrder, } from '../lib/seller-report.ts';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}
const NOW = Date.parse('2026-11-04T05:00:00.000Z');
function makeOrder(partial: Partial<SellerReportOrder> & {
    createdAt: string;
}): SellerReportOrder {
    return {
        orderCode: 'RB-1',
        productName: 'Nasi Box',
        quantity: 1,
        total: 20000,
        orderStatus: 'completed',
        status: 'completed',
        ...partial,
    };
}
test('parseSellerReportPeriod: empat rentang dikenal, sisanya jatuh ke 30-hari', () => {
    assert.equal(parseSellerReportPeriod('7-hari'), '7-hari');
    assert.equal(parseSellerReportPeriod('14-hari'), '14-hari');
    assert.equal(parseSellerReportPeriod('30-hari'), '30-hari');
    assert.equal(parseSellerReportPeriod('semua'), 'semua');
    assert.equal(parseSellerReportPeriod('semua-hari'), '30-hari');
    assert.equal(parseSellerReportPeriod(''), '30-hari');
    assert.equal(parseSellerReportPeriod(null), '30-hari');
});
test('batas hari memakai WIB, bukan UTC', () => {
    assert.equal(wibDayKey(Date.parse('2026-11-03T16:30:00.000Z')), '2026-11-03');
    assert.equal(wibDayKey(Date.parse('2026-11-03T17:30:00.000Z')), '2026-11-04');
    const report = buildSellerReport([
        makeOrder({ createdAt: '2026-11-03T16:30:00.000Z', quantity: 2, total: 30000 }),
        makeOrder({ createdAt: '2026-11-03T17:30:00.000Z', quantity: 3, total: 45000 }),
    ], { period: '7-hari', now: NOW });
    const day3 = report.rows.find((row) => row.dayKey === '2026-11-03');
    const day4 = report.rows.find((row) => row.dayKey === '2026-11-04');
    assert.ok(day3 && day4);
    assert.equal(day3.porsi, 2);
    assert.equal(day3.revenue, 30000);
    assert.equal(day4.porsi, 3);
    assert.equal(day4.revenue, 45000);
});
test('rentang 7 hari menghasilkan tepat 7 baris, termasuk hari tanpa pesanan', () => {
    const report = buildSellerReport([makeOrder({ createdAt: '2026-11-04T02:00:00.000Z' })], {
        period: '7-hari',
        now: NOW,
    });
    assert.equal(report.rows.length, 7);
    assert.equal(report.rows[0].dayKey, '2026-10-29');
    assert.equal(report.rows[6].dayKey, '2026-11-04');
    assert.equal(report.rows[0].orders, 0);
    assert.equal(report.summary.activeDays, 1);
});
test("rentang 'semua' memuat riwayat jauh sebelum 30 hari", () => {
    const oldDay = '2025-09-20';
    const oldTs = Date.parse('2025-09-20T04:00:00.000Z');
    const orders = [
        makeOrder({ createdAt: new Date(oldTs).toISOString(), quantity: 4, total: 80000 }),
        makeOrder({ createdAt: '2026-11-04T02:00:00.000Z' }),
    ];
    const semua = buildSellerReport(orders, { period: 'semua', now: NOW });
    assert.equal(semua.summary.porsi, 5);
    assert.equal(semua.summary.revenue, 100000);
    assert.equal(semua.summary.firstDayKey, oldDay);
    assert.equal(semua.summary.lastDayKey, '2026-11-04');
    assert.equal(semua.summary.activeDays, 2);
    assert.equal(semua.rows.length, 2);
    const thirty = buildSellerReport([makeOrder({ createdAt: new Date(NOW - 60 * DAY_MS).toISOString() })], { period: '30-hari', now: NOW });
    assert.equal(thirty.summary.orders, 0);
    assert.equal(thirty.rows.length, 30);
    const thirtySameDay = buildSellerReport([makeOrder({ createdAt: new Date(NOW - 29 * DAY_MS).toISOString() })], { period: '30-hari', now: NOW });
    assert.equal(thirtySameDay.summary.orders, 1);
});
test('pesanan dibatalkan dihitung terpisah dan tidak menambah porsi/pendapatan', () => {
    const report = buildSellerReport([
        makeOrder({ createdAt: '2026-11-04T02:00:00.000Z', quantity: 2, total: 40000 }),
        makeOrder({
            createdAt: '2026-11-04T03:00:00.000Z',
            quantity: 9,
            total: 180000,
            orderStatus: 'cancelled',
            status: 'cancelled',
        }),
    ], { period: '7-hari', now: NOW });
    assert.equal(report.summary.orders, 2);
    assert.equal(report.summary.cancelled, 1);
    assert.equal(report.summary.porsi, 2);
    assert.equal(report.summary.revenue, 40000);
    const today = report.rows.find((row) => row.dayKey === '2026-11-04');
    assert.ok(today);
    assert.equal(today.orders, 2);
    assert.equal(today.cancelled, 1);
    assert.equal(today.porsi, 2);
});
test('tanggal tidak terbaca dilaporkan sebagai skipped, bukan dibuang diam-diam', () => {
    const report = buildSellerReport([
        makeOrder({ createdAt: 'bukan-tanggal' }),
        makeOrder({ createdAt: '2026-11-04T02:00:00.000Z' }),
    ], { period: 'semua', now: NOW });
    assert.equal(report.summary.skipped, 1);
    assert.equal(report.summary.orders, 1);
});
test('rekap bulanan mengelompokkan hari dan berurutan naik', () => {
    const report = buildSellerReport([
        makeOrder({ createdAt: '2026-09-30T02:00:00.000Z', quantity: 1, total: 10000 }),
        makeOrder({ createdAt: '2026-10-01T02:00:00.000Z', quantity: 2, total: 20000 }),
        makeOrder({ createdAt: '2026-10-02T02:00:00.000Z', quantity: 3, total: 30000 }),
    ], { period: 'semua', now: NOW });
    assert.deepEqual(report.months.map((month) => month.monthKey), ['2026-09', '2026-10']);
    assert.equal(report.months[1].label, 'Oktober 2026');
    assert.equal(report.months[1].orders, 2);
    assert.equal(report.months[1].porsi, 5);
    assert.equal(report.months[1].revenue, 50000);
});
test('label hari/bulan tidak bergantung pada locale mesin', () => {
    assert.equal(formatReportDayLabel('2026-11-04'), '4 Nov');
    assert.equal(formatReportDayLabel('2026-01-01'), '1 Jan');
    assert.equal(formatReportDayLabel('rusak'), 'rusak');
    assert.equal(formatReportMonthLabel('2026-11'), 'November 2026');
    assert.equal(formatReportMonthLabel('2026-13'), '2026-13');
});
test('startOfWibDay mengembalikan awal hari WIB', () => {
    assert.equal(startOfWibDay(Date.parse('2026-11-04T05:00:00.000Z')), Date.parse('2026-11-03T17:00:00.000Z'));
});
test('filter PostgREST mencocokkan slug maupun id pada vendor_slug', () => {
    const safe = buildSellerOrderFilter({
        id: '11111111-2222-3333-4444-555555555555',
        slug: 'dapur-ibu-tini',
    });
    assert.ok(safe);
    assert.ok(safe.includes('vendor_slug.eq.dapur-ibu-tini'));
    assert.ok(safe.includes('vendor_slug.eq.11111111-2222-3333-4444-555555555555'));
    assert.ok(safe.includes('umkm_id.eq.11111111-2222-3333-4444-555555555555'));
});
test('filter PostgREST menolak nilai yang bisa mengubah struktur query', () => {
    const injected = buildSellerOrderFilter({
        id: 'ok-id',
        slug: 'x,y),(z',
    });
    assert.equal(injected, 'vendor_slug.eq.ok-id,umkm_id.eq.ok-id');
    assert.ok(!injected.includes('x,y'));
    assert.equal(buildSellerOrderFilter({ id: 'a,b', slug: '%20' }), null);
    assert.equal(buildSellerOrderFilter({}), null);
});
test('label rentang memakai nama bulan Indonesia, bukan tanggal ISO', () => {
    assert.equal(formatReportRangeLabel('2026-10-06', '2026-11-04'), '6 Okt – 4 Nov 2026');
    assert.equal(formatReportRangeLabel('2026-11-04', '2026-11-04'), '4 Nov 2026');
    assert.equal(formatReportRangeLabel('2025-09-20', '2026-11-04'), '20 Sep 2025 – 4 Nov 2026');
    assert.equal(formatReportRangeLabel(null, null), null);
});
test('nama berkas memuat rentang dan tanggal WIB', () => {
    assert.equal(sellerReportFilename('semua', {
        storeSlug: 'Dapur Ibu Tini',
        now: Date.parse('2026-11-04T05:00:00.000Z'),
    }), 'laporan-penjualan-dapur-ibu-tini-semua-2026-11-04.xlsx');
    assert.equal(sellerReportFilename('7-hari', {
        storeSlug: null,
        now: Date.parse('2026-11-04T05:00:00.000Z'),
    }), 'laporan-penjualan-7-hari-2026-11-04.xlsx');
});
test('sheet Excel: rekap bulanan lebih dulu, lalu rincian harian, keduanya ber-TOTAL', () => {
    const report = buildSellerReport([
        makeOrder({ createdAt: '2026-10-01T02:00:00.000Z', quantity: 2, total: 20000 }),
        makeOrder({ createdAt: '2026-11-04T02:00:00.000Z', quantity: 3, total: 45000 }),
    ], { period: 'semua', now: NOW });
    const sheets = buildSellerReportSheets(report);
    assert.deepEqual(sheets.map((sheet) => sheet.name), ['Rekap Bulanan', 'Detail Harian']);
    const monthly = sheets[0];
    assert.equal(monthly.rows.length, report.months.length + 1);
    assert.deepEqual(monthly.rows[monthly.rows.length - 1], [
        'TOTAL',
        report.summary.orders,
        report.summary.porsi,
        report.summary.revenue,
        report.summary.cancelled,
    ]);
    const daily = sheets[1];
    assert.equal(daily.rows.length, report.rows.length + 1);
    assert.equal(daily.rows[0][0], '2026-10-01');
    assert.equal(daily.rows[1][0], '2026-11-04');
    assert.equal(typeof daily.rows[0][2], 'number');
});
test('penulis XLSX mendukung banyak sheet tanpa memutus jalur satu-sheet', () => {
    const source = readProjectFile('lib/xlsx.ts');
    assert.match(source, /export function buildXlsxWorkbook/);
    assert.match(source, /export function buildXlsx\(/);
    assert.match(source, /worksheets\/sheet\$\{index \+ 1\}\.xml/);
    assert.match(source, /sheetId="\$\{index \+ 1\}"/);
    assert.match(source, /export function buildXlsx\(sheet: XlsxSheet\): Buffer \{\s*\n\s*return buildXlsxWorkbook/);
});
test('route ekspor penjual: otorisasi server, tanpa service role, toko dari token', () => {
    const source = readProjectFile('app/api/seller/reports/export/route.ts');
    assert.match(source, /getUserFromBearer/);
    assert.match(source, /createAuthedServerClient/);
    assert.match(source, /eq\('user_id', user\.id\)/);
    assert.match(source, /buildSellerOrderFilter/);
    assert.match(source, /buildSellerReport/);
    assert.match(source, /buildSellerReportSheets/);
    assert.match(source, /buildXlsxWorkbook/);
    assert.match(source, /fetchAllPages/);
    assert.match(source, /EXPORT_MAX_ROWS/);
    assert.match(source, /status: 401/);
    assert.match(source, /status: 403/);
    assert.match(source, /status: 204/);
    assert.ok(source.includes("'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'"));
    assert.ok(source.includes('Content-Disposition'));
    assert.match(source, /X-Export-Row-Count/);
    assert.doesNotMatch(source, /createServiceClient|service_role|SERVICE_ROLE/);
    assert.doesNotMatch(source, /searchParams\.get\('(umkm|store|toko|vendor)/);
});
test('tabel laporan tidak memakai kelas token yang tidak ada di tema', () => {
    const table = readProjectFile('app/components/seller/dashboard-penjual/SellerReportTable.tsx');
    assert.doesNotMatch(table, /divide-border-100|fill-border-100/);
    assert.match(table, /divide-border\b/);
});
test('kartu laporan memakai rentang penuh, bukan potongan 30 hari', () => {
    const card = readProjectFile('app/components/seller/dashboard-penjual/DetailedReportCard.tsx');
    const page = readProjectFile('app/(app)/dashboard/penjual/[storeId]/page.tsx');
    const hook = readProjectFile('hooks/seller/use-seller-analytics.ts');
    assert.match(card, /SELLER_REPORT_PERIODS/);
    assert.match(card, /buildSellerReport\(/);
    assert.match(card, /downloadSellerReportExcel/);
    assert.match(card, /SellerReportExportError/);
    assert.doesNotMatch(card, /days30/);
    assert.doesNotMatch(card, /slice\(-count\)/);
    assert.doesNotMatch(page, /DetailedReportCard period=/);
    assert.match(hook, /days30/);
});
