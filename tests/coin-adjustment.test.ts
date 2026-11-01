/**
 * Tes logika penyesuaian koin oleh Super Admin.
 *
 * ATURAN YANG DIKUNCI DI SINI
 * 1. Saldo koin adalah TURUNAN ledger, bukan kolom: `(earned + refund) - spent`,
 *    di-clamp minimal 0. Rumus ini WAJIB identik dengan `deriveSnapshot()` di
 *    `hooks/use-rebites-coins.ts`; kalau keduanya berbeda, halaman admin dan
 *    halaman user akan menampilkan angka yang berbeda untuk orang yang sama.
 * 2. `coin_transactions.amount` punya CHECK (amount > 0). Karena itu penarikan
 *    koin oleh admin TIDAK boleh diwakili angka negatif — ia memakai tipe
 *    `spent` yang sudah dihitung sebagai pengurang.
 * 3. Batas dan alasan wajib ada di satu tempat, bukan tersebar di komponen.
 *
 * Jalankan: node --test tests/coin-adjustment.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  COIN_ADJUST_MAX,
  COIN_REASON_MIN,
  adjustmentDescription,
  computeCoinBalance,
  resolveAdjustmentRow,
  validateAdjustment,
} from '../lib/coin-adjustment.ts';

/** Baca berkas proyek sebagai teks berakhiran LF (Windows core.autocrlf). */
function readProjectFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(
    /\r\n/g,
    '\n'
  );
}

// ---------------------------------------------------------------------------
// Saldo
// ---------------------------------------------------------------------------

test('saldo = (earned + refund) - spent', () => {
  const rows = [
    { type: 'earned', amount: 500 },
    { type: 'spent', amount: 200 },
    { type: 'refund', amount: 50 },
  ];
  assert.equal(computeCoinBalance(rows), 350);
});

test('saldo never negatif saat spent melebihi earned', () => {
  // Ledger yang tidak konsisten (mis. data lama) tidak boleh membuat saldo
  // negatif: user akan melihat angka minus dan tombol checkout ikut rusak.
  const rows = [
    { type: 'earned', amount: 100 },
    { type: 'spent', amount: 250 },
  ];
  assert.equal(computeCoinBalance(rows), 0);
});

test('adjustment dihitung sebagai penambah, bukan pengurang', () => {
  // Pemberian koin admin memakai tipe 'adjustment' (positif = menambah).
  const rows = [
    { type: 'earned', amount: 100 },
    { type: 'adjustment', amount: 400 },
  ];
  assert.equal(computeCoinBalance(rows), 500);
});

test('tipe tak dikenal tidak mengubah saldo', () => {
  // Lebih aman mengabaikan baris yang tidak dipahami daripada menebak
  // arahnya lalu diam-diam menambah atau mengurangi saldo user.
  const rows = [
    { type: 'earned', amount: 100 },
    { type: 'sesuatu-baru', amount: 999 },
  ];
  assert.equal(computeCoinBalance(rows), 100);
});

test('rumus saldo admin identik dengan deriveSnapshot di hook user', () => {
  // Dua implementasi saldo yang menyimpang adalah bug yang sulit terlihat:
  // admin melihat 1.000, user melihat 900, dan keduanya "benar" di layarnya.
  const hook = readProjectFile('hooks/use-rebites-coins.ts');
  // Ketiga tipe penambah HARUS ada di rumus hook. Dulu 'adjustment' hilang,
  // sehingga koin dari admin jatuh ke cabang pengurang dan MENGURANGI saldo
  // yang dilihat user — bug yang hanya muncul setelah fitur ini hidup.
  assert.match(
    hook,
    /tx\.type === 'earned'[\s\S]{0,200}=== 'refund'[\s\S]{0,200}=== 'adjustment'/,
    'hook harus menghitung adjustment sebagai penambah, sama seperti admin'
  );
  assert.match(hook, /earned \+= tx\.amount;/);
  assert.match(hook, /spent \+= tx\.amount;/);
  assert.match(hook, /balance: Math\.max\(0, earned - spent\)/);
});

// ---------------------------------------------------------------------------
// Validasi
// ---------------------------------------------------------------------------

test('memberi koin dengan alasan cukup dinyatakan valid', () => {
  const result = validateAdjustment({ delta: 250, reason: 'Kompensasi pesanan telat', currentBalance: 0 });
  assert.equal(result.ok, true);
});

