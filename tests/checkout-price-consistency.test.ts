/**
 * Tahap 1 — konsistensi harga & keamanan checkout (lokal, tanpa browser/DB).
 *
 * Membuktikan:
 * - Harga efektif untuk display mengikuti aturan harga server (surplus_price,
 *   ditimpa flash_sale_price hanya di dalam rentang flash sale; batas awal
 *   inklusif, batas akhir eksklusif).
 * - Server checkout tidak pernah membaca harga/total dari body klien.
 * - Server menghitung unit price dari DB dan nominal invoice selalu dari
 *   pricing.total (bukan angka kiriman klien).
 * - Payload checkout klien tidak memuat field harga/total apa pun.
 * - Redirect ke Xendit ditahan bila total server ≠ total yang tampil.
 * - Verify Xendit fail-closed: tidak settle tanpa nominal finite.
 * - Riwayat status pesanan dikaitkan ke orders.id (kolom NOT NULL).
 *
 * Jalankan: node --test tests/checkout-price-consistency.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { resolveEffectiveUnitPrice } from '../lib/flash-pricing.ts';

const read = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const CHECKOUT_ROUTE = 'app/api/checkout/xendit/route.ts';
const CONTEXT = 'app/components/checkout/checkout-context.tsx';
const VERIFY_ROUTE = 'app/api/checkout/xendit/verify/route.ts';
const STATE_MACHINE = 'lib/order-state-machine.ts';

// ---------------------------------------------------------------------------
// Harga efektif (display) = aturan harga server
// ---------------------------------------------------------------------------

test('tanpa flash sale: surplus_price dipakai', () => {
  assert.equal(
    resolveEffectiveUnitPrice({ surplus_price: 10000, original_price: 20000 }),
    10000
  );
});

test('flash sale aktif menimpa surplus_price', () => {
  const row = {
    surplus_price: 10000,
    original_price: 20000,
    flash_sale_price: 7000,
    flash_sale_start: '2026-01-01T00:00:00.000Z',
    flash_sale_end: '2026-01-01T01:00:00.000Z',
  };
  assert.equal(
    resolveEffectiveUnitPrice(row, Date.parse('2026-01-01T00:30:00.000Z')),
    7000
  );
});

test('batas rentang flash sale: awal inklusif, akhir eksklusif (sama seperti server)', () => {
  const row = {
    surplus_price: 10000,
    flash_sale_price: 7000,
    flash_sale_start: '2026-01-01T00:00:00.000Z',
    flash_sale_end: '2026-01-01T01:00:00.000Z',
  };
  const start = Date.parse('2026-01-01T00:00:00.000Z');
  const end = Date.parse('2026-01-01T01:00:00.000Z');
  assert.equal(resolveEffectiveUnitPrice(row, start), 7000);
  assert.equal(resolveEffectiveUnitPrice(row, start - 1), 10000);
  assert.equal(resolveEffectiveUnitPrice(row, end), 10000);
});

test('tanggal flash sale tidak lengkap/tidak valid: kembali ke surplus_price', () => {
  assert.equal(
    resolveEffectiveUnitPrice({ surplus_price: 10000, flash_sale_price: 7000 }),
    10000
  );
  assert.equal(
    resolveEffectiveUnitPrice({
      surplus_price: 10000,
      flash_sale_price: 7000,
      flash_sale_start: 'bukan-tanggal',
      flash_sale_end: '2026-01-01T01:00:00.000Z',
    }),
    10000
  );
});

test('surplus_price null jatuh ke original_price; keduanya kosong = 0', () => {
  assert.equal(
    resolveEffectiveUnitPrice({ surplus_price: null, original_price: 20000 }),
    20000
  );
  assert.equal(resolveEffectiveUnitPrice({}), 0);
});

test('nilai non-finite tidak dipakai sebagai harga', () => {
  assert.equal(
    resolveEffectiveUnitPrice({ surplus_price: Number.NaN, original_price: 20000 }),
    20000
  );
});

// ---------------------------------------------------------------------------
// Sumber harga di server
// ---------------------------------------------------------------------------

test('server checkout: tidak ada satu pun pembacaan harga/total dari body klien', () => {
  const source = read(CHECKOUT_ROUTE);
  assert.doesNotMatch(
    source,
    /body\.(unitPrice|unit_price|subtotal|total|totalPrice|price|amount|discount|serviceFee|deliveryFee)/
  );
});

test('server checkout: unit price dari kolom DB, invoice & pesanan memakai pricing.total', () => {
  const source = read(CHECKOUT_ROUTE);
  assert.match(
    source,
    /let unitPrice = product\.surplus_price \?\? product\.original_price \?\? 0;/
  );
  assert.match(source, /unitPrice = product\.flash_sale_price;/);
  assert.match(source, /amount: pricing\.total,/);
  assert.match(source, /total_price: pricing\.total,/);
});

// ---------------------------------------------------------------------------
// Payload klien
// ---------------------------------------------------------------------------

test('payload checkout klien tidak memuat harga/total (server menolak dimanipulasi)', () => {
  const source = read(CONTEXT);
  const start = source.indexOf('const payload: Record<string, unknown> = {');
  assert.notEqual(start, -1, 'literal payload tidak ditemukan');
  const end = source.indexOf('};', start);
  assert.ok(end > start);
  const payload = source.slice(start, end);
  assert.doesNotMatch(payload, /(price|total|amount|subtotal|fee)\s*:/i);
  assert.match(source, /'Idempotency-Key': idempotencyKey/);
});

// ---------------------------------------------------------------------------
// Konfirmasi perubahan harga sebelum bayar
// ---------------------------------------------------------------------------

test('checkout menahan redirect ke Xendit bila total server berbeda dari tampilan', () => {
  const source = read(CONTEXT);
  assert.match(source, /serverTotal\s*!==\s*summary\.total/);
  assert.match(source, /setPendingInvoiceReview\(/);
  const dialog = read('app/components/checkout/checkout-price-review-dialog.tsx');
  assert.match(dialog, /pendingInvoiceReview/);
  assert.match(dialog, /continueToInvoice/);
});

// ---------------------------------------------------------------------------
// Verify & riwayat status
// ---------------------------------------------------------------------------

test('verify Xendit fail-closed tanpa nominal finite', () => {
  const source = read(VERIFY_ROUTE);
  assert.match(source, /!Number\.isFinite\(paidAmount\)/);
  assert.doesNotMatch(source, /Number\(invoice\.amount \?\? NaN\)/);
});

test('riwayat status pesanan dikaitkan ke orders.id (kolom NOT NULL)', () => {
  const source = read(STATE_MACHINE);
  assert.match(source, /\.select\('id, order_status, order_code,/);
  assert.match(source, /order_id: \(order as Record<string, any>\)\.id,/);
});
