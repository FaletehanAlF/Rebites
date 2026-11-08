import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
test('migrasi: dua tabel rekap, dedup lewat UNIQUE visitor_key', () => {
    const migration = readProjectFile('supabase/migrations/20261107000001_site_visitors.sql');
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.site_visitors/);
    assert.match(migration, /visitor_key text NOT NULL UNIQUE/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.site_visitor_days/);
    assert.match(migration, /PRIMARY KEY \(visitor_id, day\)/);
    assert.match(migration, /CREATE OR REPLACE FUNCTION public\.record_site_visit/);
    assert.match(migration, /ON CONFLICT \(visitor_key\) DO UPDATE/);
    assert.match(migration, /visit_count = sv\.visit_count \+ 1/);
    assert.match(migration, /CREATE OR REPLACE FUNCTION public\.get_visitor_stats/);
    assert.match(migration, /Akses ditolak\. Hanya admin\./);
    assert.match(migration, /interval '7 hours'/);
    assert.match(migration, /REVOKE EXECUTE ON FUNCTION public\.record_site_visit\(text, uuid\)\s+FROM PUBLIC, anon, authenticated;/);
    assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.record_site_visit\(text, uuid\) TO service_role;/);
});
test('route pencatat: POST saja, admin dilewati, dan selalu fail-open', () => {
    const route = readProjectFile('app/api/visitors/route.ts');
    assert.match(route, /export async function POST/);
    assert.doesNotMatch(route, /export async function GET/);
    assert.match(route, /skipped: 'admin'/);
    assert.match(route, /u:\$\{userId\}/);
    assert.match(route, /a:\$\{anonKey\}/);
    assert.match(route, /rpc\('record_site_visit'/);
    assert.match(route, /createServiceClient/);
    assert.match(route, /status: 202/);
    assert.doesNotMatch(route, /status: 500/);
});
test('route dasbor: verifikasi admin dulu, lalu rekap; belum terpasang = bukan error', () => {
    const route = readProjectFile('app/api/admin/visitors/route.ts');
    assert.match(route, /getAdminUser\(/);
    assert.match(route, /rpc\('get_visitor_stats'/);
    assert.match(route, /not_provisioned: true/);
    assert.match(route, /PGRST202' \|\| error\.code === '42883' \|\| error\.code === '42P01'/);
    assert.match(route, /RANGE_ALLOWLIST = \[7, 14, 30, 90\] as const/);
    assert.doesNotMatch(route, /createServiceClient/);
});
test('klien: fetchAdminWithAuth, penanda notProvisioned, dan angka aman', () => {
    const lib = readProjectFile('lib/admin-visitors.ts');
    assert.match(lib, /fetchAdminWithAuth/);
    assert.doesNotMatch(lib, /getAdminAuthHeader/);
    assert.match(lib, /instanceof AuthError/);
    assert.match(lib, /json\.not_provisioned === true/);
    assert.match(lib, /notProvisioned: true/);
    assert.match(lib, /\/api\/admin\/visitors\?/);
});
test('tracker: satu kali per sesi, id acak lokal, dan tidak pernah mengganggu halaman', () => {
    const tracker = readProjectFile('app/components/analytics/visitor-tracker.tsx');
    assert.match(tracker, /rebites\.visitor\.recorded/);
    assert.match(tracker, /sessionStorage/);
    assert.match(tracker, /rebites\.visitor\.key/);
    assert.match(tracker, /localStorage/);
    assert.match(tracker, /let sudahDijadwalkan = false/);
    assert.match(tracker, /if \(sudahDijadwalkan\)[\s\S]{0,20}return/);
    assert.match(tracker, /hostname === 'localhost'/);
    assert.match(tracker, /keepalive: true/);
    assert.match(tracker, /fetch\('\/api\/visitors'/);
    assert.doesNotMatch(tracker, /console\.(error|warn)/);
});
test('tracker terpasang di layout akar dan bagian dasbor tersedia', () => {
    const layout = readProjectFile('app/layout.tsx');
    assert.match(layout, /import \{ VisitorTracker \}/);
    assert.match(layout, /<VisitorTracker \/>/);
    const page = readProjectFile('app/dashboard/admin/page.tsx');
    assert.match(page, /DashboardVisitors/);
    assert.match(page, /title="Pengunjung website"/);
    assert.match(page, /import\('@\/app\/components\/admin\/dashboard\/dashboard-visitors'\)/);
    const view = readProjectFile('app/components/admin/dashboard/dashboard-visitors.tsx');
    assert.match(view, /fetchAdminVisitorStats/);
    assert.match(view, /notProvisioned/);
    assert.match(view, /Satu orang dihitung sekali/);
    assert.match(view, /VisitorChart/);
    assert.match(view, /VisitorChartSelector/);
    const chart = readProjectFile('app/components/admin/dashboard/visitor-chart.tsx');
    assert.match(chart, /LineChart/);
    assert.match(chart, /BarChart/);
    assert.match(chart, /PieChart/);
    assert.match(chart, /buildVisitorPieSlices/);
});
