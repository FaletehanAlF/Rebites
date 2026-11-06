/**
 * Tes regresi bug pelepasan stok (P0-B) pada trigger guard_orders_update.
 *
 * Latar: supabase/migrations/20261007000002_p0b_stock_order_state_security.sql
 * semula memanggil `PERFORM public.release_stock(...)` (hasil boolean dibuang)
 * lalu mengisi `stock_released_at := now()` TANPA memedulikan keberhasilan
 * pelepasan. Bila release_stock mengembalikan false (slug produk tidak
 * ditemukan — produk di-rename / barisnya hilang, atau quantity <= 0), stok
 * tidak dikembalikan tetapi marker tetap terisi → guard idempotensi memblokir
 * pecobaan rilis apa pun → stok hilang permanen tanpa pemulihan otomatis.
 *
 * File ini berisi DUA lapis tes, dibedakan jelas:
 *
 * A. TES LOGIKA MURNI (tanpa database, tanpa pembacaan sumber):
 *    simulasi TypeScript dari blok pelepasan stok pada trigger. Membuktikan
 *    perilaku transisi state: sukses → marker terisi tepat-1x dan idempotent;
 *    gagal → marker dibiarkan NULL (fail-open + retry), transisi status tetap
 *    commit (TIDAK ada exception), stok tidak berubah, dan retry berikutnya
 *    (produk pulih) melepas stok tepat-1x..Transkripsi ini harus tetap
 *    sinkron dengan SQL — kaitannya dijaga oleh lapis B.
 *
 * B. TES POLA SUMBER (pembacaan file migrasi, pola yang sama dengan
 *    tests/checkout-failure-handling.test.ts): memastikan SQL nyata tidak lagi
 *    mengabaikan hasil release_stock (tidak ada `PERFORM public.release_stock`),
 *    memanggilnya di dalam cabang bersyarat, menandai marker HANYA di jalur
 *    sukses, masih memiliki RAISE WARNING, dan wrapper release_order_stock
 *    tetap berbasis marker.
 *
 * C. Batas bukti — TIDAK dibuktikan di sini:
 *    - Perilaku trigger PostgreSQL sesungguhnya (row lock, atomik before row
 *      update, urutan trigger) tidak dapat dibuktikan oleh tes TypeScript.
 *      File supabase/tests/stock_release_guard.sql (pgTAP, TIDAK dijalankan
 *      otomatis, lihat catatannya) khusus membuktikan perilaku trigger
 *      end-to-end terhadap database sungguhan.
 *    - Interaksi dengan trigger lain (koin P1-A, invoice_state 2D-E,
 *      activity log) tidak diuji di sini.
 *
 * Jalankan: node --test tests/stock-release-guard.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ===========================================================================
// A. TES LOGIKA MURNI — simulasi blok pelepasan stok trigger
// ===========================================================================

type TriggerRow = {
  order_code: string;
  order_status: string;
  payment_status: string;
  lifecycle_status: string;
  quantity: number;
  product_slug: string | null;
  // timestamp disimulasikan sebagai angka monotok (1, 2, 3, ...)
  // null = NULL di SQL.
  stock_reserved_at: number | null;
  stock_released_at: number | null;
};

type ProductRow = { stock: number; sold_count: number; status: string };

type DbState = {
  clock: number;
  products: Map<string, ProductRow>;
  releaseCalls: Array<{ slug: string; quantity: number }>;
  warnings: string[];
  exceptions: string[];
};

function makeState(products: Record<string, ProductRow> = {}): DbState {
  return {
    clock: 1,
    products: new Map(Object.entries(products)),
    releaseCalls: [],
    warnings: [],
    exceptions: [],
  };
}

/** Transkripsi setia dari public.release_stock (migration 0013). */
function releaseStock(state: DbState, slug: string | null, quantity: number): boolean {
  if (slug === null) throw new Error('panggilan SQL tidak mungkin dengan slug NULL');
  state.releaseCalls.push({ slug, quantity });
  if (quantity === null || quantity <= 0) return false;
  const product = state.products.get(slug);
  if (!product) return false; // UPDATE ... WHERE slug = slug → 0 baris
  product.stock += quantity;
  product.sold_count = Math.max(0, product.sold_count - quantity);
  if (product.stock > 0 && product.status === 'sold_out') product.status = 'available';
  return true;
}

/** Transkripsi setia dari blok pelepasan stok pada guard_orders_update. */
function guardReleaseBlock(oldRow: TriggerRow, newRow: TriggerRow, state: DbState): TriggerRow {
  const next = { ...newRow };
  if (
    next.stock_reserved_at !== null &&
    oldRow.stock_released_at === null &&
    next.stock_released_at === null &&
    (next.order_status === 'cancelled' || next.order_status === 'failed' || next.payment_status === 'failed') &&
    next.order_status !== 'completed' &&
    next.lifecycle_status !== 'completed' &&
    next.quantity > 0
  ) {
    if (next.product_slug === null) {
      next.stock_released_at = state.clock++;
    } else if (releaseStock(state, next.product_slug, next.quantity)) {
      next.stock_released_at = state.clock++;
    } else {
      state.warnings.push(`pelepasan stok GAGAL untuk order ${oldRow.order_code} (produk ${next.product_slug})`);
      // marker sengaja TIDAK diisi; tidak ada exception (fail-open + retry)
    }
  }
  return next;
}

