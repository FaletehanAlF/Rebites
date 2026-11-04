/**
 * Tes markup ikon kendaraan peta.
 *
 * Modul murni: tanpa DOM, tanpa peta. Yang dijaga di sini adalah kontrak
 * antara markup dan kode animasi, plus aturan desain proyek (tanpa gradien,
 * tanpa aset dari jaringan) — dua hal yang tidak muncul sebagai error build
 * kalau dilanggar.
 *
 * Jalankan: node --test tests/map-vehicle-marker.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildVehicleMarkerHtml,
  vehicleMotionStyles,
  VEHICLE_MARKER_HEIGHT,
  VEHICLE_MARKER_WIDTH,
} from '../lib/map-vehicle-marker.ts';

test('ikon kendaraan: penanda yang dicari kode animasi tetap ada', () => {
  const html = buildVehicleMarkerHtml();
  // Kode animasi memutar `[data-vehicle-inner]` dan meredupkan
  // `[data-vehicle-root]`. Kalau nama penandanya berubah di satu sisi saja,
  // ikon berhenti mengikuti arah jalan tanpa error apa pun.
  assert.ok(html.includes('data-vehicle-root'), 'hilang: data-vehicle-root');
  assert.ok(html.includes('data-vehicle-inner'), 'hilang: data-vehicle-inner');
  assert.ok(html.includes('data-vehicle-shadow'), 'hilang: data-vehicle-shadow');
  assert.ok(html.includes('<svg'), 'ikon harus digambar sebagai SVG');
  assert.ok(html.includes('viewBox="0 0 40 52"'), 'viewBox hilang atau berubah');
});

test('ikon kendaraan: tanpa gradien dan tanpa aset dari jaringan', () => {
  const html = buildVehicleMarkerHtml();
  assert.ok(
    !/linearGradient|radialGradient|url\(#/i.test(html),
    'gradien dilarang aturan desain proyek'
  );
  assert.ok(!/https?:\/\//i.test(html), 'ikon tidak boleh memuat aset dari jaringan');
  assert.ok(!/xlink:href/i.test(html), 'ikon tidak boleh menautkan aset eksternal');
});

test('ikon kendaraan: keadaan berjalan dan berhenti berbeda', () => {
  const moving = vehicleMotionStyles(true);
  const stopped = vehicleMotionStyles(false);

  // Kalau keduanya sama, motor yang melaju dan motor yang sudah sampai
  // terlihat identik — pengguna tidak bisa membedakan keadaan.
  assert.notEqual(moving.root, stopped.root, 'tinggi badan harus berbeda');
  assert.notEqual(moving.shadow, stopped.shadow, 'bayangan harus berbeda');
  assert.notEqual(
    moving.shadowOpacity,
    stopped.shadowOpacity,
    'opasitas bayangan harus berbeda'
  );

  // Berjalan = terangkat (nilai negatif) dan bayangan meredup.
  assert.match(moving.root, /^translateY\(-\d/, 'badan harus terangkat saat berjalan');
  assert.equal(stopped.root, 'translateY(0)', 'badan kembali diam saat berhenti');
  assert.ok(
    Number(moving.shadowOpacity) < Number(stopped.shadowOpacity),
    'bayangan harus lebih redup saat berjalan'
  );
});

test('ikon kendaraan: ukuran sprite sama dengan konstanta yang dipakai peta', () => {
  const html = buildVehicleMarkerHtml();
  assert.ok(
    html.includes(`width:${VEHICLE_MARKER_WIDTH}px`),
    'lebar sprite tidak sesuai VEHICLE_MARKER_WIDTH'
  );
  assert.ok(
    html.includes(`height:${VEHICLE_MARKER_HEIGHT}px`),
    'tinggi sprite tidak sesuai VEHICLE_MARKER_HEIGHT'
  );
});
