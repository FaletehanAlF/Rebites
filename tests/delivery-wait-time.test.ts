/**
 * Durasi tunggu pembeli pada status pesanan yang sedang berjalan.
 *
 * CACAT YANG DILAPORKAN
 * "perjalanan pesanan jangan lama lama" — pembeli tidak punya cara tahu sudah
 * menunggu berapa lama, karena tidak ada angka waktu di panel status.
 *
 * Yang dikunci di sini:
 * 1. Durasi dihitung dari waktu yang BENAR-BENAR ada (perubahan status
 *    terakhir, atau waktu pesanan dibuat bila status belum pernah berubah).
 * 2. Tanpa titik awal yang valid -> null. BUKAN "0 menit": angka nol
 *    berarti "sudah menunggu 0 menit" dan itu berbohong.
 * 3. Pesanan yang sudah selesai/dibatalkan tidak menampilkan durasi.
 * 4. "Sekarang" selalu diteruskan dari pemanggil, supaya hasil deterministik
 *    dan bisa diuji tanpa jam sistem.
 *
 * Jalankan: node --test tests/delivery-wait-time.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatElapsedSince,
  resolveWaitSince,
} from '../lib/delivery-wait-time.ts';

/** 2026-10-31T08:00:00Z */
const T0 = Date.parse('2026-10-31T08:00:00Z');
const MENIT = 60_000;
const JAM = 60 * MENIT;
const HARI = 24 * JAM;

test('kurang dari satu menit', () => {
  assert.equal(formatElapsedSince('2026-10-31T08:00:00Z', T0 + 30_000), 'kurang dari 1 menit');
});

test('menit bulat tanpa pecahan', () => {
  // 12 menit 30 detik harus tampil "12 menit" — bukan "12.5 menit", yang
  // akan menggantungkan pembeli pada angka yang tidak perlu presisi.
  assert.equal(formatElapsedSince('2026-10-31T08:00:00Z', T0 + 12 * MENIT + 30_000), '12 menit');
});

test('satu jam tanpa menit sisa', () => {
  assert.equal(formatElapsedSince('2026-10-31T08:00:00Z', T0 + JAM), '1 jam');
});

test('jam dan menit sisa', () => {
  assert.equal(
    formatElapsedSince('2026-10-31T08:00:00Z', T0 + JAM + 5 * MENIT),
    '1 jam 5 menit'
  );
});

test('satu hari tanpa jam sisa', () => {
  assert.equal(formatElapsedSince('2026-10-31T08:00:00Z', T0 + HARI), '1 hari');
});

test('hari dan jam sisa', () => {
  assert.equal(
    formatElapsedSince('2026-10-31T08:00:00Z', T0 + HARI + 2 * JAM),
    '1 hari 2 jam'
  );
});

test('titik awal kosong -> null, bukan 0 menit', () => {
  // Angka "0 menit" berarti sudah menunggu nol menit. Itu berbohong.
  assert.equal(formatElapsedSince(null, T0), null);
  assert.equal(formatElapsedSince(undefined, T0), null);
  assert.equal(formatElapsedSince('', T0), null);
});

test('titik awal tidak valid -> null', () => {
  assert.equal(formatElapsedSince('bukan-tanggal', T0), null);
});

test('waktu di masa depan -> null', () => {
  // Jam server meleset atau data salah. Durasi negatif akan membingungkan.
  assert.equal(formatElapsedSince('2026-10-31T09:00:00Z', T0), null);
});

test('resolveWaitSince memakai perubahan status terakhir', () => {
  const since = resolveWaitSince(
    { orderStatus: 'out_for_delivery', createdAt: '2026-10-31T07:00:00Z' },
    '2026-10-31T08:00:00Z'
  );
  assert.equal(since, '2026-10-31T08:00:00Z');
});

test('resolveWaitSince jatuh ke waktu pesanan dibuat bila status belum berubah', () => {
  const since = resolveWaitSince(
    { orderStatus: 'paid', createdAt: '2026-10-31T07:00:00Z' },
    null
  );
  assert.equal(since, '2026-10-31T07:00:00Z');
});

test('resolveWaitSince null untuk pesanan selesai', () => {
  const since = resolveWaitSince(
    { orderStatus: 'completed', createdAt: '2026-10-31T07:00:00Z' },
    '2026-10-31T08:00:00Z'
  );
  assert.equal(since, null);
});

test('resolveWaitSince null untuk pesanan dibatalkan', () => {
  for (const status of ['cancelled', 'refunded', 'failed']) {
    const since = resolveWaitSince(
      { orderStatus: status, createdAt: '2026-10-31T07:00:00Z' },
      '2026-10-31T08:00:00Z'
    );
    assert.equal(since, null, `status ${status} tidak boleh menunggu`);
  }
});

test('resolveWaitSince null untuk pesanan dengan createdAt kosong', () => {
  const since = resolveWaitSince({ orderStatus: 'paid', createdAt: '' }, null);
  assert.equal(since, null);
});
