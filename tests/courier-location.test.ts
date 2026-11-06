/**
 * Logika posisi kurir: kesegaran, throttle, dan proyeksi ke rute.
 *
 * Yang dikunci di sini:
 * 1. Posisi basi TIDAK boleh ditampilkan seolah-olah posisi sekarang.
 * 2. Tidak ada posisi yang dikarang — tanpa titik awal valid, hasilnya null.
 * 3. Motor diproyeksikan ke RUTE, bukan digambar mentah di titik GPS (GPS
 *    bisa meleset dari jalan, dan motor meluncur di atas jalan terlihat benar).
 * 4. Throttle: tidak mengirim posisi lebih cepat dari 5 detik.
 *
 * Jalankan: node --test tests/courier-location.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatPositionAge,
  isPositionDisplayable,
  isValidCourierPosition,
  nextSendDelayMs,
  projectOntoRoute,
  resolveLocationFreshness,
  STALE_AFTER_MS,
  UNAVAILABLE_AFTER_MS,
} from '../lib/courier-location.ts';

const NOW = Date.parse('2026-10-31T10:00:00Z');

test('posisi baru -> aktif', () => {
  const freshness = resolveLocationFreshness('2026-10-31T09:59:30Z', NOW);
  assert.equal(freshness, 'aktif');
});

test('posisi basi 90 detik -> terlambat', () => {
  const freshness = resolveLocationFreshness(
    new Date(NOW - STALE_AFTER_MS - 1000).toISOString(),
    NOW
  );
  assert.equal(freshness, 'terlambat');
});

test('posisi sangat basi -> tidak_tersedia', () => {
  const freshness = resolveLocationFreshness(
    new Date(NOW - UNAVAILABLE_AFTER_MS - 1000).toISOString(),
    NOW
  );
  assert.equal(freshness, 'tidak_tersedia');
});

test('tanpa timestamp -> tidak_tersedia', () => {
  assert.equal(resolveLocationFreshness(null, NOW), 'tidak_tersedia');
  assert.equal(resolveLocationFreshness(undefined, NOW), 'tidak_tersedia');
  assert.equal(resolveLocationFreshness('bukan-tanggal', NOW), 'tidak_tersedia');
});

test('posisi tidak_tersedia tidak boleh ditampilkan di peta', () => {
  // Peta yang menunjuk lokasi salah lebih buruk daripada peta kosong.
  assert.equal(isPositionDisplayable('tidak_tersedia'), false);
  assert.equal(isPositionDisplayable('terlambat'), true);
  assert.equal(isPositionDisplayable('aktif'), true);
});

test('waktu di masa depan dianggap terlambat', () => {
  // Jam server meleset. Durasi negatif tidak boleh dihitung.
  const freshness = resolveLocationFreshness('2026-10-31T11:00:00Z', NOW);
  assert.equal(freshness, 'terlambat');
});

test('kirim pertama boleh langsung', () => {
  assert.equal(nextSendDelayMs(null, NOW), null);
  assert.equal(nextSendDelayMs(undefined, NOW), null);
});

test('kirim kedua ditahan sampai interval minimum', () => {
  const delay = nextSendDelayMs(NOW - 1000, NOW);
  assert.ok(delay !== null);
  assert.ok(delay > 0 && delay <= 5000, `delay tidak masuk akal: ${delay}`);
});

test('setelah target interval, boleh kirim lagi', () => {
  assert.equal(nextSendDelayMs(NOW - 10_000, NOW), null);
  assert.equal(nextSendDelayMs(NOW - 60_000, NOW), null);
});

test('umur posisi diurai jadi kalimat singkat', () => {
  assert.equal(formatPositionAge('2026-10-31T09:59:48Z', NOW), '12 detik lalu');
  assert.equal(formatPositionAge('2026-10-31T09:55:00Z', NOW), '5 menit lalu');
  assert.equal(formatPositionAge('2026-10-31T08:00:00Z', NOW), '2 jam lalu');
});

test('umur posisi tanpa timestamp -> null', () => {
  assert.equal(formatPositionAge(null, NOW), null);
  assert.equal(formatPositionAge('bukan-tanggal', NOW), null);
});

test('koordinat di luar rentang ditolak', () => {
  assert.equal(isValidCourierPosition(91, 0), false);
  assert.equal(isValidCourierPosition(0, 181), false);
  assert.equal(isValidCourierPosition(NaN, 0), false);
  assert.equal(isValidCourierPosition('6.2', 106.8), false);
});

test('Null Island ditolak', () => {
  // (0,0) hampir pasti data kosong yang terisi nol, bukan lokasi nyata.
  assert.equal(isValidCourierPosition(0, 0), false);
});

test('koordinat valid diterima', () => {
  assert.equal(isValidCourierPosition(-6.2, 106.8), true);
});

test('proyeksi ke rute menghasilkan titik di rute dan progres 0..1', () => {
  // Rute sederhana: dari (106.80, -6.20) ke (106.81, -6.20).
  const route: [number, number][] = [
    [106.8, -6.2],
    [106.81, -6.2],
  ];
  const result = projectOntoRoute(route, { latitude: -6.2, longitude: 106.805 });
  assert.ok(result);
  assert.ok(result.progress >= 0 && result.progress <= 1);
  // Titik hasil proyeksi harus menempel di rute (lat -6.2).
  assert.ok(Math.abs(result.position[1] - -6.2) < 1e-9);
  // Dan di tengah-tengah rute, bukan di ujung.
  assert.ok(result.progress > 0.1 && result.progress < 0.9, `progres: ${result.progress}`);
});

test('proyeksi ke rute/null tanpa rute yang sah -> null', () => {
  assert.equal(projectOntoRoute([], { latitude: -6.2, longitude: 106.8 }), null);
  assert.equal(projectOntoRoute([[106.8, -6.2]], { latitude: -6.2, longitude: 106.8 }), null);
});

test('proyeksi dengan posisi tidak valid -> null', () => {
  const route: [number, number][] = [
    [106.8, -6.2],
    [106.81, -6.2],
  ];
  assert.equal(projectOntoRoute(route, { latitude: 0, longitude: 0 }), null);
  assert.equal(projectOntoRoute(route, { latitude: NaN, longitude: 106.8 }), null);
});

test('proyeksi ke rute yang seluruhnya sama titik -> null', () => {
  // Rute panjang nol tidak punya arah; progres tidak bisa dihitung.
  const route: [number, number][] = [
    [106.8, -6.2],
    [106.8, -6.2],
  ];
  assert.equal(projectOntoRoute(route, { latitude: -6.2, longitude: 106.8 }), null);
});

test('proyeksi memberi progres 0 di awal rute dan ~1 di akhir', () => {
  const route: [number, number][] = [
    [106.8, -6.2],
    [106.82, -6.2],
  ];
  const start = projectOntoRoute(route, { latitude: -6.2, longitude: 106.8 });
  const end = projectOntoRoute(route, { latitude: -6.2, longitude: 106.82 });
  assert.ok(start && end);
  assert.ok(start.progress < 0.05, `progres awal: ${start.progress}`);
  assert.ok(end.progress > 0.95, `progres akhir: ${end.progress}`);
});
