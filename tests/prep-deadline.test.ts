/**
 * Tenggat persiapan pesanan untuk penjual.
 *
 * CACAT YANG DILAPORKAN
 * "pada saat user mesan menyiapkan pesanan jangan lama banget"
 *
 * Dashboard penjual selama ini hanya menampilkan JAM PESANAN DIBUAT. Tidak
 * ada batas waktu penyiapan yang terlihat, jadi "sebentar lagi" tidak punya
 * arti dan pesanan terasa menggantung tanpa ujung.
 *
 * Yang dikunci di sini:
 * 1. Tenggat diambil dari `estimated_completion_at` yang sudah dihitung
 *    server — modul ini TIDAK menghitung ulang estimasinya sendiri.
 * 2. Tanpa tenggat yang valid: `null`, bukan angka karangan.
 * 3. Tenggat yang sudah LEWAT tetap ditampilkan ("Lewat 3 menit"), bukan
 *    disembunyikan. Menyembunyikannya membuat pesanan tampak masih aman.
 *
 * Jalankan: node --test tests/prep-deadline.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { formatPrepRemaining } from '../lib/prep-deadline.ts';

const NOW = Date.parse('2026-10-31T12:00:00Z');
const inMinutes = (m: number) => new Date(NOW + m * 60_000).toISOString();

test('sisa waktu ditampilkan dalam menit', () => {
  const result = formatPrepRemaining(inMinutes(8), NOW);
  assert.ok(result);
  assert.equal(result.text, 'Siap dalam 8 menit');
  assert.equal(result.overdue, false);
});

test('kurang dari satu menit tidak menampilkan 0 menit', () => {
  const result = formatPrepRemaining(inMinutes(0.4), NOW);
  assert.ok(result);
  assert.equal(result.text, 'Siap dalam <1 menit');
  assert.equal(result.overdue, false);
});

test('tenggat lewat menampilkan "Lewat N menit"', () => {
  const result = formatPrepRemaining(inMinutes(-3), NOW);
  assert.ok(result);
  assert.equal(result.text, 'Lewat 3 menit');
  assert.equal(result.overdue, true);
});

test('lewat kurang dari semenit tetap ditandai lewat', () => {
  // Detik terakhir sebelum tenggat lewat harus terlihat, bukan "Siap dalam
  // 0 menit" yang terbaca seolah masih aman.
  const result = formatPrepRemaining(inMinutes(-0.4), NOW);
  assert.ok(result);
  assert.equal(result.text, 'Lewat tenggat');
  assert.equal(result.overdue, true);
});

test('tanpa tenggat -> null, bukan angka karangan', () => {
  assert.equal(formatPrepRemaining(null, NOW), null);
  assert.equal(formatPrepRemaining(undefined, NOW), null);
  assert.equal(formatPrepRemaining('', NOW), null);
});

test('tenggat tidak valid -> null', () => {
  assert.equal(formatPrepRemaining('bukan-tanggal', NOW), null);
});

test('tenggat tepat sekarang dihitung sudah lewat', () => {
  const result = formatPrepRemaining(inMinutes(0), NOW);
  assert.ok(result);
  assert.equal(result.overdue, true);
});

test('tenggat jauh tetap terbaca dalam menit', () => {
  // 45 menit: jam tidak dipakai, cukup menit — supaya penjual langsung paham
  // tanpa mengonversi.
  const result = formatPrepRemaining(inMinutes(45), NOW);
  assert.ok(result);
  assert.equal(result.text, 'Siap dalam 45 menit');
});
