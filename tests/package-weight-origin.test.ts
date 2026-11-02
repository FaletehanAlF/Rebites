/**
 * Produk tanpa berat dan toko tanpa titik lokasi TIDAK lagi memblokir
 * pengantaran.
 *
 * Kondisi nyata yang memicu ini (diukur dari database, 2 Nov 2026):
 *   - 38 dari 44 produk aktif belum mengisi `weight_gram`;
 *   - 10 dari 13 toko belum menandai `latitude`/`longitude`.
 * Keduanya membuat endpoint ongkir menolak hampir seluruh katalog, sehingga
 * tombol bayar tidak pernah sampai ke halaman pembayaran.
 *
 * Yang dijaga tes ini:
 *   - berat isian penjual SELALU menang atas bawaan kategori;
 *   - titik yang ditandai penjual SELALU menang atas pusat kota;
 *   - tidak ada koordinat karangan: kota yang tidak dikenali tidak menghasilkan
 *     titik, sehingga ongkir tetap ditolak daripada dihitung dari tempat acak;
 *   - (0,0)/null/'' tidak pernah dibaca sebagai lokasi nyata.
 *
 * Jalankan: node --test tests/package-weight-origin.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DEFAULT_WEIGHT_FALLBACK_GRAM,
  isDefaultPackageWeight,
  resolvePackageWeightGram,
} from '../lib/package-weight.ts';
import { resolveOriginPoint } from '../lib/store-origin-point.ts';

function read(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('berat isian penjual dipakai apa adanya', () => {
  assert.equal(resolvePackageWeightGram(250, 'Minuman'), 250);
  assert.equal(resolvePackageWeightGram('150', 'Minuman'), 150);
  assert.equal(isDefaultPackageWeight(250), false);
});

test('berat kosong memakai bawaan kategori, bukan menolak', () => {
  assert.equal(resolvePackageWeightGram(null, 'Makanan Berat'), 350);
  assert.equal(resolvePackageWeightGram(null, 'Minuman'), 400);
  assert.equal(resolvePackageWeightGram(undefined, 'Jajanan'), 200);
  // Kategori dicocokkan tanpa peduli huruf besar/kecil dan spasi tepi.
  assert.equal(resolvePackageWeightGram(null, '  minuman '), 400);
  assert.equal(isDefaultPackageWeight(null), true);
});

test('kategori tak dikenal memakai bawaan netral, nol/negatif diabaikan', () => {
  assert.equal(resolvePackageWeightGram(null, 'Kategori Baru'), DEFAULT_WEIGHT_FALLBACK_GRAM);
  assert.equal(resolvePackageWeightGram(null, null), DEFAULT_WEIGHT_FALLBACK_GRAM);
  // CHECK di DB hanya mengizinkan NULL atau > 0; angka tak masuk akal dari
  // data lama tidak boleh dipakai sebagai berat.
  assert.equal(resolvePackageWeightGram(0, 'Minuman'), 400);
  assert.equal(resolvePackageWeightGram(-5, 'Minuman'), 400);
  assert.equal(resolvePackageWeightGram('', 'Minuman'), 400);
});

test('titik toko yang ditandai penjual menang atas kota', () => {
  const r = resolveOriginPoint(-6.435651, 106.825357, 'Tapos');
  assert.equal(r.source, 'store');
  assert.deepEqual(r.point, { latitude: -6.435651, longitude: 106.825357 });
});

test('toko tanpa titik memakai pusat kotanya', () => {
  const r = resolveOriginPoint(null, null, 'Cimanggis');
  assert.equal(r.source, 'city');
  assert.equal(r.matchedCity, 'Cimanggis');
  assert.ok(r.point);
  // Cimanggis berada di sekitar Depok, bukan di Teluk Guinea.
  assert.ok(r.point!.latitude < -6.2 && r.point!.latitude > -6.6);
  assert.ok(r.point!.longitude > 106.7 && r.point!.longitude < 107.0);
});

test('null/string kosong/(0,0) bukan titik nyata', () => {
  for (const [lat, lng] of [[null, null], ['', ''], [0, 0], ['0', '0']] as const) {
    const r = resolveOriginPoint(lat, lng, 'Beji');
    assert.equal(r.source, 'city', `(${String(lat)},${String(lng)}) tidak boleh dianggap titik toko`);
  }
});

test('kota tak dikenal tidak menghasilkan koordinat karangan', () => {
  const r = resolveOriginPoint(null, null, 'Entah Dimana');
  assert.equal(r.point, null);
  assert.equal(r.source, 'none');
  assert.equal(resolveOriginPoint(null, null, null).point, null);
});

test('kota yang hanya mirip tidak dipakai (tanpa pencocokan awalan)', () => {
  // "Jakarta Selatan" punya titiknya sendiri, bukan meminjam "Jakarta Pusat".
  const selatan = resolveOriginPoint(null, null, 'Jakarta Selatan');
  const pusat = resolveOriginPoint(null, null, 'Jakarta Pusat');
  assert.ok(selatan.point && pusat.point);
  assert.notDeepEqual(selatan.point, pusat.point);
});

test('checkout pembeli TIDAK memblokir Diantar hanya karena berat kosong', () => {
  // Regresi: server sudah memakai berat perkiraan, tetapi UI masih menandai
  // `weight_missing` dan menyembunyikan Diantar. Pembeli tidak akan pernah
  // sampai ke perhitungan ongkir yang baru.
  const checkoutView = read('app/components/checkout/checkout-view.tsx');
  const checkoutContext = read('app/components/checkout/checkout-context.tsx');
  const fulfillmentToggle = read('app/components/checkout/fulfillment-toggle.tsx');

  for (const [name, source] of [
    ['checkout-view', checkoutView],
    ['checkout-context', checkoutContext],
    ['fulfillment-toggle', fulfillmentToggle],
  ] as const) {
    assert.ok(!source.includes('weight_missing'), `${name} tidak boleh memblokir Diantar karena berat kosong`);
    assert.ok(!source.includes('deliveryUnavailableReason'), `${name} tidak boleh memakai alasan usang itu`);
  }
  assert.doesNotMatch(fulfillmentToggle, /deliveryBlockedByWeight/);
  assert.match(checkoutContext, /const deliveryUsable = draft\.isDelivery;/);
});

test('server ongkir dan checkout memakai berat/origin cadangan yang sama', () => {
  const rates = read('app/api/shipping/rates/route.ts');
  const checkout = read('app/api/checkout/xendit/route.ts');

  for (const [name, source] of [
    ['shipping/rates', rates],
    ['checkout/xendit', checkout],
  ] as const) {
    assert.ok(source.includes('resolvePackageWeightGram'), `${name} harus memakai berat cadangan kategori`);
    assert.ok(source.includes('resolveOriginPoint'), `${name} harus memakai titik kota cadangan`);
  }
  // Pembeli diberi tahu bahwa angkanya perkiraan, bukan hasil titik/berat asli.
  assert.match(rates, /originEstimated:\s*origin\.source === 'city'/);
  assert.match(rates, /weightEstimated:\s*weightIsEstimated/);
  assert.match(checkout, /weightEstimated:\s*packageWeightEstimated/);
  assert.match(checkout, /estimated:\s*originEstimated/);
});
