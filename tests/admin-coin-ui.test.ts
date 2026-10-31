/**
 * Regresi kontrol ReBites Coin oleh Super Admin.
 *
 * Source-guard lokal; tidak menjalankan browser atau database.
 *
 * YANG DIKUNCI DI SINI
 * 1. Route POST wajib memeriksa keanggotaan Super Admin, dan WAJIB lewat
 *    token terverifikasi (`getAdminUser`) — bukan dari body permintaan.
 * 2. Penulisan koin wajib lewat service client. Policy tulis
 *    `coin_transactions` sudah dicabut dan trigger
 *    `guard_coin_transactions_no_client_write` menolak penulisan dari sesi
 *    admin biasa; membuka jalur tulis untuk `authenticated` akan melemahkan
 *    pengaman yang sudah ada.
 * 3. Setiap penyesuaian wajib tercatat di `admin_audit_logs`.
 * 4. Tombol ubah hanya dirender bila server menyatakan pemanggil Super Admin.
 * 5. Tautan "ReBites Coin" harus menuju halaman yang benar-benar ada.
 *
 * Jalankan: node --test tests/admin-coin-ui.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Baca berkas proyek sebagai teks berakhiran LF.
 *
 * Di Windows dengan core.autocrlf=true checkout berupa CRLF; pemeriksaan
 * berbasis baris akan gagal pada kode yang benar tanpa penyeragaman ini.
 */
function readProjectFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(
    /\r\n/g,
    '\n'
  );
}

const ROUTE = readProjectFile('app/api/admin/users/[id]/coins/route.ts');
const PANEL = readProjectFile('app/components/admin/coin-adjustment-panel.tsx');
const PENGATURAN = readProjectFile('app/pengaturan/page.tsx');
const ACCOUNT_SIDEBAR = readProjectFile('app/components/shared/account-sidebar.tsx');
const MOBILE_NAVBAR = readProjectFile('app/components/shared/MobileNavbar.tsx');
const USERS_ROUTE = readProjectFile('app/api/admin/users/route.ts');
const HOOK = readProjectFile('hooks/use-rebites-coins.ts');

test('route koin menolak pemanggil yang bukan Super Admin', () => {
  // Cek harus memotong Permintaan SEBELUM body dibaca, dan.identity-nya
  // harus berasal dari token terverifikasi.
  assert.match(ROUTE, /isSuperAdminUserId\(admin\.id\)/);
  assert.match(ROUTE, /getAdminUser\(req\.headers\.get\('authorization'\)\)/);

  // Penolakan harus 403, bukan 401: sesi admin SAH, hanya hak ubah yang tidak.
  const blokPost = ROUTE.slice(ROUTE.indexOf('export async function POST'));
  assert.match(
    blokPost,
    /status: 403/,
    'admin biasa harus mendapat 403, bukan 401'
  );

  // Cek Super Admin harus mendahului pembacaan body.
  const posisiCek = blokPost.indexOf('isSuperAdminUserId(admin.id)');
  const posisiBody = blokPost.indexOf('await req.json()');
  assert.ok(posisiCek > -1 && posisiBody > -1);
  assert.ok(
    posisiCek < posisiBody,
    'keanggotaan Super Admin harus diperiksa sebelum body dibaca'
  );
});

test('route koin menulis lewat service client, bukan sesi pengguna', () => {
  assert.match(ROUTE, /createServiceClient\(\)/);
  assert.match(
    ROUTE,
    /from\('coin_transactions'\)[\s\S]{0,200}\.insert\(/,
    'penyesuaian harus menjadi baris ledger baru'
  );
  // Tidak boleh ada GRANT/insert yang ditulis dari klien browser.
  assert.doesNotMatch(ROUTE, /createAuthedServerClient/);
});

test('setiap penyesuaian koin tercatat di audit log', () => {
  assert.match(ROUTE, /admin_audit_logs/);
  assert.match(ROUTE, /adjust_coin_balance/);
  // Audit harus memuat saldo sebelum dan sesudah supaya selisih bisa ditelusuri.
  assert.match(ROUTE, /balance_before/);
  assert.match(ROUTE, /balance_after/);
  // Alasan wajib ikut tercatat — inilah yang membuat perubahan bisa diaudit.
  assert.match(ROUTE, /reason: checked\.reason/);
});

test('panel koin hanya menampilkan tombol ubah untuk Super Admin', () => {
  assert.match(PANEL, /useAdminMe/);
  assert.match(PANEL, /me\?\.isSuperAdmin === true/);
  //_Otomatis label "Beri koin"/"Tarik koin" hanya dirender saat bolehUbah.
  assert.match(PANEL, /bolehUbah && mode === null/);
  // Admin biasa harus diberi penjelasan, bukan sekadar tidak ada tombol.
  assert.match(PANEL, /Hanya Super Admin yang dapat mengubah koin pengguna/);
});

test('panel menolak sendsIBS alasan terlalu pendek sebelum memanggil server', () => {
  // Tombol Simpan nonaktif sampai alasan cukup — batas yang sama dengan validasi
  // server, supaya Super Admin tidak_book error untuk permintaan yang memang
  // akan ditolak.
  assert.match(PANEL, /alasan\.trim\(\)\.length >= 10/);
  assert.match(PANEL, /disabled=\{!bisaKirim\}/);
});

test('daftar pengguna menampilkan saldo koin dari satu query agregat', () => {
  assert.match(USERS_ROUTE, /coin_balance: computeCoinBalance/);
  // Jangan N+1: satu query untuk seluruh user di halaman.
  assert.match(USERS_ROUTE, /\.in\('user_id', ids\)/);
  assert.match(USERS_ROUTE, /coin_transactions/);
});

test('semua tautan ReBites Coin menuju halaman yang ada', () => {
  // Anchor lama /profile#rebites-coin hanya menampilkan saldo, tidak riwayat.
  assert.match(PENGATURAN, /href: "\/pengaturan\/coin"/);
  assert.match(ACCOUNT_SIDEBAR, /href: '\/pengaturan\/coin'/);
  assert.match(MOBILE_NAVBAR, /href: "\/pengaturan\/coin"/);
  assert.doesNotMatch(PENGATURAN, /href: "\/profile#rebites-coin"/);
  assert.doesNotMatch(ACCOUNT_SIDEBAR, /href: '\/profile#rebites-coin'/);
  assert.doesNotMatch(MOBILE_NAVBAR, /href: "\/profile#rebites-coin"/);
});

test('saldo di hook user menghitung adjustment sebagai penambah', () => {
  // Tanpa ini, koin yang diberikan admin justru MENGURANGI saldo user:
  // tipe adjustment jatuh ke cabang pengurang dan/+-/ jadi terbalik.
  assert.match(
    HOOK,
    /tx\.type === 'earned'[\s\S]{0,200}=== 'refund'[\s\S]{0,200}=== 'adjustment'/,
    'adjustment harus dihitung sebagai penambah saldo'
  );
  assert.match(HOOK, /balance: Math\.max\(0, earned - spent\)/);
});
