/**
 * Tes regresi penanganan kegagalan checkout (Tahap C — audit rollback/INSERT).
 *
 * Membuktikan tanpa database/Xendit (logika murni):
 * - classifyOrderWriteError: error INSERT definitif (penolakan PostgREST,
 *   punya kode) vs ambigu (jaringan/timeout/abort, tanpa kode).
 * - classifyReserveOutcome: klasifikasi hasil reservasi stok + marker
 *   stock_reserved_at sesuai kontrak RPC reserve_stock_for_order.
 * - planAbandonDeletion: keputusan rollback saat stok belum dilepas,
 *   transisi terminal tidak terkonfirmasi, dan kompensasi belum sukses.
 * - isInvoiceStateColumnMissingError: fallback kolom invoice_state HANYA
 *   untuk error skema (42703/PGRST204), bukan error jaringan/database lain.
 *
 * Membuktikan via pembacaan sumber (pola yang sama dengan
 * tests/checkout-idempotency.test.ts):
 * - I1: retensi order — abandonCheckoutOrder TIDAK menghapus baris; baris
 *   terminal dipertahankan sebagai jangkar rekonsiliasi,guard unpaid
 *   mencegah order paid diturunkan menjadi gagal.
 * - Tidak ada pelepasan stok mentah di jalur rollback (trigger P0-B satu-
 *   satunya jalur pelepasan setelah baris order ada).
 * - Jalur retry INSERT hanya untuk penolakan definitif (tidak bisa
 *   menciptakan order duplikat bila permintaan pertama sudah commit).
 * - Kompensasi (refund koin / rilis promo) tetap digerbangi pemenang
 *   transisi — tidak ada pelepasan ganda.
 * - I1: error createXenditInvoice jalur legacy memakai classifyInvoiceError
 *   (unknown → dipertahankan unpaid tanpa rollback; definitive → rollback).
 *
 * Batas bukti: alur I/O (Supabase, Xendit, trigger) TIDAK dibuktikan di sini
 * — lihat catatan keterbatasan di bagian bawah file.
 *
 * Jalankan: node --test tests/checkout-failure-handling.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import {
  classifyCompensationRpcResult,
  classifyOrderWriteError,
  classifyReserveOutcome,
  isInvoiceStateColumnMissingError,
  planAbandonDeletion,
} from '../lib/server/checkout-idempotency.ts';
import { interpretDebtWriteResult } from '../lib/server/coin-debit.ts';

const route = readFileSync(
  new URL('../app/api/checkout/xendit/route.ts', import.meta.url),
  'utf8'
);
const verify = readFileSync(
  new URL('../app/api/checkout/xendit/verify/route.ts', import.meta.url),
  'utf8'
);
const webhook = readFileSync(
  new URL('../app/api/webhooks/xendit/route.ts', import.meta.url),
  'utf8'
);
const settlement = readFileSync(
  new URL('../lib/server/order-settlement.ts', import.meta.url),
  'utf8'
);
const coinDebit = readFileSync(
  new URL('../lib/server/coin-debit.ts', import.meta.url),
  'utf8'
);
const p1cMigration = readFileSync(
  new URL(
    '../supabase/migrations/20261020000000_p1c_coin_refund_ledger_basis.sql',
    import.meta.url
  ),
  'utf8'
);

// ---------------------------------------------------------------------------
// Helper pembacaan sumber: ekstraksi fungsi trigger dari file migrasi.
// Dipakai oleh tes K-1 untuk membandingkan guard insert SECARA MENYELURUH
// dengan versi migrasi sebelumnya (bukan beberapa kolom terpilih).
// ---------------------------------------------------------------------------
const P1C_MIGRATION_FILE = '20261020000000_p1c_coin_refund_ledger_basis.sql';
const migrationsDir = new URL('../supabase/migrations/', import.meta.url);

function extractSqlFunction(source: string, name: string): string | null {
  const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}()`);
  if (start === -1) return null;
  const end = source.indexOf('$$;', start);
  if (end === -1) return null;
  return source.slice(start, end + 3);
}

/** Seluruh assignment `NEW.<kolom> := <nilai>` di dalam sebuah fungsi. */
function extractNewAssignments(fnBody: string): string[] {
  const found: string[] = [];
  const re = /NEW\.([a-z_]+)\s*:=\s*(NULL|'[^']*'|[0-9]+)\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fnBody)) !== null) {
    found.push(`${m[1]}=${m[2]}`);
  }
  return found.sort();
}

/** Definisi guard insert dari setiap migrasi SEBELUM P1-C, urut nama file. */
function guardDefinitionsBeforeP1C(): Array<{ file: string; body: string }> {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql') && f < P1C_MIGRATION_FILE)
    .sort()
    .map((file) => ({
      file,
      body: extractSqlFunction(
        readFileSync(new URL(file, migrationsDir), 'utf8'),
        'guard_orders_insert_client_defaults'
      ),
    }))
    .filter((d): d is { file: string; body: string } => d.body !== null);
}

// ---------------------------------------------------------------------------
// B. Klasifikasi error INSERT: definitif vs ambigu
// ---------------------------------------------------------------------------

test('classifyOrderWriteError: penolakan PostgREST berkode = definitif', () => {
  for (const code of ['23505', '42703', '23514', '42P01', 'PGRST204', 'PGRST116']) {
    assert.equal(
      classifyOrderWriteError({ code, message: 'pesan apa pun' }),
      'definitive',
      `kode ${code} harus definitif`
    );
  }
});

test('classifyOrderWriteError: jaringan/timeout/abort/ambil-arah = unknown', () => {
  const ambiguous = [
    new Error('TypeError: fetch failed'),
    new Error('fetch failed'),
    new Error('The operation was aborted'),
    new Error('network timeout'),
    // Kode kosong/whitespace bukan bukti penolakan database.
    { code: '', message: 'fetch failed' },
    { code: '   ', message: 'timeout' },
    {},
    'fetch failed',
    null,
    undefined,
    42,
  ];
  for (const err of ambiguous) {
    assert.equal(
      classifyOrderWriteError(err),
      'unknown',
      `harus unknown: ${JSON.stringify(String(err))}`
    );
  }
});

test('classifyOrderWriteError: error berkode tetap definitif (penolakan server)', () => {
  // Pesan yang menyebut kolom TIDAK mengubah klasifikasi: yang menentukan
  // adalah bukti penolakan server (kode), bukan teks pesan.
  assert.equal(
    classifyOrderWriteError({ code: '42703', message: 'column orders.shipping_snapshot does not exist' }),
    'definitive'
  );
});

// ---------------------------------------------------------------------------
// C. Klasifikasi hasil reservasi stok (RPC + marker)
// ---------------------------------------------------------------------------

test('classifyReserveOutcome: marker terkonfirmasi = reserved apa pun hasil respons', () => {
  // Kontrak RPC: decrement + marker ditulis satu transaksi. Marker terbaca =
  // reservasi terbukti, bahkan bila respons RPC hilang (error).
  assert.equal(
    classifyReserveOutcome({ reserved: undefined, error: new Error('fetch failed'), markerSet: true }),
    'reserved'
  );
  assert.equal(
    classifyReserveOutcome({ reserved: false, error: null, markerSet: true }),
    'reserved'
  );
});

test('classifyReserveOutcome: error RPC tanpa marker = kegagalan teknis (bukan stok habis)', () => {
  assert.equal(
    classifyReserveOutcome({ reserved: undefined, error: new Error('function reserve_stock_for_order does not exist'), markerSet: false }),
    'technical_error'
  );
  assert.equal(
    classifyReserveOutcome({ reserved: undefined, error: { message: 'permission denied' }, markerSet: false }),
    'technical_error'
  );
});