test('nominal nol ditolak', () => {
  const result = validateAdjustment({ delta: 0, reason: 'Kompensasi pesanan telat', currentBalance: 100 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'invalid-amount');
});

test('nominal pecahan ditolak', () => {
  // Koin adalah bilangan bulat; 12.5 akan menghasilkan saldo pecahan yang
  // tidak bisa dipakai checkout.
  const result = validateAdjustment({ delta: 12.5, reason: 'Kompensasi pesanan telat', currentBalance: 0 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'invalid-amount');
});

test('nominal NaN dan Infinity ditolak', () => {
  for (const delta of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const result = validateAdjustment({ delta, reason: 'Kompensasi pesanan telat', currentBalance: 0 });
    assert.equal(result.ok, false, `delta ${delta} harus ditolak`);
    assert.equal(result.code, 'invalid-amount');
  }
});

test('batas 10.000 masih diterima, 10.001 ditolak', () => {
  const pas = validateAdjustment({
    delta: COIN_ADJUST_MAX,
    reason: 'Kompensasi pesanan telat',
    currentBalance: 0,
  });
  assert.equal(pas.ok, true, 'tepat 10.000 harus lolos');

  const lebih = validateAdjustment({
    delta: COIN_ADJUST_MAX + 1,
    reason: 'Kompensasi pesanan telat',
    currentBalance: 0,
  });
  assert.equal(lebih.ok, false);
  assert.equal(lebih.code, 'amount-too-large');
});

test('batas berlaku juga untuk penarikan (nilai absolut)', () => {
  const lebih = validateAdjustment({
    delta: -(COIN_ADJUST_MAX + 1),
    reason: 'Koreksi koin ganda',
    currentBalance: 50_000,
  });
  assert.equal(lebih.ok, false);
  assert.equal(lebih.code, 'amount-too-large');
});

test('alasan terlalu pendek ditolak', () => {
  const pendek = 'x'.repeat(COIN_REASON_MIN - 1);
  const result = validateAdjustment({ delta: 100, reason: pendek, currentBalance: 0 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'reason-too-short');
});

test('alasan hanya spasi dianggap kosong', () => {
  // Panjang string dicek SETELAH trim; tanpa trim, 20 spasi lolos sebagai alasan.
  const result = validateAdjustment({ delta: 100, reason: ' '.repeat(40), currentBalance: 0 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'reason-too-short');
});

test('penarikan melebihi saldo ditolak', () => {
  const result = validateAdjustment({ delta: -500, reason: 'Koreksi koin ganda', currentBalance: 300 });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'insufficient-balance');
});

test('penarikan tepat sebesar saldo diterima', () => {
  const result = validateAdjustment({ delta: -300, reason: 'Koreksi koin ganda', currentBalance: 300 });
  assert.equal(result.ok, true);
});

// ---------------------------------------------------------------------------
// Bentuk baris yang ditulis
// ---------------------------------------------------------------------------

test('pemberian koin menulis tipe adjustment', () => {
  const row = resolveAdjustmentRow({ delta: 150, reason: 'Hadiah dari tim ReBites' });
  assert.equal(row.type, 'adjustment');
  assert.equal(row.amount, 150);
});

test('penarikan koin menulis tipe spent dengan amount POSITIF', () => {
  // CHECK (amount > 0) melarang angka negatif. Memaksa -150 akan membuat
  // insert gagal di database, bukan sekadar salah hitung.
  const row = resolveAdjustmentRow({ delta: -150, reason: 'Koreksi koin ganda' });
  assert.equal(row.type, 'spent');
  assert.equal(row.amount, 150);
  assert.ok(row.amount > 0, 'amount harus positif agar lolos CHECK amount > 0');
});

test('deskripsi penarikan menandai bahwa itu tindakan admin', () => {
  // User harus bisa membedakan "koin saya dipakai untuk pesanan" dari
  // "koin saya ditarik admin" — keduanya bertipe spent.
  const row = resolveAdjustmentRow({ delta: -150, reason: 'Koreksi koin ganda' });
  assert.match(row.description, /admin/i);
  assert.match(row.description, /Koreksi koin ganda/);
});

test('deskripsi pemberian memuat alasan apa adanya', () => {
  const teks = adjustmentDescription(150, 'Hadiah lomba Ramadan');
  assert.match(teks, /Hadiah lomba Ramadan/);
});

// ---------------------------------------------------------------------------
// Migrasi
// ---------------------------------------------------------------------------

test('migrasi menambah adjustment tanpa menghapus tipe lama', () => {
  const sql = readProjectFile('supabase/migrations/20261031000000_coin_adjustment_type.sql');
  assert.match(sql, /'adjustment'/, 'tipe adjustment harus ada');
  assert.match(sql, /'earned'/);
  assert.match(sql, /'spent'/);
  assert.match(sql, /'refund'/);
  // Migrasi tidak boleh menyentuh data yang sudah ada.
  assert.doesNotMatch(sql, /DELETE FROM/i);
  assert.doesNotMatch(sql, /UPDATE public\.coin_transactions/i);
});
