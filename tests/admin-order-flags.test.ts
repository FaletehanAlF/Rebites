/**
 * Regresi semantik flag monitoring pesanan admin.
 *
 * Fokus:
 * - mengunci perilaku yang sudah jelas dari implementasi aktual;
 * - mendokumentasikan kasus yang BELUM memiliki keputusan produk sebagai
 *   "KEPUTUSAN BELUM DISETUJUI" (tes tetap merekam perilaku saat ini, bukan
 *   menetapkan aturan baru);
 * - memastikan endpoint dan UI memakai derivasi yang sama.
 *
 * Tanpa database, kredensial admin, provider, atau mutasi pesanan.
 * Jalankan: node --test tests/admin-order-flags.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  deriveOrderMonitoringFlags,
  orderNeedsAttention,
  type OrderMonitoringSource,
} from '../lib/order-monitoring-flags.ts';

const BASE: OrderMonitoringSource = {
  payment_status: 'paid',
  order_status: 'paid',
  lifecycle_status: 'ongoing',
  progress_status: 'disiapkan',
  delivery_option: 'delivery',
  biteship_order_id: null,
};

function derive(overrides: OrderMonitoringSource = {}) {
  return deriveOrderMonitoringFlags({ ...BASE, ...overrides });
}

function readProjectFile(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
    'utf8'
  );
}

// ---------------------------------------------------------------------------
// 1. paid_without_shipment — kasus yang sudah jelas
// ---------------------------------------------------------------------------

test('paid_without_shipment: hanya lunas + delivery + tanpa ID shipment', () => {
  const cases: Array<{
    name: string;
    patch: OrderMonitoringSource;
    expected: boolean;
  }> = [
    {
      name: 'paid + delivery + shipment NULL',
      patch: {},
      expected: true,
    },
    {
      name: 'paid + delivery + ID shipment tersedia',
      patch: { biteship_order_id: 'shp_123' },
      expected: false,
    },
    {
      name: 'paid + pickup + tanpa shipment',
      patch: { delivery_option: 'pickup' },
      expected: false,
    },
    {
      name: 'unpaid + delivery + tanpa shipment',
      patch: { payment_status: 'unpaid' },
      expected: false,
    },
    {
      name: 'payment failed + delivery + tanpa shipment',
      patch: { payment_status: 'failed' },
      expected: false,
    },
    {
      name: 'payment refunded + delivery + tanpa shipment',
      patch: { payment_status: 'refunded' },
      expected: false,
    },
    {
      name: 'payment NULL + delivery + tanpa shipment',
      patch: { payment_status: null },
      expected: false,
    },
    {
      name: 'delivery_option NULL + tanpa shipment',
      patch: { delivery_option: null },
      expected: false,
    },
  ];

  for (const { name, patch, expected } of cases) {
    assert.equal(
      derive(patch).paid_without_shipment,
      expected,
      name
    );
  }
});

test('paid_without_shipment tidak bergantung pada order_status/lifecycle/progress', () => {
  // Flag ini murni pembayaran + opsi kirim + keberadaan ID shipment.
  for (const orderStatus of ['paid', 'processing', 'completed', 'cancelled', 'refunded', null]) {
    assert.equal(
      derive({ order_status: orderStatus }).paid_without_shipment,
      true,
      `order_status=${String(orderStatus)}`
    );
  }
  for (const lifecycle of ['ongoing', 'completed', null]) {
    assert.equal(
      derive({ lifecycle_status: lifecycle }).paid_without_shipment,
      true,
      `lifecycle_status=${String(lifecycle)}`
    );
  }
  for (const progress of ['disiapkan', 'siap-diambil', 'diantar', null]) {
    assert.equal(
      derive({ progress_status: progress }).paid_without_shipment,
      true,
      `progress_status=${String(progress)}`
    );
  }
});

// ---------------------------------------------------------------------------
// 2. has_shipment — kontrak saat ini
// ---------------------------------------------------------------------------

test('has_shipment: ID string non-null dianggap ada; null/undefined/non-string tidak', () => {
  assert.equal(derive({ biteship_order_id: 'shp_123' }).has_shipment, true);
  assert.equal(derive({ biteship_order_id: null }).has_shipment, false);
  assert.equal(derive({ biteship_order_id: undefined }).has_shipment, false);
  assert.equal(derive({ biteship_order_id: 123 }).has_shipment, false);
  assert.equal(derive({ biteship_order_id: '' }).has_shipment, true);
});

// ---------------------------------------------------------------------------
// 3. lifecycle_mismatch — aturan aktual, termasuk yang belum disepakati
// ---------------------------------------------------------------------------

test('lifecycle_mismatch: kombinasi yang jelas tidak sinkron', () => {
  const cases: Array<{
    name: string;
    patch: OrderMonitoringSource;
    expected: boolean;
  }> = [
    {
      name: 'lifecycle completed + order completed = sinkron',
      patch: { lifecycle_status: 'completed', order_status: 'completed' },
      expected: false,
    },
    {
      name: 'lifecycle ongoing + order processing = sinkron',
      patch: { lifecycle_status: 'ongoing', order_status: 'processing' },
      expected: false,
    },
    {
      name: 'lifecycle completed + order paid = mismatch',
      patch: { lifecycle_status: 'completed', order_status: 'paid' },
      expected: true,
    },
    {
      name: 'lifecycle completed + order refunded = mismatch',
      patch: { lifecycle_status: 'completed', order_status: 'refunded' },
      expected: true,
    },
    {
      name: 'lifecycle completed + order cancelled = mismatch',
      patch: { lifecycle_status: 'completed', order_status: 'cancelled' },
      expected: true,
    },
    {
      name: 'lifecycle ongoing + order completed = mismatch',
      patch: { lifecycle_status: 'ongoing', order_status: 'completed' },
      expected: true,
    },
    {
      name: 'lifecycle NULL + order NULL = tidak dinilai mismatch',
      patch: { lifecycle_status: null, order_status: null },
      expected: false,
    },
    {
      name: 'status tidak dikenal = tidak dinilai mismatch',
      patch: { lifecycle_status: 'unknown', order_status: 'unknown' },
      expected: false,
    },
  ];

  for (const { name, patch, expected } of cases) {
    assert.equal(
      derive(patch).lifecycle_mismatch,
      expected,
      name
    );
  }
});

test('KEPUTUSAN BELUM DISETUJUI: cancelled + lifecycle ongoing saat ini mismatch', () => {
  // Alur pembatalan seller/buyer hanya mengubah order_status menjadi cancelled;
  // lifecycle_status tetap ongoing. Implementasi saat ini menandai SEMUA
  // pembatalan normal sebagai lifecycle_mismatch. Apakah pembatalan seharusnya
  // dianggap "selesai" secara lifecycle, atau aturan flag ini terlalu luas,
  // adalah keputusan produk yang belum disetujui.
  assert.equal(
    derive({ order_status: 'cancelled', lifecycle_status: 'ongoing' }).lifecycle_mismatch,
    true
  );
});

test('KEPUTUSAN BELUM DISETUJUI: refunded + lifecycle ongoing saat ini TIDAK mismatch', () => {
  // Kebalikan dari cancelled + ongoing: order refunded dengan lifecycle ongoing
  // tidak ditandai. Belum ada dasar produk untuk menyamakan atau membedakan
  // kedua keadaan terminal ini.
  assert.equal(
    derive({ order_status: 'refunded', lifecycle_status: 'ongoing' }).lifecycle_mismatch,
    false
  );
});

test('KEPUTUSAN BELUM DISETUJUI: cancelled + lifecycle NULL saat ini TIDAK mismatch', () => {
  // Order lama dapat memiliki lifecycle NULL. Flag saat ini hanya menangkap
  // cancelled + ongoing, sehingga data lama yang statusnya tidak lengkap lolos.
  assert.equal(
    derive({ order_status: 'cancelled', lifecycle_status: null }).lifecycle_mismatch,
    false
  );
});

test('KEPUTUSAN BELUM DISETUJUI: completed + lifecycle NULL saat ini TIDAK mismatch', () => {
  assert.equal(
    derive({ order_status: 'completed', lifecycle_status: null }).lifecycle_mismatch,
    false
  );
});

test('status di luar casing kontrak DB tidak dinormalisasi oleh flag', () => {
  // CHECK database menyimpan status lowercase. Tes ini mengunci perilaku
  // implementasi saat ini untuk data di luar kontrak; bukan rekomendasi.
  const flags = derive({
    payment_status: 'PAID',
    delivery_option: 'Delivery',
    order_status: 'Completed',
    lifecycle_status: 'Ongoing',
  });
  assert.equal(flags.paid_without_shipment, false);
  assert.equal(flags.lifecycle_mismatch, false);
});

// ---------------------------------------------------------------------------
// 4. legacy_no_progress
// ---------------------------------------------------------------------------

test('legacy_no_progress: hanya progress NULL/tidak tersedia', () => {
  for (const progress of ['disiapkan', 'siap-diambil', 'diantar', '', 'unknown']) {
    assert.equal(
      derive({ progress_status: progress }).legacy_no_progress,
      false,
      `progress=${progress}`
    );
  }
  for (const progress of [null, undefined, 0]) {
    assert.equal(
      derive({ progress_status: progress }).legacy_no_progress,
      true,
      `progress=${String(progress)}`
    );
  }
});

test('legacy_no_progress tidak bergantung pada status pesanan', () => {
  for (const orderStatus of ['pending', 'paid', 'processing', 'completed', 'cancelled', 'refunded']) {
    assert.equal(
      derive({ order_status: orderStatus, progress_status: null }).legacy_no_progress,
      true,
      `order_status=${orderStatus}`
    );
  }
});

// ---------------------------------------------------------------------------
// 5. "Perlu dicek" — antrean UI
// ---------------------------------------------------------------------------

test('orderNeedsAttention: hanya paid_without_shipment + lifecycle_mismatch', () => {
  // Gunakan ID shipment agar baseline tidak punya flag tindakan.
  const base = deriveOrderMonitoringFlags({ ...BASE, biteship_order_id: 'shp_123' });
  assert.equal(orderNeedsAttention(base), false);

  assert.equal(
    orderNeedsAttention({ ...base, paid_without_shipment: true }),
    true
  );
  assert.equal(
    orderNeedsAttention({ ...base, lifecycle_mismatch: true }),
    true
  );
  assert.equal(
    orderNeedsAttention({ ...base, legacy_no_progress: true }),
    false,
    'legacy_no_progress bukan antrean tindakan admin'
  );
});

// ---------------------------------------------------------------------------
// 6. Kasus pembayaran terminal yang belum diputuskan
// ---------------------------------------------------------------------------

test('KEPUTUSAN BELUM DISETUJUI: paid + cancelled/refunded tanpa shipment tetap flag aktif', () => {
  // Secara literal "paid tanpa shipment" benar, tetapi pesanan yang sudah
  // cancelled/refunded memang tidak seharusnya dikirim. Perlu keputusan apakah
  // flag harus mengecualikan status terminal atau tetap dipakai untuk audit
  // pembayaran/refund yang belum selesai.
  for (const orderStatus of ['cancelled', 'refunded']) {
    assert.equal(
      derive({
        payment_status: 'paid',
        order_status: orderStatus,
        delivery_option: 'delivery',
        biteship_order_id: null,
      }).paid_without_shipment,
      true,
      `order_status=${orderStatus}`
    );
  }
});

test('KEPUTUSAN BELUM DISETUJUI: ID shipment string kosong dianggap ada', () => {
  // DB tidak memiliki CHECK non-empty untuk biteship_order_id. Bila data lama
  // berisi string kosong, endpoint saat ini menganggap shipment sudah ada,
  // sehingga paid_without_shipment tidak aktif. Perlu keputusan/validasi data
  // sebelum semantik diubah.
  const flags = derive({ biteship_order_id: '' });
  assert.equal(flags.has_shipment, true);
  assert.equal(flags.paid_without_shipment, false);
});

// ---------------------------------------------------------------------------
// 7. Bukti integrasi: route dan UI memakai derivasi yang sama
// ---------------------------------------------------------------------------

test('endpoint admin memakai helper derivasi yang diuji, bukan logika inline', () => {
  const route = readProjectFile('app/api/admin/orders/route.ts');
  assert.match(route, /import \{ deriveOrderMonitoringFlags \} from '@\/lib\/order-monitoring-flags'/);
  assert.match(route, /const flags = deriveOrderMonitoringFlags\(\{/);
  assert.match(route, /flags,/);
  assert.doesNotMatch(route, /const paidWithoutShipment =/);
  assert.doesNotMatch(route, /const lifecycleMismatch =/);
  assert.doesNotMatch(route, /const legacyNoProgress =/);
});

test('UI "Perlu dicek" memakai helper yang sama dan tidak menghitung legacy', () => {
  const ui = readProjectFile('app/components/admin/orders-management-view.tsx');
  assert.match(ui, /import \{ orderNeedsAttention \} from '@\/lib\/order-monitoring-flags'/);
  assert.match(ui, /orderNeedsAttention\(item\.flags\)/);
  assert.doesNotMatch(ui, /function perluPerhatian/);
});