test('classifyReserveOutcome: reserved === false tanpa error = stok tidak cukup', () => {
  assert.equal(
    classifyReserveOutcome({ reserved: false, error: null, markerSet: false }),
    'insufficient_stock'
  );
});

test('classifyReserveOutcome: hasil null/aneh tanpa error = fail-safe technical_error', () => {
  assert.equal(classifyReserveOutcome({ reserved: undefined, error: null, markerSet: false }), 'technical_error');
  assert.equal(classifyReserveOutcome({ reserved: null, error: null, markerSet: false }), 'technical_error');
  assert.equal(classifyReserveOutcome({ reserved: 'yes', error: null, markerSet: false }), 'technical_error');
  // reserved === true tanpa marker: diterima (kontrak RPC), tapi pemanggil
  // route tetap membaca ulang baris sebelum melanjutkan.
  assert.equal(classifyReserveOutcome({ reserved: true, error: null, markerSet: false }), 'reserved');
});

// ---------------------------------------------------------------------------
// A. Keputusan rollback (hapus vs pertahan) saat stok belum dilepas
// ---------------------------------------------------------------------------

test('planAbandonDeletion: transisi terminal tidak terkonfirmasi = bukan pembatalan terkonfirmasi', () => {
  const plan = planAbandonDeletion({
    transitionConfirmed: false,
    stockReservedAt: null,
    stockReleasedAt: null,
    compensationSettled: true,
  });
  assert.equal(plan.transitionConfirmed, false);
  assert.equal(plan.mayDelete, false);
  assert.equal(plan.hold, 'transition_unconfirmed');
  // Status stok TIDAK diketahui (null) — bukan true.
  assert.equal(plan.stockReleased, null);
});

test('planAbandonDeletion: reserved tapi belum released = JANGAN hapus (status terminal saja tidak cukup)', () => {
  const plan = planAbandonDeletion({
    transitionConfirmed: true,
    stockReservedAt: '2026-10-17T00:00:00.000Z',
    stockReleasedAt: null,
    compensationSettled: true,
  });
  assert.equal(plan.stockReleased, false);
  assert.equal(plan.mayDelete, false);
  assert.equal(plan.hold, 'stock_not_released');
});

test('planAbandonDeletion: belum pernah reserved atau sudah released = stok tidak tertahan', () => {
  // Reservasi keyed belum berjalan (marker kosong).
  assert.equal(
    planAbandonDeletion({
      transitionConfirmed: true,
      stockReservedAt: null,
      stockReleasedAt: null,
      compensationSettled: true,
    }).stockReleased,
    true
  );
  // Trigger P0-B sudah melepas stok (marker pelepasan terisi).
  assert.equal(
    planAbandonDeletion({
      transitionConfirmed: true,
      stockReservedAt: '2026-10-17T00:00:00.000Z',
      stockReleasedAt: '2026-10-17T00:01:00.000Z',
      compensationSettled: true,
    }).stockReleased,
    true
  );
});

test('planAbandonDeletion: kompensasi koin/promo gagal = order dipertahankan untuk rekonsiliasi', () => {
  const plan = planAbandonDeletion({
    transitionConfirmed: true,
    stockReservedAt: '2026-10-17T00:00:00.000Z',
    stockReleasedAt: '2026-10-17T00:01:00.000Z',
    compensationSettled: false,
  });
  assert.equal(plan.mayDelete, false);
  assert.equal(plan.hold, 'compensation_pending');
  // Transisi tetap sah terkonfirmasi — hanya penghapusannya yang ditahan.
  assert.equal(plan.transitionConfirmed, true);
  assert.equal(plan.stockReleased, true);
});

test('planAbandonDeletion: semua syarat terpenuhi = boleh hapus', () => {
  const plan = planAbandonDeletion({
    transitionConfirmed: true,
    stockReservedAt: '2026-10-17T00:00:00.000Z',
    stockReleasedAt: '2026-10-17T00:01:00.000Z',
    compensationSettled: true,
  });
  assert.deepEqual({
    mayDelete: plan.mayDelete,
    hold: plan.hold,
    stockReleased: plan.stockReleased,
  }, { mayDelete: true, hold: null, stockReleased: true });
});

test('planAbandonDeletion: invariant — hapus hanya bila transisi + stok + kompensasi lengkap', () => {
  for (const transitionConfirmed of [true, false]) {
    for (const reserved of [null, 'x'] as Array<string | null>) {
      for (const released of [null, 'x'] as Array<string | null>) {
        for (const settled of [true, false]) {
          const plan = planAbandonDeletion({
            transitionConfirmed,
            stockReservedAt: reserved,
            stockReleasedAt: reserved === null ? null : released,
            compensationSettled: settled,
          });
          const stockReleased = reserved === null || released !== null;
          if (transitionConfirmed && stockReleased && settled) {
            assert.equal(plan.mayDelete, true);
            assert.equal(plan.hold, null);
          } else {
            assert.equal(plan.mayDelete, false);
            assert.notEqual(plan.hold, null);
          }
        }
      }
    }
  }
});

// ---------------------------------------------------------------------------
// D. Fallback kolom invoice_state: hanya error skema yang sesuai
// ---------------------------------------------------------------------------

test('isInvoiceStateColumnMissingError: 42703/PGRST204 yang menyebut kolom = true', () => {
  assert.equal(
    isInvoiceStateColumnMissingError({
      code: '42703',
      message: 'column orders.invoice_state does not exist',
    }),
    true
  );
  assert.equal(
    isInvoiceStateColumnMissingError({
      code: 'PGRST204',
      message: "Could not find the 'invoice_state' column of 'orders' in the schema cache",
    }),
    true
  );
  // Kode skema dengan pesan kosong: kolom baru satu-satunya pada payload
  // terminal, jadi tetap dianggap kolom itu (defensif).
  assert.equal(isInvoiceStateColumnMissingError({ code: '42703', message: '' }), true);
});

test('isInvoiceStateColumnMissingError: error jaringan / database non-skema = false', () => {
  // Jaringan/timeout: tanpa kode, pesan tidak menyebut kolom.
  assert.equal(isInvoiceStateColumnMissingError(new Error('fetch failed')), false);
  assert.equal(isInvoiceStateColumnMissingError(new Error('The operation was aborted')), false);
  // Pelanggaran CHECK yang kebetulan bernama ..._invoice_state_... (23514):
  // bukan bukti kolom hilang — JANGAN mengulang update tanpa invoice_state.
  assert.equal(
    isInvoiceStateColumnMissingError({
      code: '23514',
      message: 'new row for relation "orders" violates check constraint "orders_invoice_state_check"',
    }),
    false
  );
  // Schema-cache miss untuk KOLOM LAIN bukan bukti invoice_state hilang.
  assert.equal(
    isInvoiceStateColumnMissingError({
      code: 'PGRST204',
      message: "Could not find the 'shipping_snapshot' column of 'orders' in the schema cache",
    }),
    false
  );
  // Bentuk tak dikenal.
  assert.equal(isInvoiceStateColumnMissingError(null), false);
  assert.equal(isInvoiceStateColumnMissingError('invoice_state'), false);
  assert.equal(isInvoiceStateColumnMissingError({}), false);
});

test('isInvoiceStateColumnMissingError: tanpa kode, hanya pesan yang jelas menyebut kolom/skema', () => {
  // Error terbungkus tanpa konteks PostgREST, tetapi pesannya eksplisit.
  assert.equal(
    isInvoiceStateColumnMissingError(new Error('column orders.invoice_state does not exist')),
    true
  );
  assert.equal(
    isInvoiceStateColumnMissingError(new Error("invoice_state column missing from schema")),
    true
  );
  // Menyebut invoice_state tanpa konteks kolom/skema → tidak cukup.
  assert.equal(isInvoiceStateColumnMissingError(new Error('invoice_state gagal diproses')), false);
});

