/**
 * Regresi: produk yang sudah dihapus penjual tidak boleh "hidup kembali".
 *
 * KONTEKS (BUG.md + laporan admin):
 *   Admin tidak bisa membuka produk terhapus karena migrasi soft delete
 *   belum diterapkan di database remote; route admin membaca kolom
 *   `products.deleted_at`.
 *
 *   Setelah kolom itu ada, muncul risiko kedua yang SENYAP: produk yang sudah
 *   ditarik penjual tetap terdaftar `verification_status='approved'` dengan
 *   `deleted_at` terisi. Tombol "Tunda penayangan" lalu menulis
 *   verification_status='rejected', dan "Aktifkan kembali" menulis 'approved'.
 *   Walaupun produk TIDAK lagi tayang untuk pembeli (RLS publik mensyaratkan
 *   deleted_at IS NULL), moderasi atas baris yang sudah ditarik penjual
 *   menyesatkan: alasan penundaan menimpa alasan lama dan riwayat moderasi
 *   mencatat tindakan pada produk yang tidak lagi ada di menu penjual.
 *
 *   Karena itu route reject/approve menolak produk dengan `deleted_at`
 *   terisi, dan UI admin tidak menawarkan aksi moderasi untuk produk itu.
 *
 * TES INI memeriksa kontrak yang dibaca langsung dari sumber:
 *   A. Route reject/approve memilih `deleted_at` dan menolak bila terisi.
 *   B. Drawer admin menyembunyikan tombol moderasi untuk produk terhapus.
 *   C. Matriks RLS tetap benar setelah migrasi (pembeli tidak melihat).
 *
 * Jalankan: node --test tests/admin-product-soft-delete-guard.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

/** Windows + core.autocrlf=true menyimpan CRLF; bandingkan teks ternormalisasi. */
function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

for (const action of ['reject', 'approve'] as const) {
  test(`route ${action} membaca deleted_at sebelum mengubah status`, () => {
    const src = readSource(`app/api/admin/products/[id]/${action}/route.ts`);

    assert.match(
      src,
      /\.select\('id, verification_status, deleted_at'\)/,
      'query awal harus menyertakan deleted_at; tanpa itu kolom tidak bisa diperiksa'
    );
    assert.match(
      src,
      /deleted_at/,
      'route harus merujuk kolom deleted_at'
    );
    assert.match(
      src,
      /409/,
      'produk terhapus harus dijawab sebagai konflik (bukan 500)'
    );
  });
}

test('drawer admin menyembunyikan aksi moderasi untuk produk terhapus', () => {
  const src = readSource('app/components/admin/product-detail-drawer.tsx');

  // Tombol aksi berada di blok yang hanya dirender bila produk belum dihapus.
  assert.match(
    src,
    /!confirm\s*&&\s*!p\.deleted_at\s*&&/,
    'tombol Beri peringatan / Tunda penayangan / Aktifkan kembali harus gated oleh !p.deleted_at'
  );
  assert.match(src, /Sudah dihapus/, 'pita status tetap ada sebagai penanda');
  assert.match(src, /Dihapus penjual/, 'badge status tetap ada sebagai penanda');
});

test('migrasi soft delete tetap mensyaratkan deleted_at IS NULL untuk publik', () => {
  const src = readSource('supabase/migrations/20261029000100_products_soft_delete.sql');

  assert.match(src, /ADD COLUMN IF NOT EXISTS deleted_at timestamptz/);
  const publicPolicy = src.slice(
    src.indexOf('CREATE POLICY "products_select_public"'),
    src.indexOf('CREATE POLICY "products_select_own"')
  );
  assert.match(publicPolicy, /products\.deleted_at IS NULL/);
  assert.match(publicPolicy, /verification_status = 'approved'/);
});
