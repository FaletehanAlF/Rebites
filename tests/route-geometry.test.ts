/**
 * Tes geometri rute pengantaran.
 *
 * Modul murni: tanpa peta, tanpa jaringan, tanpa DOM. Yang diuji adalah
 * perhitungan titik di sepanjang polyline — bagian yang paling mudah salah
 * dan paling sulit terlihat di layar (kendaraan yang melompat atau bergerak
 * patah-patah).
 *
 * Jalankan: node --test tests/route-geometry.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRouteCacheKey,
  distanceKmBetween,
  headingAtProgress,
  isValidRouteGeometry,
  pointAtProgress,
  routePolylineKm,
  simplifyRoute,
  straightRoute,
  ROUTE_MAX_POINTS,
  type RouteCoordinate,
} from '../lib/route-geometry.ts';

/** Rute lurus ke timur: 3 titik, dua segmen sama panjang. */
const EASTWARD: RouteCoordinate[] = [
  [106.8, -6.2],
  [106.81, -6.2],
  [106.82, -6.2],
];

test('geometri: polyline sah hanya bila >= 2 titik dan semua koordinat wajar', () => {
  assert.equal(isValidRouteGeometry(EASTWARD), true);

  assert.equal(isValidRouteGeometry([]), false);
  assert.equal(isValidRouteGeometry([[106.8, -6.2]]), false);
  assert.equal(isValidRouteGeometry(null), false);
  assert.equal(isValidRouteGeometry('bukan array'), false);

  // Satu titik rusak membatalkan seluruh rute: menggambar setengah jalan
  // lebih buruk daripada tidak menggambar rute sama sekali.
  assert.equal(isValidRouteGeometry([[106.8, -6.2], [106.81, null]]), false);
  assert.equal(isValidRouteGeometry([[106.8, -6.2], [106.81, 91]]), false);
  assert.equal(isValidRouteGeometry([[106.8, -6.2], [181, -6.2]]), false);
  assert.equal(isValidRouteGeometry([[106.8, -6.2], ['106.81', -6.2]]), false);
});

test('geometri: panjang polyline = jumlah panjang segmen', () => {
  const total = routePolylineKm(EASTWARD);
  const firstLeg = distanceKmBetween(EASTWARD[0], EASTWARD[1]);
  const secondLeg = distanceKmBetween(EASTWARD[1], EASTWARD[2]);
  assert.ok(Math.abs(total - (firstLeg + secondLeg)) < 1e-9);
  assert.ok(total > 0);

  // Rute kosong / satu titik: 0 km, bukan NaN.
  assert.equal(routePolylineKm([]), 0);
  assert.equal(routePolylineKm([[106.8, -6.2]]), 0);
});

test('geometri: posisi pada progres mengikuti PANJANG segmen, bukan indeks titik', () => {
  // Dua segmen sama panjang -> progres 0.5 ada tepat di titik tengah polyline.
  const mid = pointAtProgress(EASTWARD, 0.5);
  assert.ok(mid);
  assert.ok(Math.abs(mid![0] - 106.81) < 1e-9, `lng tengah salah: ${mid![0]}`);
  assert.ok(Math.abs(mid![1] - -6.2) < 1e-9);

  // Ujung-ujung harus persis titik pertama & terakhir.
  assert.deepEqual(pointAtProgress(EASTWARD, 0), EASTWARD[0]);
  assert.deepEqual(pointAtProgress(EASTWARD, 1), EASTWARD[2]);
});

test('geometri: progres di luar 0..1 dijepit, bukan menghasilkan titik liar', () => {
  assert.deepEqual(pointAtProgress(EASTWARD, -5), EASTWARD[0]);
  assert.deepEqual(pointAtProgress(EASTWARD, 99), EASTWARD[2]);
  assert.deepEqual(pointAtProgress(EASTWARD, Number.NaN), EASTWARD[0]);
});

test('geometri: segmen panjang & pendek dilalui dengan kecepatan sama', () => {
  // Titik tengah polyline ada di 106.81 walau segmennya beda panjang:
  // progres 0.5 memotong TOTAL panjang, bukan membagi rata jumlah titik.
  const uneven: RouteCoordinate[] = [
    [106.8, -6.2],
    [106.81, -6.2], // 1/3 panjang
    [106.83, -6.2], // 2/3 panjang
  ];
  const half = pointAtProgress(uneven, 0.5);
  assert.ok(half);
  // Setengah total panjang jatuh di segmen kedua.
  assert.ok(half![0] > 106.81, `titik tengah ${half![0]} seharusnya masuk segmen kedua`);
});

test('geometri: arah hadap mengikuti arah jalan', () => {
  // Ke timur = 90 derajat (0 = utara, searah jarum jam).
  const east = headingAtProgress(EASTWARD, 0.3);
  assert.ok(Math.abs(east - 90) < 1, `arah ke timur seharusnya ~90, dapat ${east}`);

  // Ke utara = 0 derajat.
  const northward: RouteCoordinate[] = [
    [106.8, -6.2],
    [106.8, -6.1],
  ];
  const north = headingAtProgress(northward, 0.5);
  assert.ok(north < 1 || north > 359, `arah ke utara seharusnya ~0, dapat ${north}`);

  // Selalu dalam 0..360.
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const deg = headingAtProgress(EASTWARD, t);
    assert.ok(deg >= 0 && deg < 360, `arah ${deg} di luar rentang`);
  }

  // Rute terlalu pendek: tidak ada arah, kembalikan 0 (bukan error).
  assert.equal(headingAtProgress([], 0.5), 0);
  assert.equal(headingAtProgress([[106.8, -6.2]], 0.5), 0);
});

test('geometri: simplify mempertahankan ujung-ujung rute', () => {
  const long: RouteCoordinate[] = [];
  for (let i = 0; i < 2000; i += 1) long.push([106.8 + i * 0.0001, -6.2]);

  const simplified = simplifyRoute(long, 100);
  assert.equal(simplified.length, 100);
  assert.deepEqual(simplified[0], long[0]);
  assert.deepEqual(simplified[simplified.length - 1], long[long.length - 1]);

  // Sudah cukup pendek: tidak ada yang dibuang.
  assert.equal(simplifyRoute(EASTWARD, ROUTE_MAX_POINTS).length, EASTWARD.length);
});

test('geometri: cache key stabil & membedakan arah', () => {
  const a = { latitude: -6.2, longitude: 106.8 };
  const b = { latitude: -6.24, longitude: 106.82 };

  assert.equal(buildRouteCacheKey(a, b), buildRouteCacheKey(a, b));
  assert.notEqual(buildRouteCacheKey(a, b), buildRouteCacheKey(b, a));
  // Pergeseran lebih kecil dari ~1 meter tidak membuat entri baru.
  assert.equal(
    buildRouteCacheKey(a, b),
    buildRouteCacheKey({ latitude: -6.2000001, longitude: 106.8000001 }, b)
  );
});

test('geometri: rute cadangan berupa garis lurus dua titik', () => {
  const origin = { latitude: -6.2, longitude: 106.8 };
  const destination = { latitude: -6.24, longitude: 106.82 };
  const straight = straightRoute(origin, destination);

  assert.equal(straight.length, 2);
  // Urutan GeoJSON: [lng, lat].
  assert.deepEqual(straight[0], [106.8, -6.2]);
  assert.deepEqual(straight[1], [106.82, -6.24]);
  assert.equal(isValidRouteGeometry(straight), true);
});