test('verify & webhook: fallback invoice_state digerbangi helper skema (bukan regex pesan mentah)', () => {
  for (const [name, src] of [['verify', verify], ['webhook', webhook]] as const) {
    assert.match(
      src,
      /isInvoiceStateColumnMissingError\(/,
      `${name}: fallback harus lewat helper klasifikasi skema`
    );
    // Pola lama yang terlalu luas tidak lagi dipakai.
    assert.doesNotMatch(src, /code === '42703'/, `${name}: tidak boleh cek kode mentah`);
    assert.doesNotMatch(src, /invoice_state\/i\.test\(/, `${name}: tidak boleh regex pesan mentah`);
  }
  // Fallback verify & webhook tetap tanpa invoice_state dan tetap tergerbangi
  // guard 'unpaid' (order paid tidak pernah diturunkan).
  assert.match(verify, /update\(\{ payment_status: 'failed', order_status: 'cancelled' \}/);
  assert.match(verify, /\.eq\('payment_status', 'unpaid'\)/);
  assert.match(webhook, /xendit_invoice_id: invoiceId,/);
  assert.match(webhook, /currentPayment === 'paid'/);
});

// ---------------------------------------------------------------------------
// A. Retensi order (I1): tanpa hard delete + guard unpaid; tidak ada
//    pelepasan stok mentah di jalur rollback (bukti level sumber)
// ---------------------------------------------------------------------------

const abandonStart = route.indexOf('const abandonCheckoutOrder = async (');
const rollbackStart = route.indexOf('const rollbackCheckoutOrder = async (');
const legacyFailureStart = route.indexOf('const handleLegacyInsertFailure = async (');
const claimGateStart = route.indexOf('const claimPromoAndSpendCoins = async (');

test('sumber route: hasil abandon dipropagasikan oleh rollbackCheckoutOrder (tidak dibuang)', () => {
  assert.ok(abandonStart !== -1 && rollbackStart !== -1 && legacyFailureStart !== -1);
  const rollbackBody = route.slice(rollbackStart, legacyFailureStart);
  assert.match(rollbackBody, /const abandonResult = await abandonCheckoutOrder\(/);
  assert.match(rollbackBody, /return abandonResult;/);
  // Kegagalan rollback dicatat eksplisit — tidak dianggap sukses diam-diam.
  assert.match(rollbackBody, /rollback belum terkonfirmasi penuh/);
});

test('sumber route: abandon TIDAK lagi menghapus pesanan (retensi I1)', () => {
  const abandonBody = route.slice(abandonStart, rollbackStart);
  // Hard delete dihilangkan dari jalur checkout rollback: baris terminal
  // selalu dipertahankan sebagai jangkar rekonsiliasi (retensi = perilaku
  // yang direncanakan I1, bukan penghapusan yang gagal diam-diam).
  assert.doesNotMatch(abandonBody, /\.delete\(\)/);
  assert.doesNotMatch(abandonBody, /deleteRows/);
  // Return abandon tidak lagi membawa saldo keputusan penghapusan.
  assert.doesNotMatch(abandonBody, /\bdeleted\b/);
});

test('sumber route: abandon mempertahankan order terminal secara sadar (log retensi, bukan kegagalan hapus)', () => {
  const abandonBody = route.slice(abandonStart, rollbackStart);
  // Retensi dicatat sebagai konsekuensi direncanakan bila semua syarat
  // transisi + stok + kompensasi terpenuhi.
  assert.match(abandonBody, /rollback: pesanan terminal DIPERTAHANKAN untuk rekonsiliasi/);
});

test('sumber route: transisi terminal abandon digerbangi payment_status unpaid (anti-downgrade paid)', () => {
  const abandonBody = route.slice(abandonStart, rollbackStart);
  // Guard unpaid ditambahkan pada UPDATE terminal (I1).
  assert.match(abandonBody, /\.eq\('payment_status', 'unpaid'\)/);
  // Baca-ulang mengenali pesanan yang sudah paid dan membiarkannya — paid
  // tidak pernah dibalik menjadi failed/cancelled.
  assert.match(abandonBody, /payment_status === 'paid'/);
});

test('sumber route: tidak ada pelepasan stok mentah di jalur rollback/abandon', () => {
  // release_stock (mentah) HANYA boleh dipanggil dari handleLegacyInsertFailure
  // — jalur yang membuktikan baris order TIDAK ADA (penolakan definitif /
  // baca-ulang kosong) sehingga trigger P0-B tidak mungkin menangani.
  assert.equal(route.match(/'release_stock'/g)?.length, 2, 'release_stock hanya 2 pemanggilan');
  const abandonBody = route.slice(abandonStart, rollbackStart);
  assert.doesNotMatch(abandonBody, /release_stock/);
  const rollbackBody = route.slice(rollbackStart, legacyFailureStart);
  assert.doesNotMatch(rollbackBody, /release_stock/);
  // Jalur klaim promo/koin (keyed/legacy) juga tanpa rilis stok mentah;
  // satu-satunya rilis mentah ada di handleLegacyInsertFailure (terbukti
  // tidak ada baris).
  const legacyFailureBody = route.slice(legacyFailureStart, claimGateStart);
  assert.ok(legacyFailureBody.includes("'release_stock'"));
});

test('sumber route: abandon memakai keputusan murni planAbandonDeletion', () => {
  const abandonBody = route.slice(abandonStart, rollbackStart);
  assert.match(abandonBody, /planAbandonDeletion\(\{/);
  assert.match(abandonBody, /compensationSettled: opts\.compensationSettled/);
});

// ---------------------------------------------------------------------------
// I1. Guard unpaid, retensi order, dan klasifikasi invoice legacy
// ---------------------------------------------------------------------------
test('sumber route: kegagalan invoice legacy memakai classifyInvoiceError (I1)', () => {
  const invoiceTryStart = route.indexOf('let invoice;');
  const invoiceBodyEnd = route.indexOf('const { error: notifErr }', invoiceTryStart);
  assert.ok(invoiceTryStart !== -1 && invoiceBodyEnd > invoiceTryStart);
  const invoiceBody = route.slice(invoiceTryStart, invoiceBodyEnd);
  // Klasifikasi dipakai di KEDUA jalur (keyed + legacy): dua situs klasifikasi.
  assert.equal(invoiceBody.match(/const cls = classifyInvoiceError\(e\)/g)?.length, 2);
  // Klasifikasi murni dijalankan SEBELUM penentuan nasib order.
  assert.match(invoiceBody, /if \(cls === 'unknown'\)/);
  assert.match(invoiceBody, /\/\/ I1 \(legacy invoice unknown\)/);
});

test('sumber route: invoice legacy unknown -> order DIPERTAHANKAN unpaid (tanpa rollback)', () => {
  const catchStart = route.indexOf('// I1 (legacy invoice unknown):');
  assert.ok(catchStart !== -1);
  const catchEnd = route.indexOf('// I1 (legacy invoice definitive):', catchStart);
  assert.ok(catchEnd !== -1 && catchEnd > catchStart);
  const unknownBlock = route.slice(catchStart, catchEnd);
  // Konservatif: hasil tidak diketahui bukan bukti invoice tidak ada —
  // TANPA refund koin, TANPA rilis promo, TANPA transisi terminal/penghapusan.
  assert.doesNotMatch(unknownBlock, /rollbackCheckoutOrder/);
  assert.doesNotMatch(unknownBlock, /failKeyedOrder/);
  assert.doesNotMatch(unknownBlock, /refund_order_coins/);
  assert.doesNotMatch(unknownBlock, /release_promo/);
  assert.doesNotMatch(unknownBlock, /failKeyedOrder\(|transitionInvoiceState/);
  // Respons retryable konsisten kontrak endpoint (409 + retryable).
  assert.match(unknownBlock, /retryable: true/);
  assert.match(unknownBlock, /status: 409/);
  assert.match(unknownBlock, /jangan submit ulang/);
});

test('sumber route: invoice legacy definitive -> rollback klasik (kompensasi penuh)', () => {
  const defStart = route.indexOf('// I1 (legacy invoice definitive):');
  assert.ok(defStart !== -1);
  const definitiveBlock = route.slice(defStart, route.indexOf('const { error: notifErr }', defStart));
  assert.match(definitiveBlock, /await rollbackCheckoutOrder\(orderCode, \{/);
  assert.match(definitiveBlock, /promoClaimed: body\.promoCode != null && promoPercentOff != null/);
  assert.match(definitiveBlock, /refundCoins: pricing\.coinUsed > 0/);
  assert.match(definitiveBlock, /phase: 'post_gate'/);
});

// ---------------------------------------------------------------------------
// B. Retry INSERT hanya untuk penolakan definitif (anti order duplikat)
// ---------------------------------------------------------------------------

test('sumber route: jalur retry kolom skema digerbangi klasifikasi definitif', () => {
  // Tiga pemakaian klasifikasi definitif: satu di handleLegacyInsertFailure
  // (pelepasan stok mentah terbukti-tiada-baris) + penugasan insertDefinitive
  // (jalur paid) + gate langsung (jalur free order).
  assert.equal(
    route.match(/classifyOrderWriteError\(insertErr\) === 'definitive'/g)?.length,
    3
  );
  // Retry snapshot/kurir dan retry relasi (umkm_id/product_id) sama-sama
  // digerbangi flag definitif.
  assert.equal(route.match(/insertDefinitive && \(/g)?.length, 2);
  assert.match(
    route,
    /insertDefinitive && \(insertErr\.message\.includes\('shipping_snapshot'\)/
  );
  assert.match(
    route,
    /insertDefinitive && \(insertErr\.message\.includes\('umkm_id'\)/
  );
});

// ---------------------------------------------------------------------------
// Kompensasi: tidak ada pelepasan/refund ganda (level keputusan)
// ---------------------------------------------------------------------------

test('sumber route: rilis promo di rollback digerbangi flag klaim, bukan spekulatif', () => {
  const rollbackBody = route.slice(rollbackStart, legacyFailureStart);
  // Hanya jalan bila promo memang terklaim dan kodenya ada.
  assert.match(rollbackBody, /opts\.promoClaimed && checkoutPromoCode/);
  // Refund koin hanya bila diminta (spend benar-benar tercatat).
  assert.match(rollbackBody, /if \(opts\.refundCoins\)/);
  // Status kompensasi diteruskan ke abandon untuk penyaringan log rekonsiliasi
  // (penghapusan tidak ada lagi; hanya penentuan severity catatan).
  assert.match(rollbackBody, /compensationSettled: refundOk && promoOk/);
});

test('sumber route: webhook/verify merilis promo hanya untuk pemenang transisi', () => {
  for (const [name, src] of [['webhook', webhook], ['verify', verify]] as const) {
    assert.match(src, /planTerminalPromoRelease\(\{[^}]*updateWon:/s, name);
    assert.match(src, /refund_order_coins/, name);
  }
  // Refund koin verify hanya untuk pemenang transisi terminal.
  assert.match(verify, /cancelled && cancelled\.length > 0 && row\.buyer_id/);
  assert.match(webhook, /expiredRows && expiredRows\.length > 0 && row\.buyer_id/);
});

// ---------------------------------------------------------------------------
// Keterbatasan bukti (perlu database/integrasi, TIDAK dipura-pura lolos di
// sini):
// 1. Trigger P0-B/P1-A benar-benar melepas stok/mengembalikan koin tepat
//    sekali pada transisi terminal — butuh database sungguhan.
// 2. Perilaku 23505 partial UNIQUE index (buyer_id, idempotency_key) pada
//    klaim idempotensi paralel.
// 3. reserve_stock_for_order: rollback EXCEPTION ketika klaim marker gagal
//    (decrement yatim tidak ter-commit) — butuh transaksi nyata.
// 4. PostgREST benar-benar mengirim kode 42703/PGRST204 pada skema tanpa
//    kolom invoice_state (klasifikasi diuji unit; bentuk responsnya tidak).
// Saran uji integrasi aman: staging database + kunci idempotensi unik per
// run, tanpa menyentuh data produksi (lihat laporan audit).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Kompensasi RPC: hasil boolean TIDAK diabaikan (audit lanjutan). Kontrak per
// RPC (sumber of truth = SQL migration, bukan asumsi):
//   - release_stock:      false = TIDAK ada stok yang dilepas -> gagal keras.
//   - refund_order_coins: false BENIGN = tidak ada hold koin (order tanpa
//     koin / belum dipotong; IF NOT FOUND -> RETURN false).
//   - release_promo:      false BENIGN = UPDATE promo_codes 0 baris (no-op).
// ---------------------------------------------------------------------------

test('classifyCompensationRpcResult: RPC error = gagal (rpc_error)', () => {
  const verdict = classifyCompensationRpcResult({
    data: undefined,
    error: { message: 'duplicate key value' },
    requireSuccessData: false,
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, 'rpc_error');
});

test('classifyCompensationRpcResult: return false TANPA error + requireSuccessData = GAGAL', () => {
  // release_stock mengembalikan false (slug produk tidak ada) tanpa error:
  // HARUS dilaporkan gagal, bukan sukses.
  const verdict = classifyCompensationRpcResult({
    data: false,
    error: null,
    requireSuccessData: true,
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, 'data_not_true');
});

test('classifyCompensationRpcResult: return true = sukses', () => {
  const verdict = classifyCompensationRpcResult({
    data: true,
    error: null,
    requireSuccessData: true,
  });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.reason, 'ok');
});

test('classifyCompensationRpcResult: false BENIGN tanpa flag (koin/promo) = bukan kegagalan', () => {
  for (const data of [false, null, undefined]) {
    const verdict = classifyCompensationRpcResult({
      data,
      error: null,
      requireSuccessData: false,
    });
    assert.equal(verdict.ok, true, `data=${String(data)}`);
    assert.equal(verdict.reason, 'ok');
  }
});

test('sumber route: hasil RPC kompensasi diperiksa (data, error), bukan diabaikan', () => {
  assert.match(
    route,
    /const \{ data, error \} = await serviceClient\.rpc\(operation, params\);/
  );
  assert.match(route, /classifyCompensationRpcResult\(\{/);
  // Bentuk lama (mengabaikan data) tidak boleh kembali.
  assert.doesNotMatch(
    route,
    /const \{ error \} = await serviceClient\.rpc\(operation, params\);/
  );
});

test('sumber route: kedua pemanggil release_stock mengaktifkan requireSuccessData', () => {
  assert.equal(route.match(/requireSuccessData: true/g)?.length, 2);
  // Pengembalian koin & rilis promo TETAP toleran terhadap false (benign):
  // tidak ada yang memakai flag strict di situs kompensasi lain.
  for (const op of ['refund_order_coins', 'release_promo'] as const) {
    let found = 0;
    let idx = route.indexOf(`runCompensationRpc(orderCode, '${op}'`);
    while (idx !== -1) {
      const site = route.slice(idx, idx + 300);
      assert.doesNotMatch(site, /requireSuccessData/, `${op} site #${found}`);
      found += 1;
      idx = route.indexOf(`runCompensationRpc(orderCode, '${op}'`, idx + 1);
    }
    assert.ok(found > 0, `situs kompensasi ${op} ditemukan`);
  }
});

// ---------------------------------------------------------------------------
// Tahap 1.3: jalur free legacy — paid TIDAK BOLEH ditulis sebelum gate
// promo/koin selesai.
//
// Latar (audit 1.2): jalur free legacy menulis order sebagai
// payment_status='paid' SAAT INSERT. Kalau gate promo/koin lalu gagal,
// guard unpaid (I1) mencegah transisi terminal -> trigger P0-B tidak pernah
// melepas stok -> order tertinggal 'paid' + stok terkunci, tanpa log
// CRITICAL. Jalur keyed sudah aman (menulis unpaid/pending dulu, paid
// setelah gate) — Tahap 1.3 menyamakan jalur legacy.
// ---------------------------------------------------------------------------

const freePathStart = route.indexOf('if (pricing.total === 0) {');
const freePayloadStart = route.indexOf('const freeInsertPayload: Record<string, unknown> = {');
const freePayloadEnd = route.indexOf('};', freePayloadStart);
const freePayload = route.slice(freePayloadStart, freePayloadEnd);
const freeGateIdx = route.indexOf('await claimPromoAndSpendCoins(', freePathStart);
const freePaidMarkIdx = route.indexOf(
  ".update({ payment_status: 'paid', order_status: 'paid' }",
  freePathStart
);
const legacyMismatchStart = route.indexOf('const handleLegacyFreePaidMarkFailure = async (');
const legacyMismatchEnd = route.indexOf('if (idempotencyKey) {', legacyMismatchStart);
const legacyMismatchBody = route.slice(legacyMismatchStart, legacyMismatchEnd);
const legacyMismatchCode = legacyMismatchBody
  .split('\n')
  .filter((l) => !l.trim().startsWith('//'))
  .join('\n');

test('Tahap 1.3: order free ditulis unpaid/pending, tidak pernah lahir paid', () => {
  assert.ok(freePathStart !== -1 && freePayloadStart !== -1 && freePayloadEnd > freePayloadStart);
  // Status awal order free = unpaid/pending (identik jalur keyed & jalur paid).
  assert.match(freePayload, /payment_status: 'unpaid'/);
  assert.match(freePayload, /order_status: 'pending'/);
  // 'paid' di payload = order yang TIDAK bisa dikompensasi (bug audit 1.2).
  assert.doesNotMatch(freePayload, /payment_status: 'paid'/);
  assert.doesNotMatch(freePayload, /order_status: 'paid'/);
});

test('Tahap 1.3: penandaan paid di jalur free terjadi SETELAH gate promo/koin', () => {
  assert.ok(freePathStart !== -1);
  assert.ok(freeGateIdx > freePathStart, 'gate promo/koin harus ada di jalur free');
  assert.ok(freePaidMarkIdx > freeGateIdx, 'paid tidak boleh ditulis sebelum gate selesai');
  // Penandaan paid = UPDATE kondisional (hanya berhasil bila masih unpaid).
  const markBlock = route.slice(freePaidMarkIdx, freePaidMarkIdx + 700);
  assert.match(markBlock, /\.eq\('payment_status', 'unpaid'\)/);
  assert.match(markBlock, /payment_status: 'paid'/);
});

type FreeTimelineRow = {
  event: 'insert' | 'gate' | 'earn' | 'paid_mark' | 'compensate';
  payment_status: 'unpaid' | 'paid' | 'failed';
  order_status: 'pending' | 'paid' | 'cancelled';
  stock_released_at: string | null;
};

/**
 * Transkripsi timeline status order free.
 *
 * `bornPaid` diambil dari payload route (bukan asumsi): bila payload menulis
 * 'paid' lagi, simulasi ikut memodelkan order yang lahir paid — persis
 * kondisi yang ditemukan audit 1.2, sehingga tes ini gagal kalau regresi itu
 * dikembalikan.
 *
 * Gate gagal -> rollback terpusat: transisi terminal HANYA mungkin bila order
 * masih 'unpaid' (guard unpaid I1). Bila order lahir 'paid', transisi
 * terminal tidak bisa jalan -> trigger P0-B tidak melepas stok -> order
 * tertinggal 'paid' + stok terkunci.
 */
function simulateFreeOrderTimeline(opts: { gateOk: boolean; bornPaid: boolean }): FreeTimelineRow[] {
  const rows: FreeTimelineRow[] = [];
  let row: FreeTimelineRow = opts.bornPaid
    ? { event: 'insert', payment_status: 'paid', order_status: 'paid', stock_released_at: null }
    : { event: 'insert', payment_status: 'unpaid', order_status: 'pending', stock_released_at: null };
  rows.push({ ...row });
  if (!opts.gateOk) {
    if (row.payment_status === 'unpaid') {
      row = {
        event: 'compensate',
        payment_status: 'failed',
        order_status: 'cancelled',
        stock_released_at: 'now',
      };
      rows.push({ ...row });
    }
    return rows;
  }
  rows.push({ ...row, event: 'gate' });
  rows.push({ ...row, event: 'earn' });
  row = {
    event: 'paid_mark',
    payment_status: 'paid',
    order_status: 'paid',
    stock_released_at: null,
  };
  rows.push(row);
  return rows;
}

test('Tahap 1.3: kegagalan gate free TIDAK menyisakan order paid', () => {
  const bornPaid = /payment_status: 'paid'/.test(freePayload);
  const rows = simulateFreeOrderTimeline({ gateOk: false, bornPaid });
  // Tidak boleh ada state 'paid' sama sekali pada jalur gate gagal.
  assert.equal(rows.filter((r) => r.payment_status === 'paid').length, 0);
  // Order berakhir terminal dan stok dilepas (trigger P0-B tepat-1x).
  const last = rows[rows.length - 1];
  assert.equal(last.order_status, 'cancelled');
  assert.equal(last.stock_released_at, 'now');
});

test('Tahap 1.3: free order jadi paid tepat sekali dan SETELAH gate lolos', () => {
  const bornPaid = /payment_status: 'paid'/.test(freePayload);
  const rows = simulateFreeOrderTimeline({ gateOk: true, bornPaid });
  const paidRows = rows.filter((r) => r.payment_status === 'paid');
  assert.equal(paidRows.length, 1, 'paid hanya boleh ditulis sekali');
  const gateIdx = rows.findIndex((r) => r.event === 'gate');
  const paidIdx = rows.findIndex((r) => r.event === 'paid_mark');
  assert.ok(gateIdx !== -1 && paidIdx !== -1);
  assert.ok(paidIdx > gateIdx, 'paid ditulis setelah gate');
});

test('Tahap 1.3: paid-mark free legacy gagal -> mismatch handler, bukan sukses palsu', () => {
  assert.ok(legacyMismatchStart !== -1 && legacyMismatchEnd > legacyMismatchStart);
  // Penandaan paid memanggil handler mismatch khusus legacy.
  assert.match(route, /handleLegacyFreePaidMarkFailure\(orderCode\)/);
  // Tidak boleh menghapus baris (retensi I1), tidak boleh melepas stok mentah
  // (trigger P0-B satu-satunya jalur pelepasan), tidak boleh menurunkan paid
  // menjadi failed.
  assert.doesNotMatch(legacyMismatchBody, /\.delete\(\)/);
  assert.doesNotMatch(legacyMismatchBody, /release_stock/);
  assert.doesNotMatch(legacyMismatchBody, /payment_status: 'failed'/);
  // Baris 'paid' dibaca ulang lalu dibiarkan apa adanya (anti-downgrade).
  assert.match(legacyMismatchBody, /payment === 'paid'/);
  // Kompensasi post_gate: snapshot koin dipertahankan (trigger me-refund
  // tepat-1x) + promo dilepas sekali.
  assert.match(legacyMismatchBody, /phase: 'post_gate'/);
  assert.match(legacyMismatchBody, /promoClaimed: checkoutPromoCode != null && promoPercentOff != null/);
  assert.match(legacyMismatchBody, /refundCoins: pricing\.coinUsed > 0/);
});

test('Tahap 1.3: handler mismatch free legacy tidak membaca kolom 2D-E', () => {
  // Jalur legacy justru dipakai saat kolom 2D-E (invoice_state /
  // idempotency_key) belum ada di database — membacanya akan menggagalkan
  // baca-ulang. Yang diperiksa adalah kode (komentar tidak dihitung).
  assert.doesNotMatch(legacyMismatchCode, /invoice_state/);
  assert.doesNotMatch(legacyMismatchCode, /idempotency_key/);
});

// ---------------------------------------------------------------------------
// P1-C: settlement Coin — order paid TIDAK boleh gagal hanya karena debit
// Coin gagal, dan kegagalan debit harus terekam durable (tanpa mengubah
// orders.coin_used).
// ---------------------------------------------------------------------------

test('P1-C: settlement: kegagalan debit tidak menurunkan status paid', () => {
  // Penandaan paid terjadi SEBELUM logika Coin dan tidak bergantung pada
  // hasil debit: tidak ada jalur "gagal debit -> turunkan paid".
  const settleBody = settlement;
  const paidMarkIdx = settleBody.indexOf("payment_status: 'paid'");
  const coinBlockIdx = settleBody.indexOf("await service.rpc('spend_order_coins'");
  assert.ok(paidMarkIdx !== -1 && coinBlockIdx !== -1);
  assert.ok(paidMarkIdx < coinBlockIdx, 'paid harus ditulis sebelum logika Coin');
  // Tidak ada penulisan status pembayaran lain di jalur settlement.
  assert.doesNotMatch(settleBody, /payment_status: 'failed'/);
  assert.doesNotMatch(settleBody, /payment_status: 'unpaid'/);
  assert.doesNotMatch(settleBody, /payment_status: 'refunded'/);
});

test('P1-C: settlement: orders.coin_used tidak pernah diubah', () => {
  // coin_used adalah bukti diskon + bagian aritmetika order. Mengubahnya
  // untuk menghilangkan risiko mint akan menyembunyikan utang.
  const settleBody = settlement;
  assert.doesNotMatch(settleBody, /coin_used:\s*0/);
  assert.doesNotMatch(settleBody, /coin_used:\s*null/);
  assert.doesNotMatch(settleBody, /SET\s+coin_used/i);
  // Yang boleh ditulis hanya kolom status utang.
  assert.match(settleBody, /coin_debit_status: debt\.status/);
  assert.match(settleBody, /coin_debit_reason: debt\.reason/);
  assert.match(settleBody, /coin_debit_updated_at: new Date\(\)\.toISOString\(\)/);
});

test('P1-C: settlement: verifikasi ledger dilakukan SEBELUM mencatat utang', () => {
  const ledgerIdx = settlement.indexOf('readSpentLedger(service, buyerId, externalId)');
  const orderIdx = settlement.indexOf('readOrderTerminalState(service, externalId)');
  const verdictIdx = settlement.indexOf('classifyCoinDebitOutcome({');
  const writeIdx = settlement.indexOf('writeCoinDebitDebt(service, externalId, buyerId, {');
  assert.ok(ledgerIdx !== -1 && orderIdx !== -1 && verdictIdx !== -1 && writeIdx !== -1);
  assert.ok(ledgerIdx < verdictIdx, 'ledger dicek sebelum klasifikasi');
  assert.ok(orderIdx < verdictIdx, 'status order dicek sebelum klasifikasi');
  assert.ok(verdictIdx < writeIdx, 'klasifikasi sebelum pencatatan utang');
  // Klasifikasi memakai helper murni (bisa diuji tanpa database).
  assert.match(settlement, /import \{\s*classifyCoinDebitOutcome,\s*interpretDebtWriteResult,\s*isTerminalOrderState,/);
  assert.match(settlement, /spentExistsInLedger: ledger\.spentExists/);
  assert.match(settlement, /ledgerCheckFailed: ledger\.failed/);
  assert.match(settlement, /orderIsTerminal: orderState\.isTerminal/);
});

test('P1-C: settlement: kegagalan pencatatan utang dicatat sebagai kritis', () => {
  // Utang tanpa status durable tidak dapat dicari/ditagih -> harus terlihat.
  assert.match(
    settlement,
    /CRITICAL: gagal mencatat utang debit Coin \(rekonsiliasi manual diperlukan\)/
  );
  // Penulisan utang tidak boleh membuat settlement gagal.
  assert.doesNotMatch(settlement, /throw new Error\(/);
});

test('P1-C: settlement: tidak ada retry otomatis pada webhook/verify', () => {
  // Jalur already_paid TIDAK boleh menjalankan ulang settlement/coin.
  assert.match(settlement, /if \(row\.payment_status === 'paid'\) \{\s*return \{ settled: false, reason: 'already_paid' \};/);
  const settleCoinIdx = settlement.indexOf("await service.rpc('spend_order_coins'");
  const alreadyIdx = settlement.indexOf("reason: 'already_paid'");
  assert.ok(settleCoinIdx > alreadyIdx, 'early return already_paid mendahului logika Coin');
  // Verify keluar lebih dulu untuk order non-unpaid.
  assert.match(verify, /if \(currentStatus !== 'unpaid' \|\| !invoiceId\)/);
});

test('P1-C: helper coin-debit: klasifikasi murni tanpa I/O', () => {
  // Helper harus murni: tanpa fetch/supabase/service client.
  assert.doesNotMatch(coinDebit, /createClient|SupabaseClient|\.from\(|await |fetch\(/);
  assert.match(coinDebit, /export function classifyCoinDebitOutcome/);
  assert.match(coinDebit, /export function isTerminalOrderState/);
  // Prioritas: 'spent' di ledger mengalahkan respons RPC error.
  const spentIdx = coinDebit.indexOf('if (opts.spentExistsInLedger)');
  const errIdx = coinDebit.indexOf('if (opts.ledgerCheckFailed === true || hasRpcError)');
  assert.ok(spentIdx !== -1 && errIdx !== -1);
  assert.ok(spentIdx < errIdx, 'ledger lebih didahulukan daripada error RPC');
});

test('P1-C: migrasi — refund berbasis ledger, bukan snapshot coin_used', () => {
  // Trigger tidak boleh lagi memakai NEW.coin_used sebagai nominal refund.
  const triggerBody = p1cMigration.slice(
    p1cMigration.indexOf('CREATE OR REPLACE FUNCTION public.refund_order_coins_on_terminal()'),
    p1cMigration.indexOf('CREATE OR REPLACE FUNCTION public.spend_order_coins(')
  );
  assert.ok(triggerBody.length > 0);
  // Yang diperiksa adalah KODE (komentar tidak dihitung) — nominal refund
  // tidak boleh berasal dari NEW.coin_used.
  const triggerCode = triggerBody
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
  assert.doesNotMatch(triggerCode, /NEW\.coin_used/);
  assert.match(triggerBody, /type = 'spent'/);
  assert.match(triggerBody, /pg_advisory_xact_lock\(hashtext\('rebites-coin:' \|\| NEW\.buyer_id::text\)\)/);
  assert.match(triggerBody, /ON CONFLICT DO NOTHING/);
  // Clawback reward tetap ada.
  assert.match(triggerBody, /type = 'earned'/);
  // Idempoten terhadap transisi terminal berulang tetap ada.
  assert.match(triggerBody, /IF NOT v_is_bad OR v_was_bad THEN/);
});

test('P1-C: migrasi — debit order terminal ditolak tanpa race', () => {
  const spendBody = p1cMigration.slice(
    p1cMigration.indexOf('CREATE OR REPLACE FUNCTION public.spend_order_coins('),
    p1cMigration.indexOf('CREATE OR REPLACE FUNCTION public.guard_orders_insert_coin_debit_defaults()')
  );
  assert.ok(spendBody.length > 0);
  // Row lock order diambil SEBELUM advisory lock (urutan lock sama dengan
  // trigger => deadlock-free). Pemeriksaan status DI BAWAH row lock.
  const rowLockIdx = spendBody.indexOf('FOR NO KEY UPDATE');
  const advisoryIdx = spendBody.indexOf("pg_advisory_xact_lock(hashtext('rebites-coin:'");
  const terminalIdx = spendBody.indexOf('v_order_is_terminal :=');
  assert.ok(rowLockIdx !== -1 && advisoryIdx !== -1 && terminalIdx !== -1);
  assert.ok(rowLockIdx < advisoryIdx, 'row lock order harus sebelum advisory lock');
  assert.ok(advisoryIdx < terminalIdx, 'pemeriksaan terminal di bawah kedua lock');
  // Idempotensi 'spent' yang sudah ada dijaga.
  assert.match(spendBody, /IF FOUND THEN\s*RETURN true;/);
  // Tidak ada penguncian baris coin_transactions yang berlawanan urutan.
  assert.doesNotMatch(spendBody, /FOR UPDATE|FOR SHARE/);
});

test('P1-C: migrasi — status utang durable terbatas pada NULL/pending/insufficient', () => {
  assert.match(p1cMigration, /ADD COLUMN IF NOT EXISTS coin_debit_status text/);
  assert.match(p1cMigration, /ADD COLUMN IF NOT EXISTS coin_debit_reason text/);
  assert.match(p1cMigration, /ADD COLUMN IF NOT EXISTS coin_debit_updated_at timestamptz/);
  assert.match(
    p1cMigration,
    /coin_debit_status IN \('pending', 'insufficient'\)/
  );
  assert.match(
    p1cMigration,
    /coin_debit_reason IN \('rpc_error', 'insufficient_balance'\)/
  );
  // Tidak boleh ada status 'resolved' / attempt counter / scheduler.
  assert.doesNotMatch(p1cMigration, /'resolved'/);
  assert.doesNotMatch(p1cMigration, /attempt_count|next_retry_at/);
  assert.doesNotMatch(p1cMigration, /pg_cron|cron\.schedule|pg_net/);
  // orders.coin_used tidak boleh disentuh oleh migrasi ini.
  assert.doesNotMatch(p1cMigration, /UPDATE\s+public\.orders\s+SET\s+coin_used/);
  assert.doesNotMatch(p1cMigration, /ALTER COLUMN coin_used/);
});

// ---------------------------------------------------------------------------
// K-1 (audit 2.3A): regresi guard insert lama — proteksi tidak boleh hilang.
//
// Temuan: migrasi P1-C MENYALIN ULANG guard_orders_insert_client_defaults()
// dan salinannya tidak lagi memuat NEW.estimated_completion_at := NULL.
// Perbaikan: P1-C tidak lagi mendefinisikan fungsi itu; kolom baru dilindungi
// trigger BEFORE INSERT terpisah. Tes di bawah membandingkan guard lama
// SECARA MENYELURUH (seluruh assignment NEW.* dari versi sebelumnya), bukan
// beberapa kolom terpilih.
// ---------------------------------------------------------------------------

test('K-1: P1-C tidak menimpa/menghapus guard insert lama', () => {
  assert.equal(
    extractSqlFunction(p1cMigration, 'guard_orders_insert_client_defaults'),
    null,
    'P1-C tidak boleh CREATE OR REPLACE guard_orders_insert_client_defaults'
  );
  assert.doesNotMatch(
    p1cMigration,
    /DROP\s+FUNCTION[^;]*guard_orders_insert_client_defaults/i,
    'P1-C tidak boleh menghapus fungsi guard lama'
  );
  // Trigger lama (P0-A) tetap ada dan tidak di-drop di sini.
  assert.doesNotMatch(p1cMigration, /DROP TRIGGER[^;]*trg_orders_guard_insert ON/i);
});

test('K-1: guard efektif setelah P1-C mempertahankan SELURUH proteksi versi sebelumnya', () => {
  const defs = guardDefinitionsBeforeP1C();
  assert.ok(defs.length >= 2, 'harus ada definisi guard sebelum P1-C');
  const previous = defs[defs.length - 2];
  const effective = defs[defs.length - 1];
  assert.equal(
    effective.file,
    '20261007000004_p1a_coin_order_financial_security.sql',
    'definisi guard terakhir sebelum P1-C harus berasal dari P1-A'
  );

  const previousAssignments = extractNewAssignments(previous.body);
  const effectiveAssignments = new Set(extractNewAssignments(effective.body));
  assert.ok(previousAssignments.length > 0);
  // Setiap assignment versi sebelumnya (seluruhnya) harus masih ada.
  for (const assignment of previousAssignments) {
    assert.ok(
      effectiveAssignments.has(assignment),
      `proteksi hilang dari guard efektif: NEW.${assignment}`
    );
  }
});

test('K-1: guard efektif masih memaksa estimated_completion_at = NULL', () => {
  const defs = guardDefinitionsBeforeP1C();
  const effective = defs[defs.length - 1];
  assert.match(effective.body, /NEW\.estimated_completion_at := NULL;/);
  // Struktur privilege tidak berubah: service_role lolos, admin lolos.
  assert.match(effective.body, /\(auth\.jwt\(\) ->> 'role'\) = 'service_role'/);
  assert.match(effective.body, /IF NOT public\.is_admin\(\) THEN/);
});

test('K-1: trigger baru hanya memaksa kolom coin_debit_* (tidak menduplikasi guard lama)', () => {
  const newGuard = extractSqlFunction(p1cMigration, 'guard_orders_insert_coin_debit_defaults');
  assert.ok(newGuard, 'fungsi guard kolom utang harus ada di P1-C');
  assert.match(newGuard, /RETURNS trigger/);
  assert.match(newGuard, /SECURITY DEFINER/);
  assert.match(newGuard, /\(auth\.jwt\(\) ->> 'role'\) = 'service_role'/);
  assert.match(newGuard, /IF NOT public\.is_admin\(\) THEN/);
  // HANYA tiga kolom baru; guard lama tidak disalin ulang.
  assert.deepEqual(extractNewAssignments(newGuard), [
    'coin_debit_reason=NULL',
    'coin_debit_status=NULL',
    'coin_debit_updated_at=NULL',
  ]);
});

test('K-1: trigger baru kompatibel dengan trigger BEFORE INSERT yang sudah ada', () => {
  // Trigger lama: trg_orders_guard_insert (BEFORE INSERT FOR EACH ROW, P0-A).
  assert.match(p1cMigration, /DROP TRIGGER IF EXISTS trg_orders_guard_insert_coin_debit ON public\.orders;/);
  assert.match(
    p1cMigration,
    /CREATE TRIGGER trg_orders_guard_insert_coin_debit\s+BEFORE INSERT ON public\.orders\s+FOR EACH ROW EXECUTE FUNCTION public\.guard_orders_insert_coin_debit_defaults\(\)/
  );
  // PostgreSQL menjalankan trigger BEFORE ROW sesuai urutan NAMA: trigger
  // baru berjalan SETELAH trigger lama. Keduanya menyentuh kolom lepas,
  // sehingga urutan tidak mengubah hasil.
  assert.ok('trg_orders_guard_insert' < 'trg_orders_guard_insert_coin_debit');
  const p0a = readFileSync(
    new URL('../supabase/migrations/20261007000000_p0a_security_hardening.sql', import.meta.url),
    'utf8'
  );
  assert.match(
    p0a,
    /CREATE TRIGGER trg_orders_guard_insert\s+BEFORE INSERT ON public\.orders\s+FOR EACH ROW EXECUTE FUNCTION public\.guard_orders_insert_client_defaults\(\)/
  );
  // Tidak ada trigger BEFORE INSERT lain pada orders yang bisa bertabrakan.
  const allMigrations = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(new URL(f, migrationsDir), 'utf8'))
    .join('\n');
  const beforeInsertTriggers = [...allMigrations.matchAll(/CREATE TRIGGER (\w+)\s+BEFORE INSERT ON public\.orders/g)]
    .map((m) => m[1]);
  assert.deepEqual(beforeInsertTriggers.sort(), [
    'trg_orders_guard_insert',
    'trg_orders_guard_insert_coin_debit',
  ]);
});

// ---------------------------------------------------------------------------
// S-1 (audit 2.3A): spend_order_coins wajib mencocokkan pemilik order.
// ---------------------------------------------------------------------------

test('S-1: debit baru menolak p_user_id yang bukan buyer_id order', () => {
  const spendBody = p1cMigration.slice(
    p1cMigration.indexOf('CREATE OR REPLACE FUNCTION public.spend_order_coins('),
    p1cMigration.indexOf('CREATE OR REPLACE FUNCTION public.guard_orders_insert_coin_debit_defaults()')
  );
  assert.ok(spendBody.length > 0);
  // buyer_id dibaca dari baris yang sudah dikunci (L1).
  assert.match(spendBody, /SELECT o\.payment_status, o\.order_status, o\.buyer_id/);
  assert.match(spendBody, /INTO v_order_payment_status, v_order_status, v_order_buyer_id/);
  // Penolakan eksplisit saat identitas tidak ada atau tidak cocok.
  assert.match(
    spendBody,
    /IF v_order_found AND \(v_order_buyer_id IS NULL OR v_order_buyer_id <> p_user_id\) THEN\s*RETURN false;\s*END IF;/
  );

  const rowLockIdx = spendBody.indexOf('FOR NO KEY UPDATE');
  const ownerIdx = spendBody.indexOf('v_order_buyer_id <> p_user_id');
  const advisoryIdx = spendBody.indexOf("pg_advisory_xact_lock(hashtext('rebites-coin:'");
  const spentCheckIdx = spendBody.indexOf("type = 'spent';");
  const insertIdx = spendBody.indexOf("'spent', p_amount");
  assert.ok(rowLockIdx !== -1 && ownerIdx !== -1 && advisoryIdx !== -1);
  assert.ok(rowLockIdx < ownerIdx, 'pemilik dicek di bawah row lock order');
  assert.ok(ownerIdx < advisoryIdx, 'pemilik dicek sebelum advisory lock diambil');
  assert.ok(ownerIdx < spentCheckIdx, 'pemilik dicek sebelum jalur idempotensi');
  assert.ok(ownerIdx < insertIdx, 'pemilik dicek sebelum INSERT spent');
  // Kontrak lama tetap: idempotensi, terminal, advisory lock, unique violation.
  assert.match(spendBody, /IF FOUND THEN\s*RETURN true;/);
  assert.match(spendBody, /v_order_is_terminal :=/);
  assert.match(spendBody, /EXCEPTION WHEN unique_violation THEN/);
});

// ---------------------------------------------------------------------------
// S-2 (audit 2.3A): pencatatan utang harus benar-benar mengubah satu baris.
// ---------------------------------------------------------------------------

test('S-2: interpretDebtWriteResult: tepat satu baris = sukses', () => {
  const r = interpretDebtWriteResult({ rowCount: 1, error: null });
  assert.equal(r.ok, true);
  assert.equal(r.detail, null);
});

test('S-2: interpretDebtWriteResult: nol baris = kegagalan pencatatan', () => {
  const r = interpretDebtWriteResult({ rowCount: 0, error: null });
  assert.equal(r.ok, false);
  assert.match(String(r.detail), /0/);
});

test('S-2: interpretDebtWriteResult: lebih dari satu baris = kegagalan', () => {
  const r = interpretDebtWriteResult({ rowCount: 2, error: null });
  assert.equal(r.ok, false);
  assert.match(String(r.detail), /2/);
});

test('S-2: interpretDebtWriteResult: hasil tak terbaca = kegagalan (bukan sukses diam-diam)', () => {
  const r = interpretDebtWriteResult({ rowCount: null, error: null });
  assert.equal(r.ok, false);
});

test('S-2: interpretDebtWriteResult: error query = kegagalan dengan pesan', () => {
  const r = interpretDebtWriteResult({ rowCount: 0, error: { message: 'column does not exist' } });
  assert.equal(r.ok, false);
  assert.equal(r.detail, 'column does not exist');
  // Error menang meskipun ada baris (tidak boleh dianggap sukses).
  const r2 = interpretDebtWriteResult({ rowCount: 1, error: { message: 'boom' } });
  assert.equal(r2.ok, false);
  assert.equal(r2.detail, 'boom');
});

test('S-2: writeCoinDebitDebt memakai .select(order_code) dan helper baris', () => {
  const fnStart = settlement.indexOf('async function writeCoinDebitDebt(');
  const fnEnd = settlement.indexOf('export async function settleOrderPaid(');
  assert.ok(fnStart !== -1 && fnEnd !== -1 && fnStart < fnEnd);
  const fnBody = settlement.slice(fnStart, fnEnd);
  assert.match(fnBody, /\.eq\('buyer_id', userId\)\s*\.select\('order_code'\)/);
  assert.match(fnBody, /interpretDebtWriteResult\(\{/);
  assert.match(fnBody, /rowCount: Array\.isArray\(data\) \? data\.length : null/);
  // Tanpa retry otomatis dan tanpa membuat settlement gagal.
  assert.doesNotMatch(fnBody, /retry|for \(|while \(/i);
  assert.doesNotMatch(fnBody, /throw new Error\(/);
});

test('P1-C: tidak ada perubahan perilaku checkout (kompensasi & stok)', () => {
  // Jumlah pemanggilan pelepasan stok mentah & flag strict tidak berubah.
  assert.equal(route.match(/'release_stock'/g)?.length, 2);
  assert.equal(route.match(/requireSuccessData: true/g)?.length, 2);
  // Jalur free (Tahap 1.3) tetap menandai paid setelah gate, dan penandaan
  // paid tetap bersyarat 'unpaid'.
  const paidMarkIdx = route.indexOf(".update({ payment_status: 'paid', order_status: 'paid' }");
  assert.ok(paidMarkIdx !== -1);
  const paidMarkBlock = route.slice(paidMarkIdx, paidMarkIdx + 700);
  assert.match(paidMarkBlock, /\.eq\('payment_status', 'unpaid'\)/);
  assert.ok(
    route.indexOf('await claimPromoAndSpendCoins(', route.indexOf('if (pricing.total === 0) {')) <
      paidMarkIdx,
    'gate sebelum penandaan paid di jalur free'
  );
  // Webhook & verify tidak berubah contractually.
  assert.match(webhook, /currentPayment === 'paid'/);
  assert.match(verify, /currentStatus !== 'unpaid'/);
});