function baseRow(overrides: Partial<TriggerRow> = {}): TriggerRow {
  return {
    order_code: 'RB-1',
    order_status: 'pending',
    payment_status: 'unpaid',
    lifecycle_status: 'ongoing',
    quantity: 2,
    product_slug: 'gulai-ayam',
    stock_reserved_at: 1,
    stock_released_at: null,
    ...overrides,
  };
}

test('logika: pembatalan sukses melepas stok tepat-1x dan marker idempotent', () => {
  const state = makeState({ 'gulai-ayam': { stock: 0, sold_count: 2, status: 'sold_out' } });
  const oldRow = baseRow();
  const cancelled = guardReleaseBlock(oldRow, baseRow({ order_status: 'cancelled' }), state);
  assert.equal(state.releaseCalls.length, 1, 'stok dilepas tepat 1x');
  assert.ok(cancelled.stock_released_at !== null, 'marker terisi saat sukses');
  assert.equal(state.products.get('gulai-ayam')!.stock, 2, 'stok kembali +quantity');
  assert.equal(state.products.get('gulai-ayam')!.sold_count, 0);
  assert.equal(state.products.get('gulai-ayam')!.status, 'available');

  // Update berikutnya pada order yang sama: OLD sudah ber-marker → tidak rilis lagi.
  const again = guardReleaseBlock(cancelled, { ...cancelled } as TriggerRow, state);
  assert.equal(state.releaseCalls.length, 1, 'idempotent: tidak ada rilis kedua');
  assert.equal(again.stock_released_at, cancelled.stock_released_at);
});

test('logika: kegagalan release_stock TIDAK mengisi marker dan TIDAK merollback transisi', () => {
  const state = makeState(); // produk tidak ada → release_stock false
  const oldRow = baseRow();
  const result = guardReleaseBlock(oldRow, baseRow({ order_status: 'cancelled', payment_status: 'unpaid' }), state);
  assert.equal(state.releaseCalls.length, 1, 'percobaan rilis dilakukan');
  assert.equal(result.order_status, 'cancelled', 'transisi status tetap commit (fail-open)');
  assert.equal(result.stock_released_at, null, 'marker dibiarkan NULL agar bisa di-retry');
  assert.equal(state.warnings.length, 1, 'warning tercatat untuk rekonsiliasi');
  assert.equal(state.exceptions.length, 0, 'tidak ada exception yang merollback order');
});

test('logika: gagal → produk pulih → retry berikutnya melepas stok tepat-1x', () => {
  const state = makeState(); // produk belum ada
  const oldRow = baseRow();
  let row = guardReleaseBlock(oldRow, baseRow({ order_status: 'cancelled' }), state);
  assert.equal(row.stock_released_at, null, 'percobaan pertama gagal: marker NULL');
  assert.equal(state.releaseCalls.length, 1);

  // Produk "pulih" (mis. slug diperbaiki admin).
  state.products.set('gulai-ayam', { stock: 0, sold_count: 2, status: 'sold_out' });

  // Retry via update tombol stuck (order tetap cancelled, marker masih NULL).
  row = guardReleaseBlock(row, { ...row } as TriggerRow, state);
  assert.equal(state.releaseCalls.length, 2, 'retry benar-benar dicoba lagi');
  assert.ok(row.stock_released_at !== null, 'marker terisi saat retry sukses');
  assert.equal(state.products.get('gulai-ayam')!.stock, 2, 'stok dilepas tepat-1x pada retry');

  // Retry setelah sukses: tidak ada rilis tambahan.
  guardReleaseBlock(row, { ...row } as TriggerRow, state);
  assert.equal(state.releaseCalls.length, 2, 'tidak ada pelepasan ganda');
});

test('logika: transisi failed karena pembayaran gagal juga melepas stok bersyarat', () => {
  const state = makeState({ 'gulai-ayam': { stock: 1, sold_count: 2, status: 'available' } });
  const result = guardReleaseBlock(
    baseRow(),
    baseRow({ order_status: 'pending', payment_status: 'failed' }),
    state
  );
  assert.equal(state.releaseCalls.length, 1);
  assert.ok(result.stock_released_at !== null);
  assert.equal(state.products.get('gulai-ayam')!.stock, 3);
});

test('logika: order completed / lifecycle completed TIDAK melepas stok', () => {
  const completedState = makeState({ 'gulai-ayam': { stock: 0, sold_count: 2, status: 'sold_out' } });
  const failedStatusCompleted = guardReleaseBlock(
    baseRow(),
    baseRow({ order_status: 'completed', payment_status: 'failed' }),
    completedState
  );
  assert.equal(completedState.releaseCalls.length, 0, 'order_status completed diblokir kondisi');
  assert.equal(failedStatusCompleted.stock_released_at, null);

  const lifeState = makeState();
  const lifeCompleted = guardReleaseBlock(
    baseRow(),
    baseRow({ order_status: 'failed', lifecycle_status: 'completed' }),
    lifeState
  );
  assert.equal(lifeState.releaseCalls.length, 0, 'lifecycle completed diblokir kondisi');
  assert.equal(lifeCompleted.stock_released_at, null);
});

