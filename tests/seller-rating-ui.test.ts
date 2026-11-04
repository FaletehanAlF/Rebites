/**
 * Regresi tampilan rating di halaman ulasan penjual.
 *
 * CACAT YANG DILAPORKAN
 * "filter bintangnya ga keliatan... warna bintang kuning saja jangan hijau".
 *
 * AKARNYA (dua-duanya, bukan salah satu)
 * 1. Filter rating memakai `fill-primary text-primary`: saat chip-nya SEDANG
 *    TERPILIH, latarnya juga `bg-primary` — bintang hijau di atas hijau,
 *    kontras 1:1 alias tidak terlihat sama sekali. Angkanya terbaca,
 *    bintangnya hilang.
 * 2. Bintang yang belum terisi memakai `fill-border-100 text-primary-foreground`.
 *    `border-100` TIDAK ADA di `tailwind.config.ts` (yang ada `border`), jadi
 *    kelas `fill-border-100` tidak menghasilkan CSS apa pun — dan
 *    `text-primary-foreground` = putih di atas kartu putih, kontras 1:1.
 *
 * Yang dikunci di sini: bintang terisi memakai emas, bintang kosong memakai
 * abu yang benar-benar ada di tema, dan tidak ada lagi kelas token karangan.
 *
 * Jalankan: node --test tests/seller-rating-ui.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function readProjectFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}

const STARS = readProjectFile('app/components/dashboard-penjual/RatingStars.tsx');
const CHIPS = readProjectFile('app/components/dashboard-penjual/RatingFilterChips.tsx');
const PAGE = readProjectFile('app/(app)/dashboard/penjual/ulasan/page.tsx');
const TAILWIND = readProjectFile('tailwind.config.ts');

test('bintang tidak pernah memakai warna hijau brand', () => {
  // Hijau brand di atas chip hijau (1:1) dan di atas kartu putih bukan
  // masalah kontras, tapi warna bintang yang diminta adalah kuning.
  for (const source of [STARS, CHIPS]) {
    assert.doesNotMatch(source, /fill-primary\b/);
    assert.doesNotMatch(source, /text-primary\b/);
  }
  assert.doesNotMatch(PAGE, /fill-primary/);
});

test('filter rating: bintang emas, kontras memadai di kedua latar chip', () => {
  // Terpilih  -> latar bg-primary (hijau tua): bintang harus emas TERANG
  //              (gold-300 ≈ 5:1).
  // Tak dipilih -> latar putih: bintang emas lebih gelap (gold-600 ≈ 3,2:1).
  assert.match(CHIPS, /fill-gold-300 text-gold-300/);
  assert.match(CHIPS, /fill-gold-600 text-gold-600/);
  assert.match(CHIPS, /aria-pressed=\{selected\}/);
});

test('bintang kosong tidak putih dan tidak memakai token karangan', () => {
  // Bukan putih (1:1 di atas kartu), dan bukan `fill-border-100` yang tidak
  // ada di tema.
  assert.doesNotMatch(STARS, /text-primary-foreground/);
  assert.doesNotMatch(STARS, /border-100/);
  assert.match(STARS, /text-muted-foreground\/80/);
  // Bintang terisi memakai emas yang sama dengan chip.
  assert.match(STARS, /fill-gold-600 text-gold-600/);
  // Warna bukan satu-satunya penyampai informasi.
  assert.match(STARS, /aria-label=\{`Rating \$\{safe\} dari 5`\}/);
});

test('token emas yang dipakai benar-benar ada di tema Tailwind', () => {
  // Kelas Tailwind untuk warna yang tidak ada di tema tidak menghasilkan CSS
  // apa pun — tanpa error build. Tes ini menjaga token-nya tidak dihapus.
  assert.match(TAILWIND, /'gold-300': '#E2C98A'/);
  assert.match(TAILWIND, /'gold-600': '#B08A1C'/);
});

test('kartu Rating Toko di halaman yang sama ikut memakai bintang emas', () => {
  // Satu halaman tidak boleh mencampur bintang hijau dan kuning. Kartu ini
  // juga punya cacat yang sama: bintang kosongnya memakai `fill-border-100`
  // (tidak ada di tema) + `text-primary-foreground` (putih di atas putih),
  // sehingga bintang ke-5 dari "4.0/5.0" tidak pernah tergambar.
  const card = readProjectFile('app/components/dashboard-penjual/StoreRatingCard.tsx');
  assert.doesNotMatch(card, /fill-primary/);
  assert.doesNotMatch(card, /fill-border-100|text-primary-foreground/);
  assert.match(card, /fill-gold-600 text-gold-600/);
  assert.match(card, /text-muted-foreground\/80/);
});

test('halaman ulasan memakai komponen bersama, bukan salinan lokal', () => {
  assert.match(PAGE, /import \{ RatingFilterChips \}/);
  assert.match(PAGE, /import \{ RatingStars \}/);
  // Salinan lokal lama memakai kelas karangan; memastikan ia benar-benar
  // hilang, bukan tinggal sebagai kode mati.
  assert.doesNotMatch(PAGE, /fill-border-100/);
  assert.doesNotMatch(PAGE, /function Stars\(/);
});
