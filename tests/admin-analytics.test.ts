import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildOrderAnalytics, parseAnalyticsRangeDays, type OrderAnalyticsSource, } from '../lib/admin-analytics.ts';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}
test('parseAnalyticsRangeDays: default dan allowlist eksplisit', () => {
    assert.equal(parseAnalyticsRangeDays(null), 14);
    assert.equal(parseAnalyticsRangeDays(undefined), 14);
    assert.equal(parseAnalyticsRangeDays(''), 14);
    assert.equal(parseAnalyticsRangeDays('7'), 7);
    assert.equal(parseAnalyticsRangeDays('14'), 14);
    assert.equal(parseAnalyticsRangeDays('30'), 30);
    assert.equal(parseAnalyticsRangeDays('90'), 90);
    assert.equal(parseAnalyticsRangeDays(' 30 '), 30);
    for (const invalid of ['15', '0', '-7', '7.5', 'abc', '365']) {
        assert.equal(parseAnalyticsRangeDays(invalid), null, `range ${invalid} harus ditolak`);
    }
});
test('buildOrderAnalytics: batas hari WIB, pembayaran, dan tren harian', () => {
    const now = Date.parse('2026-10-27T03:00:00.000Z');
    const rows: OrderAnalyticsSource[] = [
        { created_at: '2026-10-20T16:59:59.000Z', total_price: 999000, payment_status: 'paid' },
        { created_at: '2026-10-20T17:00:00.000Z', total_price: 100000, payment_status: 'paid' },
        { created_at: '2026-10-25T16:59:59.000Z', total_price: 20000, payment_status: 'paid' },
        { created_at: '2026-10-25T17:00:00.000Z', total_price: 30000, payment_status: 'paid' },
        { created_at: '2026-10-26T16:59:59.000Z', total_price: 50000, payment_status: 'failed' },
        { created_at: '2026-10-26T17:00:00.000Z', total_price: 40000, payment_status: 'paid' },
        { created_at: '2026-10-27T01:00:00.000Z', total_price: '70000', payment_status: 'paid' },
        { created_at: '2026-10-27T02:00:00.000Z', total_price: 60000, payment_status: 'unpaid' },
        { created_at: '2026-10-27T02:59:59.000Z', total_price: 50000, payment_status: 'paid' },
        { created_at: '2026-10-27T03:00:01.000Z', total_price: 80000, payment_status: 'paid' },
        { created_at: 'bukan-tanggal', total_price: 10000, payment_status: 'paid' },
    ];
    const result = buildOrderAnalytics(rows, 7, now);
    assert.equal(result.total, 8);
    assert.equal(result.paid, 6);
    assert.equal(result.failed, 1);
    assert.equal(result.revenue, 240000);
    assert.equal(result.revenueToday, 90000);
    assert.equal(result.revenueYesterday, 30000);
    assert.equal(result.revenue7d, 240000);
    assert.equal(result.from, '2026-10-20T17:00:00.000Z');
    assert.equal(result.to, '2026-10-27T03:00:00.000Z');
    assert.equal(result.byDay.length, 7);
    assert.deepEqual(result.byDay.map((point) => point.date), [
        '2026-10-21',
        '2026-10-22',
        '2026-10-23',
        '2026-10-24',
        '2026-10-25',
        '2026-10-26',
        '2026-10-27',
    ]);
    const byDate = new Map(result.byDay.map((point) => [point.date, point]));
    assert.deepEqual(byDate.get('2026-10-26'), {
        date: '2026-10-26',
        orders: 2,
        paidOrders: 1,
        revenue: 30000,
    });
    assert.deepEqual(byDate.get('2026-10-27'), {
        date: '2026-10-27',
        orders: 4,
        paidOrders: 3,
        revenue: 90000,
    });
});
test('buildOrderAnalytics: data kosong menghasilkan nol yang eksplisit', () => {
    const now = Date.parse('2026-10-27T03:00:00.000Z');
    const result = buildOrderAnalytics([], 14, now);
    assert.equal(result.total, 0);
    assert.equal(result.paid, 0);
    assert.equal(result.failed, 0);
    assert.equal(result.revenue, 0);
    assert.equal(result.byDay.length, 14);
    assert.ok(result.byDay.every((point) => point.orders === 0 && point.revenue === 0));
});
test('route analytics: auth admin, pagination penuh, count exact, tanpa service role', () => {
    const source = readProjectFile('app/api/admin/analytics/route.ts');
    assert.match(source, /getAdminUser/);
    assert.match(source, /createAuthedServerClient/);
    assert.match(source, /fetchAllPages/);
    assert.match(source, /count: 'exact'/);
    assert.match(source, /parseAnalyticsRangeDays/);
    assert.match(source, /status: 413/);
    assert.match(source, /exact count tidak tersedia/);
    assert.doesNotMatch(source, /createServiceClient|service_role|SERVICE_ROLE/);
});
test('dashboard route tidak lagi menjumlahkan satu halaman PostgREST', () => {
    const source = readProjectFile('app/api/admin/dashboard/route.ts');
    assert.match(source, /fetchAllPages/);
    assert.match(source, /warning_user_summary/);
    assert.match(source, /count: 'exact'/);
    assert.match(source, /exact count tidak tersedia/);
    assert.doesNotMatch(source, /select\('user_id, warning_level'\)/);
    assert.doesNotMatch(source, /select\('id, start_at, end_at'\)/);
});
test('UI analytics: loading, error, forbidden, dan nol yang eksplisit tersedia', () => {
    const source = readProjectFile('app/components/admin/dashboard/dashboard-analytics.tsx');
    assert.match(source, /AnalyticsSkeleton/);
    assert.match(source, /role="status"/);
    assert.match(source, /AdminErrorState/);
    assert.match(source, /AdminForbiddenState/);
    assert.match(source, /Belum ada pesanan atau laporan pada periode ini/);
    assert.match(source, /role="group"/);
    assert.match(source, /AnalyticsRangePicker/);
    assert.match(source, /Bila periode ini terlalu besar, pilih rentang yang lebih pendek/);
});
test('UI analytics: pendapatan dijelaskan sebagai nilai bruto, bukan laba bersih', () => {
    const analytics = readProjectFile('app/components/admin/dashboard/dashboard-analytics.tsx');
    const trends = readProjectFile('app/components/admin/dashboard/dashboard-trends.tsx');
    const kpi = readProjectFile('app/components/admin/dashboard/dashboard-kpi-grid.tsx');
    assert.match(analytics, /Pendapatan bruto pesanan dibayar/);
    assert.match(analytics, /bukan laba bersih/i);
    assert.match(trends, /Nilai bruto pesanan/);
    assert.match(kpi, /Pendapatan kotor hari ini/);
    assert.match(kpi, /bukan laba bersih/i);
});
test('client analytics memakai wrapper auth dengan retry 401 resmi', () => {
    const source = readProjectFile('lib/admin-dashboard.ts');
    assert.match(source, /fetchAdminWithAuth/);
    assert.doesNotMatch(source, /getAdminAuthHeader/);
});
