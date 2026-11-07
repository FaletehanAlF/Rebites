import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { classifyCompensationRpcResult, classifyOrderWriteError, classifyReserveOutcome, isInvoiceStateColumnMissingError, planAbandonDeletion, } from '../lib/server/checkout-idempotency.ts';
import { interpretDebtWriteResult } from '../lib/server/coin-debit.ts';
const route = readFileSync(new URL('../app/api/checkout/xendit/route.ts', import.meta.url), 'utf8');
const verify = readFileSync(new URL('../app/api/checkout/xendit/verify/route.ts', import.meta.url), 'utf8');
const webhook = readFileSync(new URL('../app/api/webhooks/xendit/route.ts', import.meta.url), 'utf8');
const settlement = readFileSync(new URL('../lib/server/order-settlement.ts', import.meta.url), 'utf8');
const coinDebit = readFileSync(new URL('../lib/server/coin-debit.ts', import.meta.url), 'utf8');
const p1cMigration = readFileSync(new URL('../supabase/migrations/20261020000000_p1c_coin_refund_ledger_basis.sql', import.meta.url), 'utf8');
const P1C_MIGRATION_FILE = '20261020000000_p1c_coin_refund_ledger_basis.sql';
const migrationsDir = new URL('../supabase/migrations/', import.meta.url);
function extractSqlFunction(source: string, name: string): string | null {
    const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}()`);
    if (start === -1)
        return null;
    const end = source.indexOf('$$;', start);
    if (end === -1)
        return null;
    return source.slice(start, end + 3);
}
function extractNewAssignments(fnBody: string): string[] {
    const found: string[] = [];
    const re = /NEW\.([a-z_]+)\s*:=\s*(NULL|'[^']*'|[0-9]+)\s*;/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(fnBody)) !== null) {
        found.push(`${m[1]}=${m[2]}`);
    }
    return found.sort();
}
function guardDefinitionsBeforeP1C(): Array<{
    file: string;
    body: string;
}> {
    return readdirSync(migrationsDir)
        .filter((f) => f.endsWith('.sql') && f < P1C_MIGRATION_FILE)
        .sort()
        .map((file) => ({
        file,
        body: extractSqlFunction(readFileSync(new URL(file, migrationsDir), 'utf8'), 'guard_orders_insert_client_defaults'),
    }))
        .filter((d): d is {
        file: string;
        body: string;
    } => d.body !== null);
}
test('classifyOrderWriteError: penolakan PostgREST berkode = definitif', () => {
    for (const code of ['23505', '42703', '23514', '42P01', 'PGRST204', 'PGRST116']) {
        assert.equal(classifyOrderWriteError({ code, message: 'pesan apa pun' }), 'definitive', `kode ${code} harus definitif`);
    }
});
test('classifyOrderWriteError: jaringan/timeout/abort/ambil-arah = unknown', () => {
    const ambiguous = [
        new Error('TypeError: fetch failed'),
        new Error('fetch failed'),
        new Error('The operation was aborted'),
        new Error('network timeout'),
        { code: '', message: 'fetch failed' },
        { code: '   ', message: 'timeout' },
        {},
        'fetch failed',
        null,
        undefined,
        42,
    ];
    for (const err of ambiguous) {
        assert.equal(classifyOrderWriteError(err), 'unknown', `harus unknown: ${JSON.stringify(String(err))}`);
    }
});
test('classifyOrderWriteError: error berkode tetap definitif (penolakan server)', () => {
    assert.equal(classifyOrderWriteError({ code: '42703', message: 'column orders.shipping_snapshot does not exist' }), 'definitive');
});
test('classifyReserveOutcome: marker terkonfirmasi = reserved apa pun hasil respons', () => {
    assert.equal(classifyReserveOutcome({ reserved: undefined, error: new Error('fetch failed'), markerSet: true }), 'reserved');
    assert.equal(classifyReserveOutcome({ reserved: false, error: null, markerSet: true }), 'reserved');
});
test('classifyReserveOutcome: error RPC tanpa marker = kegagalan teknis (bukan stok habis)', () => {
    assert.equal(classifyReserveOutcome({ reserved: undefined, error: new Error('function reserve_stock_for_order does not exist'), markerSet: false }), 'technical_error');
    assert.equal(classifyReserveOutcome({ reserved: undefined, error: { message: 'permission denied' }, markerSet: false }), 'technical_error');
});
test('classifyReserveOutcome: reserved === false tanpa error = stok tidak cukup', () => {
    assert.equal(classifyReserveOutcome({ reserved: false, error: null, markerSet: false }), 'insufficient_stock');
});
test('classifyReserveOutcome: hasil null/aneh tanpa error = fail-safe technical_error', () => {
    assert.equal(classifyReserveOutcome({ reserved: undefined, error: null, markerSet: false }), 'technical_error');
    assert.equal(classifyReserveOutcome({ reserved: null, error: null, markerSet: false }), 'technical_error');
    assert.equal(classifyReserveOutcome({ reserved: 'yes', error: null, markerSet: false }), 'technical_error');
    assert.equal(classifyReserveOutcome({ reserved: true, error: null, markerSet: false }), 'reserved');
});
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
    assert.equal(planAbandonDeletion({
        transitionConfirmed: true,
        stockReservedAt: null,
        stockReleasedAt: null,
        compensationSettled: true,
    }).stockReleased, true);
    assert.equal(planAbandonDeletion({
        transitionConfirmed: true,
        stockReservedAt: '2026-10-17T00:00:00.000Z',
        stockReleasedAt: '2026-10-17T00:01:00.000Z',
        compensationSettled: true,
    }).stockReleased, true);
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
                    }
                    else {
                        assert.equal(plan.mayDelete, false);
                        assert.notEqual(plan.hold, null);
                    }
                }
            }
        }
    }
});
test('isInvoiceStateColumnMissingError: 42703/PGRST204 yang menyebut kolom = true', () => {
    assert.equal(isInvoiceStateColumnMissingError({
        code: '42703',
        message: 'column orders.invoice_state does not exist',
    }), true);
    assert.equal(isInvoiceStateColumnMissingError({
        code: 'PGRST204',
        message: "Could not find the 'invoice_state' column of 'orders' in the schema cache",
    }), true);
    assert.equal(isInvoiceStateColumnMissingError({ code: '42703', message: '' }), true);
});
test('isInvoiceStateColumnMissingError: error jaringan / database non-skema = false', () => {
    assert.equal(isInvoiceStateColumnMissingError(new Error('fetch failed')), false);
    assert.equal(isInvoiceStateColumnMissingError(new Error('The operation was aborted')), false);
    assert.equal(isInvoiceStateColumnMissingError({
        code: '23514',
        message: 'new row for relation "orders" violates check constraint "orders_invoice_state_check"',
    }), false);
    assert.equal(isInvoiceStateColumnMissingError({
        code: 'PGRST204',
        message: "Could not find the 'shipping_snapshot' column of 'orders' in the schema cache",
    }), false);
    assert.equal(isInvoiceStateColumnMissingError(null), false);
    assert.equal(isInvoiceStateColumnMissingError('invoice_state'), false);
    assert.equal(isInvoiceStateColumnMissingError({}), false);
});
test('isInvoiceStateColumnMissingError: tanpa kode, hanya pesan yang jelas menyebut kolom/skema', () => {
    assert.equal(isInvoiceStateColumnMissingError(new Error('column orders.invoice_state does not exist')), true);
    assert.equal(isInvoiceStateColumnMissingError(new Error("invoice_state column missing from schema")), true);
    assert.equal(isInvoiceStateColumnMissingError(new Error('invoice_state gagal diproses')), false);
});
test('verify & webhook: fallback invoice_state digerbangi helper skema (bukan regex pesan mentah)', () => {
    for (const [name, src] of [['verify', verify], ['webhook', webhook]] as const) {
        assert.match(src, /isInvoiceStateColumnMissingError\(/, `${name}: fallback harus lewat helper klasifikasi skema`);
        assert.doesNotMatch(src, /code === '42703'/, `${name}: tidak boleh cek kode mentah`);
        assert.doesNotMatch(src, /invoice_state\/i\.test\(/, `${name}: tidak boleh regex pesan mentah`);
    }
    assert.match(verify, /update\(\{ payment_status: 'failed', order_status: 'cancelled' \}/);
    assert.match(verify, /\.eq\('payment_status', 'unpaid'\)/);
    assert.match(webhook, /xendit_invoice_id: invoiceId,/);
    assert.match(webhook, /currentPayment === 'paid'/);
});
const abandonStart = route.indexOf('const abandonCheckoutOrder = async (');
const rollbackStart = route.indexOf('const rollbackCheckoutOrder = async (');
const legacyFailureStart = route.indexOf('const handleLegacyInsertFailure = async (');
const claimGateStart = route.indexOf('const claimPromoAndSpendCoins = async (');
test('sumber route: hasil abandon dipropagasikan oleh rollbackCheckoutOrder (tidak dibuang)', () => {
    assert.ok(abandonStart !== -1 && rollbackStart !== -1 && legacyFailureStart !== -1);
    const rollbackBody = route.slice(rollbackStart, legacyFailureStart);
    assert.match(rollbackBody, /const abandonResult = await abandonCheckoutOrder\(/);
    assert.match(rollbackBody, /return abandonResult;/);
    assert.match(rollbackBody, /rollback belum terkonfirmasi penuh/);
});
test('sumber route: abandon TIDAK lagi menghapus pesanan (retensi I1)', () => {
    const abandonBody = route.slice(abandonStart, rollbackStart);
    assert.doesNotMatch(abandonBody, /\.delete\(\)/);
    assert.doesNotMatch(abandonBody, /deleteRows/);
    assert.doesNotMatch(abandonBody, /\bdeleted\b/);
});
test('sumber route: abandon mempertahankan order terminal secara sadar (log retensi, bukan kegagalan hapus)', () => {
    const abandonBody = route.slice(abandonStart, rollbackStart);
    assert.match(abandonBody, /rollback: pesanan terminal DIPERTAHANKAN untuk rekonsiliasi/);
});
test('sumber route: transisi terminal abandon digerbangi payment_status unpaid (anti-downgrade paid)', () => {
    const abandonBody = route.slice(abandonStart, rollbackStart);
    assert.match(abandonBody, /\.eq\('payment_status', 'unpaid'\)/);
    assert.match(abandonBody, /payment_status === 'paid'/);
});
test('sumber route: tidak ada pelepasan stok mentah di jalur rollback/abandon', () => {
    assert.equal(route.match(/'release_stock'/g)?.length, 2, 'release_stock hanya 2 pemanggilan');
    const abandonBody = route.slice(abandonStart, rollbackStart);
    assert.doesNotMatch(abandonBody, /release_stock/);
    const rollbackBody = route.slice(rollbackStart, legacyFailureStart);
    assert.doesNotMatch(rollbackBody, /release_stock/);
    const legacyFailureBody = route.slice(legacyFailureStart, claimGateStart);
    assert.ok(legacyFailureBody.includes("'release_stock'"));
});
test('sumber route: abandon memakai keputusan murni planAbandonDeletion', () => {
    const abandonBody = route.slice(abandonStart, rollbackStart);
    assert.match(abandonBody, /planAbandonDeletion\(\{/);
    assert.match(abandonBody, /compensationSettled: opts\.compensationSettled/);
});
test('sumber route: kegagalan invoice legacy memakai classifyInvoiceError (I1)', () => {
    const invoiceTryStart = route.indexOf('let invoice;');
    const invoiceBodyEnd = route.indexOf('const { error: notifErr }', invoiceTryStart);
    assert.ok(invoiceTryStart !== -1 && invoiceBodyEnd > invoiceTryStart);
    const invoiceBody = route.slice(invoiceTryStart, invoiceBodyEnd);
    assert.equal(invoiceBody.match(/const cls = classifyInvoiceError\(e\)/g)?.length, 2);
    assert.match(invoiceBody, /if \(cls === 'unknown'\)/);
    assert.ok(route.lastIndexOf('if (cls === \'unknown\')') > route.indexOf('if (keyedFlow)'));
});
test('sumber route: invoice legacy unknown -> order DIPERTAHANKAN unpaid (tanpa rollback)', () => {
    const catchStart = route.lastIndexOf('if (cls === \'unknown\')');
    assert.ok(catchStart !== -1);
    const catchEnd = route.lastIndexOf('await rollbackCheckoutOrder(orderCode, {');
    assert.ok(catchEnd !== -1 && catchEnd > catchStart);
    const unknownBlock = route.slice(catchStart, catchEnd);
    assert.doesNotMatch(unknownBlock, /rollbackCheckoutOrder/);
    assert.doesNotMatch(unknownBlock, /failKeyedOrder/);
    assert.doesNotMatch(unknownBlock, /refund_order_coins/);
    assert.doesNotMatch(unknownBlock, /release_promo/);
    assert.doesNotMatch(unknownBlock, /failKeyedOrder\(|transitionInvoiceState/);
    assert.match(unknownBlock, /retryable: true/);
    assert.match(unknownBlock, /status: 409/);
    assert.match(unknownBlock, /jangan submit ulang/);
});
test('sumber route: invoice legacy definitive -> rollback klasik (kompensasi penuh)', () => {
    const defStart = route.lastIndexOf('await rollbackCheckoutOrder(orderCode, {');
    assert.ok(defStart !== -1);
    const definitiveBlock = route.slice(defStart, route.indexOf('const { error: notifErr }', defStart));
    assert.match(definitiveBlock, /await rollbackCheckoutOrder\(orderCode, \{/);
    assert.match(definitiveBlock, /promoClaimed: body\.promoCode != null && promoPercentOff != null/);
    assert.match(definitiveBlock, /refundCoins: pricing\.coinUsed > 0/);
    assert.match(definitiveBlock, /phase: 'post_gate'/);
});
test('sumber route: jalur retry kolom skema digerbangi klasifikasi definitif', () => {
    assert.equal(route.match(/classifyOrderWriteError\(insertErr\) === 'definitive'/g)?.length, 3);
    assert.equal(route.match(/insertDefinitive && \(/g)?.length, 2);
    assert.match(route, /insertDefinitive && \(insertErr\.message\.includes\('shipping_snapshot'\)/);
    assert.match(route, /insertDefinitive && \(insertErr\.message\.includes\('umkm_id'\)/);
});
test('sumber route: rilis promo di rollback digerbangi flag klaim, bukan spekulatif', () => {
    const rollbackBody = route.slice(rollbackStart, legacyFailureStart);
    assert.match(rollbackBody, /opts\.promoClaimed && checkoutPromoCode/);
    assert.match(rollbackBody, /if \(opts\.refundCoins\)/);
    assert.match(rollbackBody, /compensationSettled: refundOk && promoOk/);
});
test('sumber route: webhook/verify merilis promo hanya untuk pemenang transisi', () => {
    for (const [name, src] of [['webhook', webhook], ['verify', verify]] as const) {
        assert.match(src, /planTerminalPromoRelease\(\{[^}]*updateWon:/s, name);
        assert.match(src, /refund_order_coins/, name);
    }
    assert.match(verify, /cancelled && cancelled\.length > 0 && row\.buyer_id/);
    assert.match(webhook, /expiredRows && expiredRows\.length > 0 && row\.buyer_id/);
});
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
    assert.match(route, /const \{ data, error \} = await serviceClient\.rpc\(operation, params\);/);
    assert.match(route, /classifyCompensationRpcResult\(\{/);
    assert.doesNotMatch(route, /const \{ error \} = await serviceClient\.rpc\(operation, params\);/);
});
test('sumber route: kedua pemanggil release_stock mengaktifkan requireSuccessData', () => {
    assert.equal(route.match(/requireSuccessData: true/g)?.length, 2);
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
const freePathStart = route.indexOf('if (pricing.total === 0) {');
const freePayloadStart = route.indexOf('const freeInsertPayload: Record<string, unknown> = {');
const freePayloadEnd = route.indexOf('};', freePayloadStart);
const freePayload = route.slice(freePayloadStart, freePayloadEnd);
const freeGateIdx = route.indexOf('await claimPromoAndSpendCoins(', freePathStart);
const freePaidMarkIdx = route.indexOf(".update({ payment_status: 'paid', order_status: 'paid' }", freePathStart);
const legacyMismatchStart = route.indexOf('const handleLegacyFreePaidMarkFailure = async (');
const legacyMismatchEnd = route.indexOf('if (idempotencyKey) {', legacyMismatchStart);
const legacyMismatchBody = route.slice(legacyMismatchStart, legacyMismatchEnd);
const legacyMismatchCode = legacyMismatchBody
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
test('Tahap 1.3: order free ditulis unpaid/pending, tidak pernah lahir paid', () => {
    assert.ok(freePathStart !== -1 && freePayloadStart !== -1 && freePayloadEnd > freePayloadStart);
    assert.match(freePayload, /payment_status: 'unpaid'/);
    assert.match(freePayload, /order_status: 'pending'/);
    assert.doesNotMatch(freePayload, /payment_status: 'paid'/);
    assert.doesNotMatch(freePayload, /order_status: 'paid'/);
});
test('Tahap 1.3: penandaan paid di jalur free terjadi SETELAH gate promo/koin', () => {
    assert.ok(freePathStart !== -1);
    assert.ok(freeGateIdx > freePathStart, 'gate promo/koin harus ada di jalur free');
    assert.ok(freePaidMarkIdx > freeGateIdx, 'paid tidak boleh ditulis sebelum gate selesai');
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
function simulateFreeOrderTimeline(opts: {
    gateOk: boolean;
    bornPaid: boolean;
}): FreeTimelineRow[] {
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
    assert.equal(rows.filter((r) => r.payment_status === 'paid').length, 0);
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
    assert.match(route, /handleLegacyFreePaidMarkFailure\(orderCode\)/);
    assert.doesNotMatch(legacyMismatchBody, /\.delete\(\)/);
    assert.doesNotMatch(legacyMismatchBody, /release_stock/);
    assert.doesNotMatch(legacyMismatchBody, /payment_status: 'failed'/);
    assert.match(legacyMismatchBody, /payment === 'paid'/);
    assert.match(legacyMismatchBody, /phase: 'post_gate'/);
    assert.match(legacyMismatchBody, /promoClaimed: checkoutPromoCode != null && promoPercentOff != null/);
    assert.match(legacyMismatchBody, /refundCoins: pricing\.coinUsed > 0/);
});
test('Tahap 1.3: handler mismatch free legacy tidak membaca kolom 2D-E', () => {
    assert.doesNotMatch(legacyMismatchCode, /invoice_state/);
    assert.doesNotMatch(legacyMismatchCode, /idempotency_key/);
});
test('P1-C: settlement: kegagalan debit tidak menurunkan status paid', () => {
    const settleBody = settlement;
    const paidMarkIdx = settleBody.indexOf("payment_status: 'paid'");
    const coinBlockIdx = settleBody.indexOf("await service.rpc('spend_order_coins'");
    assert.ok(paidMarkIdx !== -1 && coinBlockIdx !== -1);
    assert.ok(paidMarkIdx < coinBlockIdx, 'paid harus ditulis sebelum logika Coin');
    assert.doesNotMatch(settleBody, /payment_status: 'failed'/);
    assert.doesNotMatch(settleBody, /payment_status: 'unpaid'/);
    assert.doesNotMatch(settleBody, /payment_status: 'refunded'/);
});
test('P1-C: settlement: orders.coin_used tidak pernah diubah', () => {
    const settleBody = settlement;
    assert.doesNotMatch(settleBody, /coin_used:\s*0/);
    assert.doesNotMatch(settleBody, /coin_used:\s*null/);
    assert.doesNotMatch(settleBody, /SET\s+coin_used/i);
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
    assert.match(settlement, /import \{\s*classifyCoinDebitOutcome,\s*interpretDebtWriteResult,\s*isTerminalOrderState,/);
    assert.match(settlement, /spentExistsInLedger: ledger\.spentExists/);
    assert.match(settlement, /ledgerCheckFailed: ledger\.failed/);
    assert.match(settlement, /orderIsTerminal: orderState\.isTerminal/);
});
test('P1-C: settlement: kegagalan pencatatan utang dicatat sebagai kritis', () => {
    assert.match(settlement, /CRITICAL: gagal mencatat utang debit Coin \(rekonsiliasi manual diperlukan\)/);
    assert.doesNotMatch(settlement, /throw new Error\(/);
});
test('P1-C: settlement: tidak ada retry otomatis pada webhook/verify', () => {
    assert.match(settlement, /if \(row\.payment_status === 'paid'\) \{\s*return \{ settled: false, reason: 'already_paid' \};/);
    const settleCoinIdx = settlement.indexOf("await service.rpc('spend_order_coins'");
    const alreadyIdx = settlement.indexOf("reason: 'already_paid'");
    assert.ok(settleCoinIdx > alreadyIdx, 'early return already_paid mendahului logika Coin');
    assert.match(verify, /if \(currentStatus !== 'unpaid' \|\| !invoiceId\)/);
});
test('P1-C: helper coin-debit: klasifikasi murni tanpa I/O', () => {
    assert.doesNotMatch(coinDebit, /createClient|SupabaseClient|\.from\(|await |fetch\(/);
    assert.match(coinDebit, /export function classifyCoinDebitOutcome/);
    assert.match(coinDebit, /export function isTerminalOrderState/);
    const spentIdx = coinDebit.indexOf('if (opts.spentExistsInLedger)');
    const errIdx = coinDebit.indexOf('if (opts.ledgerCheckFailed === true || hasRpcError)');
    assert.ok(spentIdx !== -1 && errIdx !== -1);
    assert.ok(spentIdx < errIdx, 'ledger lebih didahulukan daripada error RPC');
});
test('P1-C: migrasi — refund berbasis ledger, bukan snapshot coin_used', () => {
    const triggerBody = p1cMigration.slice(p1cMigration.indexOf('CREATE OR REPLACE FUNCTION public.refund_order_coins_on_terminal()'), p1cMigration.indexOf('CREATE OR REPLACE FUNCTION public.spend_order_coins('));
    assert.ok(triggerBody.length > 0);
    const triggerCode = triggerBody
        .split('\n')
        .filter((l) => !l.trim().startsWith('--'))
        .join('\n');
    assert.doesNotMatch(triggerCode, /NEW\.coin_used/);
    assert.match(triggerBody, /type = 'spent'/);
    assert.match(triggerBody, /pg_advisory_xact_lock\(hashtext\('rebites-coin:' \|\| NEW\.buyer_id::text\)\)/);
    assert.match(triggerBody, /ON CONFLICT DO NOTHING/);
    assert.match(triggerBody, /type = 'earned'/);
    assert.match(triggerBody, /IF NOT v_is_bad OR v_was_bad THEN/);
});
test('P1-C: migrasi — debit order terminal ditolak tanpa race', () => {
    const spendBody = p1cMigration.slice(p1cMigration.indexOf('CREATE OR REPLACE FUNCTION public.spend_order_coins('), p1cMigration.indexOf('CREATE OR REPLACE FUNCTION public.guard_orders_insert_coin_debit_defaults()'));
    assert.ok(spendBody.length > 0);
    const rowLockIdx = spendBody.indexOf('FOR NO KEY UPDATE');
    const advisoryIdx = spendBody.indexOf("pg_advisory_xact_lock(hashtext('rebites-coin:'");
    const terminalIdx = spendBody.indexOf('v_order_is_terminal :=');
    assert.ok(rowLockIdx !== -1 && advisoryIdx !== -1 && terminalIdx !== -1);
    assert.ok(rowLockIdx < advisoryIdx, 'row lock order harus sebelum advisory lock');
    assert.ok(advisoryIdx < terminalIdx, 'pemeriksaan terminal di bawah kedua lock');
    assert.match(spendBody, /IF FOUND THEN\s*RETURN true;/);
    assert.doesNotMatch(spendBody, /FOR UPDATE|FOR SHARE/);
});
test('P1-C: migrasi — status utang durable terbatas pada NULL/pending/insufficient', () => {
    assert.match(p1cMigration, /ADD COLUMN IF NOT EXISTS coin_debit_status text/);
    assert.match(p1cMigration, /ADD COLUMN IF NOT EXISTS coin_debit_reason text/);
    assert.match(p1cMigration, /ADD COLUMN IF NOT EXISTS coin_debit_updated_at timestamptz/);
    assert.match(p1cMigration, /coin_debit_status IN \('pending', 'insufficient'\)/);
    assert.match(p1cMigration, /coin_debit_reason IN \('rpc_error', 'insufficient_balance'\)/);
    assert.doesNotMatch(p1cMigration, /'resolved'/);
    assert.doesNotMatch(p1cMigration, /attempt_count|next_retry_at/);
    assert.doesNotMatch(p1cMigration, /pg_cron|cron\.schedule|pg_net/);
    assert.doesNotMatch(p1cMigration, /UPDATE\s+public\.orders\s+SET\s+coin_used/);
    assert.doesNotMatch(p1cMigration, /ALTER COLUMN coin_used/);
});
test('K-1: P1-C tidak menimpa/menghapus guard insert lama', () => {
    assert.equal(extractSqlFunction(p1cMigration, 'guard_orders_insert_client_defaults'), null, 'P1-C tidak boleh CREATE OR REPLACE guard_orders_insert_client_defaults');
    assert.doesNotMatch(p1cMigration, /DROP\s+FUNCTION[^;]*guard_orders_insert_client_defaults/i, 'P1-C tidak boleh menghapus fungsi guard lama');
    assert.doesNotMatch(p1cMigration, /DROP TRIGGER[^;]*trg_orders_guard_insert ON/i);
});
test('K-1: guard efektif setelah P1-C mempertahankan SELURUH proteksi versi sebelumnya', () => {
    const defs = guardDefinitionsBeforeP1C();
    assert.ok(defs.length >= 2, 'harus ada definisi guard sebelum P1-C');
    const previous = defs[defs.length - 2];
    const effective = defs[defs.length - 1];
    assert.equal(effective.file, '20261007000004_p1a_coin_order_financial_security.sql', 'definisi guard terakhir sebelum P1-C harus berasal dari P1-A');
    const previousAssignments = extractNewAssignments(previous.body);
    const effectiveAssignments = new Set(extractNewAssignments(effective.body));
    assert.ok(previousAssignments.length > 0);
    for (const assignment of previousAssignments) {
        assert.ok(effectiveAssignments.has(assignment), `proteksi hilang dari guard efektif: NEW.${assignment}`);
    }
});
test('K-1: guard efektif masih memaksa estimated_completion_at = NULL', () => {
    const defs = guardDefinitionsBeforeP1C();
    const effective = defs[defs.length - 1];
    assert.match(effective.body, /NEW\.estimated_completion_at := NULL;/);
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
    assert.deepEqual(extractNewAssignments(newGuard), [
        'coin_debit_reason=NULL',
        'coin_debit_status=NULL',
        'coin_debit_updated_at=NULL',
    ]);
});
test('K-1: trigger baru kompatibel dengan trigger BEFORE INSERT yang sudah ada', () => {
    assert.match(p1cMigration, /DROP TRIGGER IF EXISTS trg_orders_guard_insert_coin_debit ON public\.orders;/);
    assert.match(p1cMigration, /CREATE TRIGGER trg_orders_guard_insert_coin_debit\s+BEFORE INSERT ON public\.orders\s+FOR EACH ROW EXECUTE FUNCTION public\.guard_orders_insert_coin_debit_defaults\(\)/);
    assert.ok('trg_orders_guard_insert' < 'trg_orders_guard_insert_coin_debit');
    const p0a = readFileSync(new URL('../supabase/migrations/20261007000000_p0a_security_hardening.sql', import.meta.url), 'utf8');
    assert.match(p0a, /CREATE TRIGGER trg_orders_guard_insert\s+BEFORE INSERT ON public\.orders\s+FOR EACH ROW EXECUTE FUNCTION public\.guard_orders_insert_client_defaults\(\)/);
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
test('S-1: debit baru menolak p_user_id yang bukan buyer_id order', () => {
    const spendBody = p1cMigration.slice(p1cMigration.indexOf('CREATE OR REPLACE FUNCTION public.spend_order_coins('), p1cMigration.indexOf('CREATE OR REPLACE FUNCTION public.guard_orders_insert_coin_debit_defaults()'));
    assert.ok(spendBody.length > 0);
    assert.match(spendBody, /SELECT o\.payment_status, o\.order_status, o\.buyer_id/);
    assert.match(spendBody, /INTO v_order_payment_status, v_order_status, v_order_buyer_id/);
    assert.match(spendBody, /IF v_order_found AND \(v_order_buyer_id IS NULL OR v_order_buyer_id <> p_user_id\) THEN\s*RETURN false;\s*END IF;/);
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
    assert.match(spendBody, /IF FOUND THEN\s*RETURN true;/);
    assert.match(spendBody, /v_order_is_terminal :=/);
    assert.match(spendBody, /EXCEPTION WHEN unique_violation THEN/);
});
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
    assert.doesNotMatch(fnBody, /retry|for \(|while \(/i);
    assert.doesNotMatch(fnBody, /throw new Error\(/);
});
test('P1-C: tidak ada perubahan perilaku checkout (kompensasi & stok)', () => {
    assert.equal(route.match(/'release_stock'/g)?.length, 2);
    assert.equal(route.match(/requireSuccessData: true/g)?.length, 2);
    const paidMarkIdx = route.indexOf(".update({ payment_status: 'paid', order_status: 'paid' }");
    assert.ok(paidMarkIdx !== -1);
    const paidMarkBlock = route.slice(paidMarkIdx, paidMarkIdx + 700);
    assert.match(paidMarkBlock, /\.eq\('payment_status', 'unpaid'\)/);
    assert.ok(route.indexOf('await claimPromoAndSpendCoins(', route.indexOf('if (pricing.total === 0) {')) <
        paidMarkIdx, 'gate sebelum penandaan paid di jalur free');
    assert.match(webhook, /currentPayment === 'paid'/);
    assert.match(verify, /currentStatus !== 'unpaid'/);
});
