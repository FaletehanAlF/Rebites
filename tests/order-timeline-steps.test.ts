/**
 * Logika waktu tiap tahap pada timeline perjalanan pesanan.
 *
 * CACAT YANG DILAPORKAN
 * "statusnya jangan menunggu ada waktunya" — di halaman detail pesanan, semua
 * tahap antara menampilkan "Menunggu" tanpa jam, padahal waktunya SUDAH
 * tercatat di `order_status_history`.
 *
 * AKARNYA
 * Tabel `order_status_history` ditulis setiap kali status berubah
 * (`lib/order-state-machine.ts`), tetapi tidak pernah dibaca. Timeline pun
 * mengarang tahap antara sebagai `null`.
 *
 * Yang dikunci di sini:
 * 1. Tahap yang punya entri riwayat menampilkan waktu NYATA.
 * 2. Tahap tanpa entri tetap `null` — JANGAN pernah mengarang jam.
 * 3. Satu status menyalakan beberapa tahap sekaligus
 *    (`out_for_delivery` = sudah bayar + sudah disiapkan + kurir berangkat).
 * 4. Entri paling awal menang: waktu pembayaran yang ditampilkan adalah waktu
 *    pembayaran PERTAMA, bukan yang terakhir.
 *
 * Jalankan: node --test tests/order-timeline-steps.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTimelineTimes,
  STATUS_TO_STEPS,
  type OrderStatusHistoryEntry,
} from '../lib/order-timeline-steps.ts';

function entri(status: string, at: string): OrderStatusHistoryEntry {
  return { status, at, note: null };
}

test('tahap pembayaran menampilkan waktu dari riwayat', () => {
  const times = buildTimelineTimes(
    {},
    [entri('paid', '2026-10-31T08:00:00Z')]
  );
  assert.equal(times.confirmed, '2026-10-31T08:00:00Z');
});

test('satu status out_for_delivery menyalakan tiga tahap', () => {
  // Status 'out_for_delivery' berarti: sudah dibayar, sudah disiapkan, dan
  // kurir sudah berangkat. Kalau pemetaannya satu-ke-satu, waktu "Pembayaran
  // dikonfirmasi" akan hilang.
  const times = buildTimelineTimes(
    {},
    [entri('out_for_delivery', '2026-10-31T09:00:00Z')]
  );
  assert.equal(times.confirmed, '2026-10-31T09:00:00Z');
  assert.equal(times.prepared, '2026-10-31T09:00:00Z');
  assert.equal(times['on-the-way'], '2026-10-31T09:00:00Z');
});

test('tahap tanpa entri riwayat tetap null, tidak dikarang', () => {
  // Ini inti dari "jangan menunggu ada waktunya": kalau waktunya tidak ada,
  // tampilkan "Menunggu" — JANGAN isi jam karangan yang tidak pernah terjadi.
  const times = buildTimelineTimes({}, [entri('paid', '2026-10-31T08:00:00Z')]);
  assert.equal(times.prepared, undefined);
  assert.equal(times.completed, undefined);
  assert.equal(times['on-the-way'], undefined);
});

test('entri paling awal menang untuk satu tahap', () => {
  // Bayangkan riwayat berisi dua entri 'paid'. Yang ditampilkan harus waktu
  // pembayaran PERTAMA; kalau yang terakhir, pembeli melihat tanggal yang
  // salah dan mengira pesanan dibuat lebih akhir.
  const times = buildTimelineTimes(
    {},
    [entri('paid', '2026-10-31T08:00:00Z'), entri('paid', '2026-10-31T20:00:00Z')]
  );
  assert.equal(times.confirmed, '2026-10-31T08:00:00Z');
});

test('entri tanpa timestamp diabaikan', () => {
  const times = buildTimelineTimes(
    {},
    [{ status: 'paid', at: null, note: null }]
  );
  assert.equal(times.confirmed, undefined);
});

test('fallback completedAt dipakai saat riwayat kosong', () => {
  // Pesanan lama tidak punya riwayat; waktu selesai yang nyata di baris
  // pesanan tetap layak ditampilkan.
  const times = buildTimelineTimes(
    { completedAt: '2026-10-31T10:00:00Z' },
    []
  );
  assert.equal(times.completed, '2026-10-31T10:00:00Z');
});

test('fallback deliveryStartedAt dipakai saat riwayat kosong', () => {
  const times = buildTimelineTimes(
    { deliveryStartedAt: '2026-10-31T09:30:00Z' },
    []
  );
  assert.equal(times['on-the-way'], '2026-10-31T09:30:00Z');
});

test('riwayat lebih diprioritaskan daripada fallback baris pesanan', () => {
  // Kalau riwayat sudah punya waktunya, angka fallback tidak boleh menimpa.
  const times = buildTimelineTimes(
    { completedAt: '2026-10-31T23:00:00Z' },
    [entri('completed', '2026-10-31T11:00:00Z')]
  );
  assert.equal(times.completed, '2026-10-31T11:00:00Z');
});

test('status dibatalkan menghasilkan tahap cancelled', () => {
  const times = buildTimelineTimes(
    {},
    [entri('cancelled', '2026-10-31T12:00:00Z')]
  );
  assert.equal(times.cancelled, '2026-10-31T12:00:00Z');
});

test('status tak dikenal tidak merusak pemetaan', () => {
  const times = buildTimelineTimes(
    {},
    [entri('entah-apa', '2026-10-31T12:00:00Z')]
  );
  assert.equal(Object.keys(times).length, 0);
});

test('setiap status dikenal punya pemetaan tahap', () => {
  // Status baru yang ditambahkan di DB tanpa pemetaan akan membuat tahap
  // hilang diam-diam. Tes ini memaksa pemetaan ikut diperbarui.
  const statusTerdaftar = [
    'paid',
    'processing',
    'preparing',
    'ready',
    'ready_for_pickup',
    'out_for_delivery',
    'completed',
    'cancelled',
    'refunded',
    'failed',
  ];
  for (const status of statusTerdaftar) {
    assert.ok(
      STATUS_TO_STEPS[status],
      `status "${status}" harus punya pemetaan tahap`
    );
  }
});

test('status paid menyalakan hanya tahap confirmed', () => {
  // Bayangan: 'paid' ikut menyalakan 'prepared', timeline akan mengarang
  // tahap yang belum terjadi.
  assert.deepEqual(STATUS_TO_STEPS.paid, ['confirmed']);
});
