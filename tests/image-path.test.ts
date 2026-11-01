/**
 * Test penormalan path gambar (lib/image-path.ts).
 *
 * MENGAPA TES INI ADA
 * Setelah konversi AVIF, SELURUH gambar di `public/` berformat `.avif`, tetapi
 * database masih menyimpan nama lama: 18 produk di `products.image_url` dan
 * 24 pesanan di `orders.image_url` menunjuk `/makanan1.jpeg`, `/makanan9.webp`,
 * dan seterusnya. `next build` TIDAK pernah memeriksa hal ini — build tetap
 * hijau walau setiap kartu produk menampilkan gambar rusak.
 *
 * Resolver inilah satu-satunya yang menjaga data lama tetap tampil. Tes di
 * bawah mengunci dua sisi sekaligus:
 *   1. path lokal berekstensi lama DIARAHKAN ke `.avif`;
 *   2. nilai yang tidak boleh diubah (URL Storage, data URI, SVG) TIDAK
 *      disentuh — kalau resolver terlalu agresif, foto unggahan penjual rusak.
 *
 * Jalankan: node --test tests/image-path.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { AVIF_EXTENSION, imageSrcVariants, resolveImageSrc } from '../lib/image-path.ts';

test('path lokal berekstensi lama diarahkan ke AVIF', () => {
  const cases: Array<[string, string]> = [
    ['/makanan1.jpeg', '/makanan1.avif'],
    ['/makanan2.jpeg', '/makanan2.avif'],
    ['/makanan9.webp', '/makanan9.avif'],
    ['/makanan10.webp', '/makanan10.avif'],
    ['/makanan13.jpg', '/makanan13.avif'],
    ['/foods/ikansayur.jpg', '/foods/ikansayur.avif'],
  ];

  for (const [input, expected] of cases) {
    assert.equal(resolveImageSrc(input), expected, `gagal untuk ${input}`);
  }
});

test('path yang sudah AVIF tidak diubah', () => {
  for (const src of ['/makanan1.avif', '/logo.avif', '/foods/ikansayur.avif']) {
    assert.equal(resolveImageSrc(src), src);
  }
});

test('URL absolut dan data URI TIDAK disentuh', () => {
  // Foto unggahan penjual ada di Supabase Storage; menyentuhnya akan memutus
  // gambar yang justru sudah benar.
  const untouched = [
    'https://gvkhwpngqnidzzeqfbkh.supabase.co/storage/v1/object/public/product-images/foto.jpg',
    'https://images.pexels.com/photos/16134564/pexels-photo-16134564.jpeg?auto=compress&w=1200',
    'data:image/png;base64,iVBORw0KGgo=',
    '//cdn.contoh.com/foto.jpg',
  ];

  for (const src of untouched) {
    assert.equal(resolveImageSrc(src), src, `tidak boleh diubah: ${src}`);
  }
});

test('format yang tidak dikonversi (SVG/GIF/ICO) tetap apa adanya', () => {
  for (const src of ['/icon.svg', '/animasi.gif', '/favicon.ico']) {
    assert.equal(resolveImageSrc(src), src);
  }
});

test('query dan hash dipertahankan', () => {
  assert.equal(resolveImageSrc('/makanan1.jpeg?v=2'), '/makanan1.avif?v=2');
  assert.equal(resolveImageSrc('/makanan1.jpg#top'), '/makanan1.avif#top');
});

test('kosong dan null menjadi string kosong', () => {
  assert.equal(resolveImageSrc(''), '');
  assert.equal(resolveImageSrc(null), '');
  assert.equal(resolveImageSrc(undefined), '');
  assert.equal(resolveImageSrc('   '), '');
});

test('ekstensi huruf besar ikut dinormalkan', () => {
  assert.equal(resolveImageSrc('/makanan1.JPEG'), '/makanan1.avif');
  assert.equal(resolveImageSrc('/foto.WEBP'), '/foto.avif');
});

test('hanya ekstensi di AKHIR path yang diganti', () => {
  // Nama berkas yang memuat "jpg" di tengah tidak boleh ikut berubah.
  assert.equal(resolveImageSrc('/jpg-tema/foto.png'), '/jpg-tema/foto.png');
  assert.equal(resolveImageSrc('/foto.jpg.png'), '/foto.jpg.png');
});

test('imageSrcVariants memuat bentuk lama dan baru', () => {
  const variants = imageSrcVariants('/makanan1.jpeg');
  assert.ok(variants.includes('/makanan1.jpeg'), 'bentuk asli harus ada');
  assert.ok(variants.includes('/makanan1.avif'), 'bentuk AVIF harus ada');

  const fromAvif = imageSrcVariants('/makanan9.avif');
  assert.ok(fromAvif.includes('/makanan9.avif'));
  assert.ok(fromAvif.includes('/makanan9.webp'), 'data lama berformat webp harus tetap cocok');
});

test('konstanta ekstensi sesuai berkas yang benar-benar ada', () => {
  assert.equal(AVIF_EXTENSION, '.avif');
});
