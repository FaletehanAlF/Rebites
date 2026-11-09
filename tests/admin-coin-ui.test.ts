import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
const ROUTE = readProjectFile('app/api/admin/users/[id]/coins/route.ts');
const PANEL = readProjectFile('app/components/admin/coin-adjustment-panel.tsx');
const PENGATURAN = readProjectFile('app/pengaturan/page.tsx');
const SIDEBAR_PEMBELI = readProjectFile('app/components/shared/profile-sidebar-nav.tsx');
const MOBILE_NAVBAR = readProjectFile('app/components/shared/MobileNavbar.tsx');
const USERS_ROUTE = readProjectFile('app/api/admin/users/route.ts');
const HOOK = readProjectFile('hooks/buyer/use-rebites-coins.ts');
test('route koin menolak pemanggil yang bukan Super Admin', () => {
    assert.match(ROUTE, /isSuperAdminUserId\(admin\.id\)/);
    assert.match(ROUTE, /getAdminUser\(req\.headers\.get\('authorization'\)\)/);
    const blokPost = ROUTE.slice(ROUTE.indexOf('export async function POST'));
    assert.match(blokPost, /status: 403/, 'admin biasa harus mendapat 403, bukan 401');
    const posisiCek = blokPost.indexOf('isSuperAdminUserId(admin.id)');
    const posisiBody = blokPost.indexOf('await req.json()');
    assert.ok(posisiCek > -1 && posisiBody > -1);
    assert.ok(posisiCek < posisiBody, 'keanggotaan Super Admin harus diperiksa sebelum body dibaca');
});
test('route koin menulis lewat service client, bukan sesi pengguna', () => {
    assert.match(ROUTE, /createServiceClient\(\)/);
    assert.match(ROUTE, /from\('coin_transactions'\)[\s\S]{0,200}\.insert\(/, 'penyesuaian harus menjadi baris ledger baru');
    assert.doesNotMatch(ROUTE, /createAuthedServerClient/);
});
test('setiap penyesuaian koin tercatat di audit log', () => {
    assert.match(ROUTE, /admin_audit_logs/);
    assert.match(ROUTE, /adjust_coin_balance/);
    assert.match(ROUTE, /balance_before/);
    assert.match(ROUTE, /balance_after/);
    assert.match(ROUTE, /reason: checked\.reason/);
});
test('panel koin hanya menampilkan tombol ubah untuk Super Admin', () => {
    assert.match(PANEL, /useAdminMe/);
    assert.match(PANEL, /me\?\.isSuperAdmin === true/);
    assert.match(PANEL, /bolehUbah && mode === null/);
    assert.match(PANEL, /Hanya Super Admin yang dapat mengubah koin pengguna/);
});
test('panel menolak sendsIBS alasan terlalu pendek sebelum memanggil server', () => {
    assert.match(PANEL, /alasan\.trim\(\)\.length >= 10/);
    assert.match(PANEL, /disabled=\{!bisaKirim\}/);
});
test('daftar pengguna menampilkan saldo koin dari satu query agregat', () => {
    assert.match(USERS_ROUTE, /coin_balance: computeCoinBalance/);
    assert.match(USERS_ROUTE, /\.in\('user_id', ids\)/);
    assert.match(USERS_ROUTE, /coin_transactions/);
});
test('semua tautan ReBites Coin menuju halaman yang ada', () => {
    assert.match(PENGATURAN, /href: "\/pengaturan\/coin"/);
    assert.match(MOBILE_NAVBAR, /href: "\/pengaturan\/coin"/);
    assert.doesNotMatch(PENGATURAN, /href: "\/profile#rebites-coin"/);
    assert.doesNotMatch(MOBILE_NAVBAR, /href: "\/profile#rebites-coin"/);
    assert.doesNotMatch(SIDEBAR_PEMBELI, /href: "\/profile#rebites-coin"/);
});
test('saldo di hook user menghitung adjustment sebagai penambah', () => {
    assert.match(HOOK, /tx\.type === 'earned'[\s\S]{0,200}=== 'refund'[\s\S]{0,200}=== 'adjustment'/, 'adjustment harus dihitung sebagai penambah saldo');
    assert.match(HOOK, /balance: Math\.max\(0, earned - spent\)/);
});
