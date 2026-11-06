/**
 * Tata letak halaman Menu Saya.
 *
 * MASALAH YANG DILAPORKAN
 * "benarkan ui nya jangan terlalu numpuk card nya jelek banget" — tangkapan
 * layar penjual menunjukkan tiga kotak bertumpuk sebelum menu pertama
 * terlihat: kartu "Daftar menu toko", kotak abu "Kuota produk" di dalamnya,
 * lalu kartu "Flash Sale" terpisah. Di dalam kartu produk pun ada kotak
 * bersarang lagi (panel Flash Sale berlatar abu di atas kartu putih).
 *
 * Yang dikunci di sini:
 * 1. hanya satu kartu pembuka — kuota dan status Flash Sale jadi baris di
 *    dalamnya, bukan kartu kedua dan ketiga;
 * 2. panel Flash Sale & kontrol stok/jam di kartu produk dipisah garis,
 *    bukan kotak abu bersarang;
 * 3. status Flash Sale diumumkan satu kali saja — pil kedua dulu menulis
 *    "Akan Datang" bahkan ketika badge di atasnya menulis "Berakhir";
 * 4. `page.tsx` tidak mengekspor apa pun selain default, karena Next 14
 *    menghasilkan `.next/types/**` yang menolak export tambahan di berkas
 *    halaman (TS2344) dan membuat `npm run typecheck` gagal.
 *
 * Jalankan: node --test tests/seller-menu-layout.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function readProjectFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}

const PAGE = readProjectFile('app/(app)/dashboard/penjual/menu/page.tsx');

test('satu kartu pembuka, bukan tiga kotak bertumpuk', () => {
  assert.match(PAGE, /function FlashSaleSummaryRow\(/);
  assert.match(PAGE, /<FlashSaleSummaryRow plan=\{plan\} quota=\{flashQuota\} used=\{flashUsed\} \/>/);
  // Kartu "Flash Sale" yang dulu berdiri sendiri sudah tidak ada.
  assert.doesNotMatch(PAGE, /FlashSaleSectionHeader/);
  // Kuota bukan lagi kotak abu di dalam kartu.
  assert.doesNotMatch(PAGE, /rounded-2xl bg-secondary p-4/);
});

test('panel Flash Sale di kartu produk dipisah garis, bukan kotak bersarang', () => {
  assert.match(PAGE, /<div className="mt-3 border-t border-border\/70 pt-3">/);
  assert.match(PAGE, /mt-3 space-y-2 border-t border-border\/70 pt-3/);
  // Kotak abu tempat panel Flash Sale dulu menempel di luar kartu.
  assert.doesNotMatch(PAGE, /<div className="mt-3 rounded-2xl bg-secondary p-3">/);
});

test('status Flash Sale diumumkan sekali saja', () => {
  // Dua sumber kebenaran untuk satu status pernah bertentangan di layar.
  assert.doesNotMatch(PAGE, /'Akan Datang'/);
  assert.match(PAGE, /<FlashStatusBadge status=\{status\} \/>/);
});

test('berkas halaman tidak mengekspor apa pun selain default', () => {
  const exported = PAGE.split('\n').filter((line) => line.startsWith('export '));
  assert.equal(exported.length, 1);
  assert.match(exported[0], /^export default function MenuSayaPage\(\)/);
});