test('logika: quantity 0 / NULL tidak pernah memicu blok rilis', () => {
  const state = makeState();
  let row = guardReleaseBlock(baseRow(), baseRow({ quantity: 0, order_status: 'cancelled' }), state);
  assert.equal(state.releaseCalls.length, 0);
  assert.equal(row.stock_released_at, null);
  row = guardReleaseBlock(baseRow(), baseRow({ quantity: 0, order_status: 'cancelled', stock_released_at: null }), state);
  assert.equal(state.releaseCalls.length, 0);
});

test('logika: order tanpa product_slug mengisi marker tanpa memanggil release_stock', () => {
  const state = makeState();
  const result = guardReleaseBlock(
    baseRow({ product_slug: null }),
    baseRow({ product_slug: null, order_status: 'cancelled' }),
    state
  );
  assert.equal(state.releaseCalls.length, 0, 'tidak ada pemanggilan release_stock');
  assert.ok(result.stock_released_at !== null, 'marker diisi: tidak ada stok terikat untuk dilepas');
});

test('logika: reservasi belum pernah dilakukan (stock_reserved_at NULL) → tidak ada rilis', () => {
  const state = makeState({ 'gulai-ayam': { stock: 5, sold_count: 0, status: 'available' } });
  const result = guardReleaseBlock(
    baseRow({ stock_reserved_at: null }),
    baseRow({ stock_reserved_at: null, order_status: 'cancelled' }),
    state
  );
  assert.equal(state.releaseCalls.length, 0);
  assert.equal(result.stock_released_at, null);
});

test('logika: dua pemanggil bersamaan (serialisasi via row-lock) tidak melepas ganda', () => {
  // Simulasi kasar atomisitas: kedua transaksi menulis baris order yang sama.
  // Transaksi kedua menunggu lock, lalu membaca OLD terbaru (marker dari yang
  // pertama bila sukses).
  const state = makeState({ 'gulai-ayam': { stock: 0, sold_count: 2, status: 'sold_out' } });
  const firstOld = baseRow();
  const firstWinner = guardReleaseBlock(firstOld, baseRow({ order_status: 'cancelled' }), state);
  const secondWinner = guardReleaseBlock(firstWinner, { ...firstWinner } as TriggerRow, state);
  assert.equal(state.releaseCalls.length, 1, 'dua request → tepat satu pelepasan');
  assert.ok(secondWinner.stock_released_at !== null);
});

// ===========================================================================
// B. TES POLA SUMBER — pembacaan supabase/migrations/20261007000002
// ===========================================================================

const migration = readFileSync(
  new URL('../supabase/migrations/20261007000002_p0b_stock_order_state_security.sql', import.meta.url),
  'utf8'
);

test('pola sumber: TIDAK lagi ada `PERFORM public.release_stock` (hasil dibuang)', () => {
  assert.doesNotMatch(migration, /PERFORM\s+public\.release_stock\b/, 'PERFORM membuang boolean — bug kembali jika dipakai lagi');
});

test('pola sumber: hasil release_stock diperiksa dalam cabang bersyarat', () => {
  assert.match(
    migration,
    /ELSIF\s+public\.release_stock\(NEW\.product_slug,\s*NEW\.quantity\)\s+THEN/,
    'pemanggilan release_stock harus di IF/ELSIF yang memeriksa hasilnya'
  );
});

test('pola sumber: `NEW.stock_released_at := now()` hanya di jalur sukses (2 cabang)', () => {
  const occurrences = migration.match(/NEW\.stock_released_at := now\(\);/g)?.length ?? 0;
  assert.equal(occurrences, 2, 'harus persis 2: cabang product_slug NULL dan cabang sukses — cabang gagal TIDAK boleh mengisi marker');
});

test('pola sumber: blok gagal menandai dengan RAISE WARNING (fail-open + retry)', () => {
  assert.match(migration, /RAISE\s+WARNING[\s\S]*?pelepasan stok GAGAL[\s\S]*?stock_released_at dibiarkan kosong/, 'jalur gagal harus selalu meninggalkan jejak di log');
});

test('pola sumber: wrapper release_order_stock tetap berbasis marker (idempoten)', () => {
  const wrapper = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.release_order_stock'));
  assert.match(wrapper, /stock_released_at IS NULL/, 'filter marker masih dipakai');
  assert.match(wrapper, /RETURN v_released IS NOT NULL/, 'return tetap berbasis marker');
});

test('pola sumber: trigger tetap terpasang pada tabel orders', () => {
  assert.match(migration, /CREATE TRIGGER trg_orders_guard_update\s*\n\s*BEFORE UPDATE ON public\.orders/);
});
