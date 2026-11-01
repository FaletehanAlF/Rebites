/**
 * Sumber kebenaran tunggal status operasional pesanan.
 *
 * CACAT YANG DILAPORKAN
 * "kenapa antarnya lama banget" — pesanan macet di status `paid` karena tombol
 * dashboard penjual tidak pernah bisa diklik.
 *
 * AKARNYA
 * `progress_status` diisi 'disiapkan' saat checkout lalu TIDAK PERNAH diubah
 * siapa pun. Syarat tombol penjual (`!order.progressStatus && isOngoing`)
 * karena itu selalu false, dan UI jatuh ke tombol cadangan yang mencoba
 * `paid -> out_for_delivery` — transisi yang ditolak trigger database.
 *
 * Yang dikunci di sini:
 * 1. `order_status` adalah sumber kebenaran; `progress_status` tidak pernah
 *    menentukan tampilan sendiri.
 * 2. `progress_status` hanya boleh menyelamatkan pesanan LAMA, dan hanya
 *    untuk nilai 'diantar' / 'siap-diambil'. Nilai 'disiapkan' (default
 *    checkout) TIDAK boleh menimpa apa pun.
 * 3. Setiap aksi penjual punya pasangan transisi yang sudah diizinkan trigger
 *    `guard_orders_update` — jadi tidak perlu migrasi SQL.
 *
 * Jalankan: node --test tests/order-status-source.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getSellerAction,
  resolveOrderPhase,
  type OrderPhaseInput,
} from '../lib/order-status-source.ts';

test('order_status modern dipakai apa adanya', () => {
  const cases: Array<[string, string]> = [
    ['pending', 'pending'],
    ['paid', 'paid'],
    ['processing', 'processing'],
    ['out_for_delivery', 'out_for_delivery'],
    ['ready_for_pickup', 'ready_for_pickup'],
    ['completed', 'completed'],
  ];
  for (const [orderStatus, expected] of cases) {
    assert.equal(
      resolveOrderPhase({ status: 'ongoing', orderStatus }),
      expected,
      `order_status ${orderStatus}`
    );
  }
});

test('lifecycle completed menang atas order_status lain', () => {
  // Settlement pembayaran menulis lifecycle_status='completed'. Itu lebih
  // kuat daripada order_status yang belum sempat ikut berubah.
  assert.equal(
    resolveOrderPhase({ status: 'completed', orderStatus: 'out_for_delivery' }),
    'completed'
  );
});

test('order_status terminal -> cancelled', () => {
  for (const status of ['cancelled', 'refunded', 'failed']) {
    assert.equal(
      resolveOrderPhase({ status: 'ongoing', orderStatus: status }),
      'cancelled',
      `order_status ${status}`
    );
  }
});

test('status legacy punya alias ke fase modern', () => {
  assert.equal(resolveOrderPhase({ orderStatus: 'preparing' }), 'processing');
  assert.equal(resolveOrderPhase({ orderStatus: 'ready' }), 'ready_for_pickup');
});

test('progress_status "disiapkan" TIDAK boleh menimpa paid', () => {
  // INI AKAR MASALAHNYA. Checkout mengisi progress_status='disiapkan' untuk
  // SEMUA pesanan. Bila nilai itu boleh menimpa, pesanan yang sudah dibayar
  // akan terlihat belum dimulai dan tombol penjual mati.
  const phase = resolveOrderPhase({
    status: 'ongoing',
    orderStatus: 'paid',
    progressStatus: 'disiapkan',
  });
  assert.equal(phase, 'paid');
});

test('progress_status "disiapkan" TIDAK boleh menimpa processing', () => {
  const phase = resolveOrderPhase({
    status: 'ongoing',
    orderStatus: 'processing',
    progressStatus: 'disiapkan',
  });
  assert.equal(phase, 'processing');
});

test('progress_status "diantar" menyelamatkan pesanan lama', () => {
  // Pesanan lama: order_status tidak pernah bergerak, tapi progress_status
  // membuktikan seller sudah seventy. Pesanan ini tidak boleh kembali ke
  // "menunggu pembayaran" dan hilang dari pandangan.
  const phase = resolveOrderPhase({
    status: 'ongoing',
    orderStatus: 'paid',
    progressStatus: 'diantar',
  });
  assert.equal(phase, 'out_for_delivery');
});

test('progress_status "siap-diambil" menyelamatkan pesanan lama', () => {
  const phase = resolveOrderPhase({
    status: 'ongoing',
    orderStatus: 'processing',
    progressStatus: 'siap-diambil',
  });
  assert.equal(phase, 'ready_for_pickup');
});

test('order_status modern TIDAK ditimpa progress_status', () => {
  // Urutan pemeriksaan: order_status menang. Kalau progress_status bisa
  // menimpa, satu pesanan bisa punya dua tampilan berbeda.
  const phase = resolveOrderPhase({
    status: 'ongoing',
    orderStatus: 'out_for_delivery',
    progressStatus: 'disiapkan',
  });
  assert.equal(phase, 'out_for_delivery');
});

test('order_status tidak dikenal -> pending, bukan tebakan', () => {
  // Tidak boleh menebak "sedang diantar" dari apa pun.
  const phase = resolveOrderPhase({
    status: 'ongoing',
    orderStatus: 'entah-apa',
    progressStatus: 'diantar',
  });
  assert.equal(phase, 'pending');
});

test('order_status kosong tanpa progress -> pending', () => {
  assert.equal(resolveOrderPhase({ status: 'ongoing' }), 'pending');
});

test('order_status kosong + progress "disiapkan" -> pending', () => {
  const phase = resolveOrderPhase({
    status: 'ongoing',
    orderStatus: null,
    progressStatus: 'disiapkan',
  });
  assert.equal(phase, 'pending');
});

test('aksi penjual pada paid adalah mulai menyiapkan', () => {
  const action = getSellerAction('paid', 'delivery');
  assert.ok(action);
  assert.equal(action.targetStatus, 'processing');
  assert.equal(action.label, 'Mulai Siapkan Pesanan');
});

test('aksi penjual pada processing: delivery -> antarkan', () => {
  const action = getSellerAction('processing', 'delivery');
  assert.ok(action);
  assert.equal(action.targetStatus, 'out_for_delivery');
  assert.equal(action.label, 'Antarkan Pesanan');
});

test('aksi penjual pada processing: pickup -> siap diambil', () => {
  const action = getSellerAction('processing', 'pickup');
  assert.ok(action);
  assert.equal(action.targetStatus, 'ready_for_pickup');
  assert.equal(action.label, 'Makanan Sudah Siap');
});

test('aksi penjual saat sedang diantar: tandai selesai', () => {
  const action = getSellerAction('out_for_delivery', 'delivery');
  assert.ok(action);
  assert.equal(action.targetStatus, 'completed');
});

test('aksi penjual saat siap diambil: tandai selesai', () => {
  const action = getSellerAction('ready_for_pickup', 'pickup');
  assert.ok(action);
  assert.equal(action.targetStatus, 'completed');
});

test('tanpa aksi untuk pending, selesai, dan dibatalkan', () => {
  for (const phase of ['pending', 'completed', 'cancelled'] as const) {
    assert.equal(getSellerAction(phase, 'delivery'), null, `fase ${phase}`);
  }
});

test('SEMUA pasangan target aksi diizinkan trigger database', () => {
  // Trigger `guard_orders_update` hanya mengizinkan pasangan tertentu.
  // actedFromFailed ini pasangan yang sale转移 punya, jadi tidak butuh
  // migrasi SQL untuk menjalankan alur dua langkah.
  const allowed = new Set([
    'paid>processing',
    'processing>out_for_delivery',
    'processing>ready_for_pickup',
    'out_for_delivery>completed',
    'ready_for_pickup>completed',
  ]);
  const phases = ['paid', 'processing', 'out_for_delivery', 'ready_for_pickup'] as const;
  for (const phase of phases) {
    for (const fulfillment of ['delivery', 'pickup']) {
      const action = getSellerAction(phase, fulfillment);
      if (!action) continue;
      const key = `${phase}>${action.targetStatus}`;
      assert.ok(allowed.has(key), `pasangan ${key} tidak diizinkan trigger`);
    }
  }
});

test('fase tidak dikenal tidak menghasilkan aksi', () => {
  const input: OrderPhaseInput = { orderStatus: 'entah-apa' };
  const phase = resolveOrderPhase(input);
  assert.equal(getSellerAction(phase, 'delivery'), null);
});
