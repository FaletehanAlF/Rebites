/**
 * Unit test murni untuk buildMapPlan (Tahap A).
 * TANPA browser, TANPA jaringan, TANPA peta, TANPA DB.
 *
 * Membuktikan:
 * - Koordinat hanya sah bila pasangan lengkap + dalam rentang.
 * - Tidak ada koordinat dummy: nilai aneh/tak lengkap -> null.
 * - Marker kurir tidak pernah dihasilkan.
 *
 * Jalankan: node --test tests/delivery-map-plan.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMapPlan, resolveFormCoordinates } from '../lib/delivery-map-plan.ts';
import { parseCoordinatePairInput } from '../lib/location-validation.ts';

test('pesanan belum dimuat -> no-order, tanpa titik', () => {
  const plan = buildMapPlan({ hasOrder: false });
  assert.equal(plan.availability, 'no-order');
  assert.equal(plan.origin, null);
  assert.equal(plan.destination, null);
  assert.equal(plan.center, null);
});

test('toko + tujuan valid -> ready dan pusat di tengah', () => {
  const plan = buildMapPlan({
    hasOrder: true,
    originLatitude: -6.2,
    originLongitude: 106.8,
    destinationLatitude: -6.24,
    destinationLongitude: 106.82,
  });
  assert.equal(plan.availability, 'ready');
  assert.deepEqual(plan.origin, { latitude: -6.2, longitude: 106.8 });
  assert.deepEqual(plan.destination, { latitude: -6.24, longitude: 106.82 });
  assert.ok(plan.center);
  assert.ok(Math.abs(plan.center!.latitude - -6.22) < 1e-9);
  assert.ok(Math.abs(plan.center!.longitude - 106.81) < 1e-9);
  assert.equal(plan.message, null);
});

test('hanya toko yang valid -> ready, pusat ke toko, tujuan null', () => {
  const plan = buildMapPlan({
    hasOrder: true,
    originLatitude: -6.2,
    originLongitude: 106.8,
    destinationLatitude: null,
    destinationLongitude: null,
  });
  assert.equal(plan.availability, 'ready');
  assert.deepEqual(plan.center, { latitude: -6.2, longitude: 106.8 });
  assert.equal(plan.destination, null);
});

test('tidak ada koordinat sama sekali -> no-coordinates + pesan jujur', () => {
  const plan = buildMapPlan({ hasOrder: true });
  assert.equal(plan.availability, 'no-coordinates');
  assert.equal(plan.center, null);
  assert.match(plan.message ?? '', /koordinat/i);
});

test('pasangan setengah / di luar rentang / NaN tidak pernah jadi titik', () => {
  const half = buildMapPlan({
    hasOrder: true,
    originLatitude: -6.2,
    originLongitude: null,
    destinationLatitude: -6.24,
    destinationLongitude: 106.82,
  });
  assert.equal(half.origin, null);
  assert.equal(half.destination?.latitude, -6.24);

  const outOfRange = buildMapPlan({
    hasOrder: true,
    originLatitude: 95,
    originLongitude: 200,
    destinationLatitude: -6.24,
    destinationLongitude: 106.82,
  });
  assert.equal(outOfRange.origin, null);

  const nan = buildMapPlan({
    hasOrder: true,
    originLatitude: Number.NaN,
    originLongitude: Infinity,
    destinationLatitude: -6.24,
    destinationLongitude: 106.82,
  });
  assert.equal(nan.origin, null);
});

test('(0,0) diperlakukan sebagai tidak diketahui, bukan lokasi nyata', () => {
  const plan = buildMapPlan({
    hasOrder: true,
    originLatitude: 0,
    originLongitude: 0,
    destinationLatitude: 0,
    destinationLongitude: 0,
  });
  assert.equal(plan.availability, 'no-coordinates');
  assert.equal(plan.origin, null);
  assert.equal(plan.destination, null);
});

test('string angka dari JSONB tetap diterima; sampah ditolak', () => {
  const ok = buildMapPlan({
    hasOrder: true,
    originLatitude: '-6.2',
    originLongitude: '106.8',
  });
  assert.deepEqual(ok.origin, { latitude: -6.2, longitude: 106.8 });

  const bad = buildMapPlan({
    hasOrder: true,
    originLatitude: 'abc',
    originLongitude: '106.8',
  });
  assert.equal(bad.origin, null);
});

test('zoom menyesuaikan sebaran: dekat lebih rapat daripada jauh', () => {
  const near = buildMapPlan({
    hasOrder: true,
    originLatitude: -6.2,
    originLongitude: 106.8,
    destinationLatitude: -6.2001,
    destinationLongitude: 106.8001,
  });
  const far = buildMapPlan({
    hasOrder: true,
    originLatitude: -6.2,
    originLongitude: 106.8,
    destinationLatitude: -7.9,
    destinationLongitude: 112.6,
  });
  assert.ok(near.zoom > far.zoom, 'titik berdekatan harus lebih zoom-in');
});

test('rencana peta tidak pernah mengandung titik kurir', () => {
  const plan = buildMapPlan({
    hasOrder: true,
    originLatitude: -6.2,
    originLongitude: 106.8,
    destinationLatitude: -6.24,
    destinationLongitude: 106.82,
  });
  assert.equal('courier' in plan, false);
  assert.equal('driver' in plan, false);
});

test('resolveFormCoordinates: koma desimal diterima (parser form yang sama)', () => {
  assert.deepEqual(resolveFormCoordinates('-6,2', '106,8', parseCoordinatePairInput), {
    latitude: -6.2,
    longitude: 106.8,
  });
});

test('resolveFormCoordinates: kosong / setengah / tidak sah -> null (tanpa marker)', () => {
  const r = (a: unknown, b: unknown) =>
    resolveFormCoordinates(a, b, parseCoordinatePairInput);
  assert.equal(r('', ''), null);
  assert.equal(r(null, null), null);
  assert.equal(r(undefined, undefined), null);
  assert.equal(r('-6.2', ''), null);
  assert.equal(r('', '106.8'), null);
  assert.equal(r('abc', '106.8'), null);
  assert.equal(r('95', '106.8'), null);
  assert.equal(r('0', '0'), null);
});

test('resolveFormCoordinates: angka mentah dari state form juga diterima', () => {
  assert.deepEqual(resolveFormCoordinates(-6.2, 106.8, parseCoordinatePairInput), {
    latitude: -6.2,
    longitude: 106.8,
  });
});

test('resolveFormCoordinates: parser menolak -> null walau angkanya wajar', () => {
  // Membuktikan keputusan validasi tetap milik parser form, bukan ditebak
  // ulang di sini.
  const rejectAll = () => ({ ok: false });
  assert.equal(resolveFormCoordinates(-6.2, 106.8, rejectAll), null);
});
