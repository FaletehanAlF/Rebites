import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IDEMPOTENCY_KEY_MAX_LENGTH, INVOICE_STATES, canTransitionInvoiceState, classifyInvoiceError, classifyReplay, normalizeIdempotencyKey, planKeyedFailureCompensation, planTerminalPromoRelease, type KeyedFailurePhase, } from '../lib/server/checkout-idempotency.ts';
import { classifyCoinDebitOutcome, isTerminalOrderState, } from '../lib/server/coin-debit.ts';
test('normalizeIdempotencyKey: hanya string wajar yang diterima', () => {
    assert.equal(normalizeIdempotencyKey('  abc-123  '), 'abc-123');
    assert.equal(normalizeIdempotencyKey(''), null);
    assert.equal(normalizeIdempotencyKey('   '), null);
    assert.equal(normalizeIdempotencyKey(undefined), null);
    assert.equal(normalizeIdempotencyKey(null), null);
    assert.equal(normalizeIdempotencyKey(42), null);
    assert.equal(normalizeIdempotencyKey('x'.repeat(IDEMPOTENCY_KEY_MAX_LENGTH + 1)), null);
    assert.equal(normalizeIdempotencyKey('y'.repeat(IDEMPOTENCY_KEY_MAX_LENGTH)), 'y'.repeat(IDEMPOTENCY_KEY_MAX_LENGTH));
});
test('INVOICE_STATES: himpunan state kanonis', () => {
    assert.deepEqual([...INVOICE_STATES].sort(), [
        'attached',
        'failed',
        'inflight',
        'not_started',
        'unknown',
    ]);
});
test('canTransitionInvoiceState: unknown tidak boleh langsung attached', () => {
    assert.equal(canTransitionInvoiceState('not_started', 'inflight'), true);
    assert.equal(canTransitionInvoiceState('not_started', 'failed'), true);
    assert.equal(canTransitionInvoiceState('inflight', 'unknown'), true);
    assert.equal(canTransitionInvoiceState('inflight', 'attached'), true);
    assert.equal(canTransitionInvoiceState('inflight', 'failed'), true);
    assert.equal(canTransitionInvoiceState('unknown', 'inflight'), true);
    assert.equal(canTransitionInvoiceState('unknown', 'failed'), true);
    assert.equal(canTransitionInvoiceState('unknown', 'attached'), false);
    assert.equal(canTransitionInvoiceState(null, 'inflight'), false);
    assert.equal(canTransitionInvoiceState(undefined, 'attached'), false);
    assert.equal(canTransitionInvoiceState('failed', 'attached'), false);
    assert.equal(canTransitionInvoiceState('attached', 'inflight'), false);
    assert.equal(canTransitionInvoiceState('attached', 'failed'), true);
});
test('classifyInvoiceError: jaringan/timeout/429/5xx = unknown', () => {
    const unknownCases = [
        new Error('Xendit timeout (10s) - coba lagi'),
        new Error('fetch failed'),
        new Error('network error'),
        new Error('socket hang up'),
        new Error('ECONNRESET'),
        new Error('EAI_AGAIN'),
        new Error('Xendit error 429'),
        new Error('Xendit error 500'),
        new Error('Xendit error 503'),
        new Error('rate limit exceeded'),
        new Error('RATE_LIMIT_EXCEEDED'),
    ];
    for (const err of unknownCases) {
        assert.equal(classifyInvoiceError(err), 'unknown', `harus unknown: ${err.message}`);
    }
});
test('classifyInvoiceError: tidak menganggap angka biasa sebagai HTTP 4xx', () => {
    const notDefinitive = [
        'Amount 14000 is below the minimum',
        'Xendit error nominal 4000 tidak valid',
        'error code 4221 tidak dikenal',
        'amount (4001) tidak sah',
        'HTTP 4000 bytes too large',
        'Pesanan RB-4040 sudah ada',
        'Reference 422 dibayar dua kali',
    ];
    for (const msg of notDefinitive) {
        assert.equal(classifyInvoiceError(new Error(msg)), 'unknown', `harus conservatively unknown: ${msg}`);
    }
});
test('classifyInvoiceError: hanya kode 4xx eksplisit = definitif', () => {
    const definitive = [
        'Xendit error 400',
        'Xendit error 401',
        'Xendit error 404',
        'Xendit error 422',
        'status 422',
        'statuscode 400',
        'HTTP 404',
    ];
    for (const msg of definitive) {
        assert.equal(classifyInvoiceError(new Error(msg)), 'definitive', `harus definitive: ${msg}`);
    }
    assert.equal(classifyInvoiceError('Xendit error 422'), 'definitive');
    assert.equal(classifyInvoiceError(null), 'unknown');
    assert.equal(classifyInvoiceError(undefined), 'unknown');
});
test('classifyInvoiceError: status HTTP eksplisit diutamakan atas pesan', () => {
    for (const status of [400, 401, 403, 404, 422]) {
        assert.equal(classifyInvoiceError(Object.assign(new Error('Amount 14000 is invalid'), { status })), 'definitive', `status ${status} harus definitive`);
    }
    for (const status of [429, 500, 502, 503]) {
        assert.equal(classifyInvoiceError(Object.assign(new Error('Xendit error'), { status })), 'unknown', `status ${status} harus unknown`);
    }
    assert.equal(classifyInvoiceError({ message: 'x', statusCode: '422' }), 'definitive');
    assert.equal(classifyInvoiceError({ message: 'amount 14000', status: 0 }), 'unknown');
    assert.equal(classifyInvoiceError({ message: 'nominal 14000', status: 'abc' }), 'unknown');
});
test('classifyReplay: pemetaan baris existing tanpa efek samping', () => {
    assert.equal(classifyReplay({ payment_status: 'paid' }), 'success');
    for (const row of [
        { payment_status: 'failed' },
        { payment_status: 'refunded' },
        { order_status: 'cancelled' },
        { order_status: 'refunded' },
        { order_status: 'failed' },
    ]) {
        assert.equal(classifyReplay(row), 'failed_final');
    }
    assert.equal(classifyReplay({ payment_status: 'unpaid', xendit_invoice_id: 'inv_1' }), 'attached_unpaid');
    assert.equal(classifyReplay({ payment_status: 'unpaid' }), 'checking');
    assert.equal(classifyReplay({ payment_status: 'unpaid', invoice_state: 'inflight' }), 'checking');
    assert.equal(classifyReplay({ payment_status: 'unpaid', invoice_state: 'unknown' }), 'checking');
    assert.equal(classifyReplay({ payment_status: 'unpaid', invoice_state: 'attached' }), 'checking');
    assert.equal(classifyReplay({}), 'checking');
});
test('planKeyedFailureCompensation: tidak ada rilis/refund ganda', () => {
    assert.deepEqual(planKeyedFailureCompensation('pre_gate', false), {
        clearCoinSnapshot: true,
        releasePromo: false,
    });
    assert.deepEqual(planKeyedFailureCompensation('pre_gate', true), {
        clearCoinSnapshot: true,
        releasePromo: false,
    });
    assert.deepEqual(planKeyedFailureCompensation('post_gate', true), {
        clearCoinSnapshot: false,
        releasePromo: true,
    });
    assert.deepEqual(planKeyedFailureCompensation('post_gate', false), {
        clearCoinSnapshot: false,
        releasePromo: false,
    });
    for (const phase of ['pre_gate', 'post_gate'] as KeyedFailurePhase[]) {
        for (const claimed of [true, false]) {
            const plan = planKeyedFailureCompensation(phase, claimed);
            assert.equal(plan.clearCoinSnapshot, phase === 'pre_gate');
            assert.equal(plan.releasePromo, phase === 'post_gate' && claimed);
        }
    }
});
test('planTerminalPromoRelease: order terminal dengan promo terklaim dirilis', () => {
    assert.deepEqual(planTerminalPromoRelease({ updateWon: true, promoCode: '  hemat20  ' }), { release: true, promoCode: 'HEMAT20' });
});
test('planTerminalPromoRelease: order tanpa promo tidak melepas apa pun', () => {
    for (const promo of [null, undefined, '', '   ', 0, 42, {}, []]) {
        assert.deepEqual(planTerminalPromoRelease({ updateWon: true, promoCode: promo }), { release: false, promoCode: null }, `promo tak valid harus tidak dirilis: ${JSON.stringify(promo)}`);
    }
});
test('planTerminalPromoRelease: webhook & verify memproses order sama -> satu rilis', () => {
    const row = { promo_code: 'HEMAT20' };
    const webhookWins = [
        planTerminalPromoRelease({ updateWon: true, promoCode: row.promo_code }),
        planTerminalPromoRelease({ updateWon: false, promoCode: row.promo_code }),
    ].filter((p) => p.release);
    assert.equal(webhookWins.length, 1);
    const verifyWins = [
        planTerminalPromoRelease({ updateWon: false, promoCode: row.promo_code }),
        planTerminalPromoRelease({ updateWon: true, promoCode: row.promo_code }),
    ].filter((p) => p.release);
    assert.equal(verifyWins.length, 1);
});
test('planTerminalPromoRelease: kompensasi tidak pernah lebih dari sekali', () => {
    const attempts = [true, false, false, false];
    let releases = 0;
    for (const updateWon of attempts) {
        if (planTerminalPromoRelease({ updateWon, promoCode: 'HEMAT20' }).release) {
            releases += 1;
        }
    }
    assert.equal(releases, 1);
});
test('planTerminalPromoRelease: notifikasi terminal terlambat tidak melepas', () => {
    const plan = planTerminalPromoRelease({
        updateWon: false,
        promoCode: 'HEMAT20',
    });
    assert.equal(plan.release, false);
    assert.equal(plan.promoCode, null);
    assert.equal(planTerminalPromoRelease({ updateWon: false, promoCode: 'HEMAT20' }).release, false);
});
test('jalur status HTTP, keamanan terminal, & pelepasan promo terpasang', () => {
    const xendit = readFileSync(new URL('../lib/server/xendit.ts', import.meta.url), 'utf8');
    assert.match(xendit, /err\.status = status/);
    assert.match(xendit, /throw makeXenditHttpError\(msg, res\.status\)/);
    const route = readFileSync(new URL('../app/api/checkout/xendit/route.ts', import.meta.url), 'utf8');
    assert.match(route, /planKeyedFailureCompensation\(phase, promoClaimed\)/);
    assert.match(route, /handleKeyedMismatch\(\s*orderCode,\s*'post_gate'/);
    assert.doesNotMatch(route, /failKeyedOrder\(orderCode, \{ releasePromo: false, clearCoinSnapshot: clearSnapshot \}\)/);
    const webhook = readFileSync(new URL('../app/api/webhooks/xendit/route.ts', import.meta.url), 'utf8');
    const verify = readFileSync(new URL('../app/api/checkout/xendit/verify/route.ts', import.meta.url), 'utf8');
    for (const src of [webhook, verify]) {
        assert.match(src, /planTerminalPromoRelease\(/);
        assert.match(src, /release_promo/);
        assert.match(src, /EXPIRED/);
        assert.match(src, /VOIDED/);
        assert.match(src, /\.eq\('payment_status', 'unpaid'\)/);
    }
    assert.match(webhook, /currentPayment === 'paid'/);
    assert.match(verify, /invoiceStatus === 'EXPIRED'/);
});
test('terminal: invoice_state failed hanya lewat UPDATE unpaid -> failed', () => {
    const webhook = readFileSync(new URL('../app/api/webhooks/xendit/route.ts', import.meta.url), 'utf8');
    const verify = readFileSync(new URL('../app/api/checkout/xendit/verify/route.ts', import.meta.url), 'utf8');
    for (const [name, src] of [
        ['webhook', webhook],
        ['verify', verify],
    ] as const) {
        assert.match(src, /\.update\(\{[\s\S]*?payment_status: 'failed'[\s\S]*?invoice_state: 'failed'[\s\S]*?\.eq\('payment_status', 'unpaid'\)/, `${name}: invoice_state failed harus di UPDATE terminal tergerbangi unpaid`);
    }
    assert.match(webhook, /currentPayment === 'paid'/);
    assert.match(verify, /currentStatus !== 'unpaid'/);
});
test('I1: abandon tanpa hard delete + guard unpaid (retensi order)', () => {
    const route = readFileSync(new URL('../app/api/checkout/xendit/route.ts', import.meta.url), 'utf8');
    const abandonStart = route.indexOf('const abandonCheckoutOrder = async (');
    const rollbackStart = route.indexOf('const rollbackCheckoutOrder = async (');
    assert.ok(abandonStart !== -1 && rollbackStart > abandonStart);
    const abandonBody = route.slice(abandonStart, rollbackStart);
    assert.doesNotMatch(abandonBody, /\.delete\(\)/);
    assert.match(abandonBody, /\.eq\('payment_status', 'unpaid'\)/);
    assert.match(abandonBody, /\.is\('xendit_invoice_id', null\)/);
    assert.match(abandonBody, /payment_status === 'paid'/);
});
test('I1: kegagalan invoice legacy diklasifikasi (unknown dipertahankan, definitive di-rollback)', () => {
    const route = readFileSync(new URL('../app/api/checkout/xendit/route.ts', import.meta.url), 'utf8');
    const legacyUnknown = route.lastIndexOf('if (cls === \'unknown\')');
    const legacyDefinitive = route.lastIndexOf('await rollbackCheckoutOrder(orderCode, {');
    assert.ok(legacyUnknown !== -1, 'cabang unknown legacy harus ada');
    assert.ok(legacyDefinitive > legacyUnknown, 'cabang definitive legacy harus mengikuti unknown');
    const unknownBlock = route.slice(legacyUnknown, legacyDefinitive);
    assert.doesNotMatch(unknownBlock, /rollbackCheckoutOrder/);
    assert.doesNotMatch(unknownBlock, /transitionInvoiceState/);
    assert.match(unknownBlock, /retryable: true/);
    assert.match(unknownBlock, /status: 409/);
    const definitiveBlock = route.slice(legacyDefinitive, route.indexOf('const { error: notifErr }', legacyDefinitive));
    assert.match(definitiveBlock, /await rollbackCheckoutOrder\(orderCode/);
    assert.match(definitiveBlock, /phase: 'post_gate'/);
});
test('amount_mismatch: kode HTTP konsisten di webhook & verify order', () => {
    const webhook = readFileSync(new URL('../app/api/webhooks/xendit/route.ts', import.meta.url), 'utf8');
    const verify = readFileSync(new URL('../app/api/checkout/xendit/verify/route.ts', import.meta.url), 'utf8');
    const webhookOrderMismatch = webhook.match(/amount_mismatch[\s\S]*?status: (\d+)[\s\S]*?already_paid/);
    assert.ok(webhookOrderMismatch, 'cabang amount_mismatch order webhook harus ada');
    const verifyOrderMismatch = verify.match(/amount_mismatch[\s\S]*?status: (\d+)/);
    assert.ok(verifyOrderMismatch, 'cabang amount_mismatch verify harus ada');
    assert.equal(webhookOrderMismatch[1], '409');
    assert.equal(verifyOrderMismatch[1], '409');
    assert.equal(webhookOrderMismatch[1], verifyOrderMismatch[1]);
});
test('P1-C: RPC true => debit_ok, tanpa utang', () => {
    const v = classifyCoinDebitOutcome({
        data: true,
        error: null,
        spentExistsInLedger: false,
    });
    assert.equal(v.outcome, 'debit_ok');
    assert.equal(v.status, null);
    assert.equal(v.reason, null);
    assert.equal(v.debtRecorded, false);
    assert.equal(v.uncertain, false);
});
test('P1-C: RPC false + ledger tanpa spent + order diketahui hidup => insufficient', () => {
    const v = classifyCoinDebitOutcome({
        data: false,
        error: null,
        spentExistsInLedger: false,
        orderIsTerminal: false,
    });
    assert.equal(v.outcome, 'insufficient');
    assert.equal(v.status, 'insufficient');
    assert.equal(v.reason, 'insufficient_balance');
    assert.equal(v.debtRecorded, true);
    assert.equal(v.uncertain, false);
});
test('P1-C: RPC error + ledger tanpa spent => rpc_error/pending (retryable)', () => {
    const v = classifyCoinDebitOutcome({
        data: null,
        error: { message: 'fetch failed' },
        spentExistsInLedger: false,
    });
    assert.equal(v.outcome, 'rpc_error');
    assert.equal(v.status, 'pending');
    assert.equal(v.reason, 'rpc_error');
    assert.equal(v.debtRecorded, true);
    assert.equal(v.uncertain, true);
});
test('P1-C: RPC error TAPI ledger punya spent => already_debited, tanpa utang palsu', () => {
    const v = classifyCoinDebitOutcome({
        data: null,
        error: { message: 'timeout' },
        spentExistsInLedger: true,
    });
    assert.equal(v.outcome, 'already_debited');
    assert.equal(v.status, null);
    assert.equal(v.reason, null);
    assert.equal(v.debtRecorded, false);
    assert.equal(v.uncertain, false);
});
test('P1-C: order terminal => tidak ada utang (order void)', () => {
    const v = classifyCoinDebitOutcome({
        data: false,
        error: null,
        spentExistsInLedger: false,
        orderIsTerminal: true,
    });
    assert.equal(v.outcome, 'order_terminal');
    assert.equal(v.status, null);
    assert.equal(v.reason, null);
    assert.equal(v.debtRecorded, false);
});
test('P1-C: verifikasi ledger GAGAL => pending (tidak disimpulkan "tidak terjadi")', () => {
    const v = classifyCoinDebitOutcome({
        data: false,
        error: null,
        spentExistsInLedger: false,
        ledgerCheckFailed: true,
        orderIsTerminal: false,
    });
    assert.equal(v.outcome, 'rpc_error');
    assert.equal(v.status, 'pending');
    assert.equal(v.reason, 'rpc_error');
    assert.equal(v.uncertain, true);
});
test('P1-C: RPC true menang atas ledger kosong (RPC adalah fakta debit)', () => {
    const v = classifyCoinDebitOutcome({
        data: true,
        error: { message: 'noise' },
        spentExistsInLedger: false,
        orderIsTerminal: false,
    });
    assert.equal(v.outcome, 'debit_ok');
    assert.equal(v.debtRecorded, false);
});
test('P1-C/R-2: status order tidak diketahui (null) => pending, BUKAN insufficient', () => {
    const v = classifyCoinDebitOutcome({
        data: false,
        error: null,
        spentExistsInLedger: false,
        orderIsTerminal: null,
    });
    assert.equal(v.outcome, 'order_state_unknown');
    assert.equal(v.status, 'pending');
    assert.equal(v.reason, 'rpc_error');
    assert.equal(v.debtRecorded, true);
    assert.equal(v.uncertain, true);
    assert.notEqual(v.outcome, 'order_terminal');
});
test('P1-C/R-2: status order tidak disediakan (undefined) => pending, bukan insufficient', () => {
    const v = classifyCoinDebitOutcome({
        data: false,
        error: null,
        spentExistsInLedger: false,
    });
    assert.equal(v.outcome, 'order_state_unknown');
    assert.equal(v.status, 'pending');
    assert.equal(v.uncertain, true);
});
test('P1-C/R-2: error RPC tetap menang atas status order yang tidak diketahui', () => {
    const v = classifyCoinDebitOutcome({
        data: null,
        error: { message: 'fetch failed' },
        spentExistsInLedger: false,
        orderIsTerminal: null,
    });
    assert.equal(v.outcome, 'rpc_error');
    assert.equal(v.status, 'pending');
    assert.equal(v.reason, 'rpc_error');
});
test('P1-C/R-1: status utang hanya nilai yang diizinkan CHECK constraint', () => {
    const all = [
        classifyCoinDebitOutcome({ data: true, error: null, spentExistsInLedger: false }),
        classifyCoinDebitOutcome({
            data: false,
            error: null,
            spentExistsInLedger: false,
            orderIsTerminal: true,
        }),
        classifyCoinDebitOutcome({
            data: false,
            error: null,
            spentExistsInLedger: false,
            orderIsTerminal: false,
        }),
        classifyCoinDebitOutcome({
            data: null,
            error: { message: 'x' },
            spentExistsInLedger: false,
        }),
        classifyCoinDebitOutcome({
            data: false,
            error: null,
            spentExistsInLedger: false,
            orderIsTerminal: null,
        }),
    ];
    const writable = new Set(['pending', 'insufficient']);
    for (const v of all) {
        assert.ok(v.status === null || writable.has(v.status), `status ${String(v.status)} di luar kontrak skema`);
        if (v.status === null)
            assert.equal(v.reason, null);
        else
            assert.ok(v.reason === 'rpc_error' || v.reason === 'insufficient_balance');
    }
});
test('P1-C: predikat order terminal sama dengan v_is_bad pada trigger DB', () => {
    for (const [payment, order, expected] of [
        ['unpaid', 'cancelled', true],
        ['unpaid', 'failed', true],
        ['unpaid', 'refunded', true],
        ['failed', 'pending', true],
        ['refunded', 'paid', true],
        ['paid', 'paid', false],
        ['unpaid', 'pending', false],
        ['paid', 'processing', false],
        ['paid', 'completed', false],
        ['unpaid', 'preparing', false],
    ] as const) {
        assert.equal(isTerminalOrderState(payment, order), expected, `payment=${payment} order=${order}`);
    }
    assert.equal(isTerminalOrderState(null, null), false);
    assert.equal(isTerminalOrderState(undefined, undefined), false);
});
test('Tahap 1.3: jalur free — satu penandaan paid, ditulis setelah gate promo/koin', () => {
    const route = readFileSync(new URL('../app/api/checkout/xendit/route.ts', import.meta.url), 'utf8');
    const freeStart = route.indexOf('if (pricing.total === 0) {');
    const gateIdx = route.indexOf('await claimPromoAndSpendCoins(', freeStart);
    const paidIdx = route.indexOf(".update({ payment_status: 'paid', order_status: 'paid' }", freeStart);
    assert.ok(freeStart !== -1);
    assert.ok(gateIdx > freeStart, 'gate promo/koin harus ada di jalur free');
    assert.ok(paidIdx > gateIdx, 'paid tidak boleh ditulis sebelum gate selesai');
    assert.equal(route.match(/payment_status: 'paid', order_status: 'paid'/g)?.length, 1);
    const markBlock = route.slice(paidIdx, paidIdx + 700);
    assert.match(markBlock, /\.eq\('payment_status', 'unpaid'\)/);
    assert.match(route, /handleKeyedMismatch\(\s*orderCode,\s*'post_gate'/);
    assert.match(route, /handleLegacyFreePaidMarkFailure\(orderCode\)/);
});
test('Tahap 1.3: jalur free legacy — order lahir unpaid/pending (bukan paid-at-insert)', () => {
    const route = readFileSync(new URL('../app/api/checkout/xendit/route.ts', import.meta.url), 'utf8');
    const payloadStart = route.indexOf('const freeInsertPayload: Record<string, unknown> = {');
    const payloadEnd = route.indexOf('};', payloadStart);
    assert.ok(payloadStart !== -1 && payloadEnd > payloadStart);
    const payload = route.slice(payloadStart, payloadEnd);
    assert.doesNotMatch(payload, /payment_status: 'paid'/);
    assert.doesNotMatch(payload, /order_status: 'paid'/);
    assert.match(payload, /payment_status: 'unpaid'/);
    assert.match(payload, /order_status: 'pending'/);
    const legacyInsertIdx = route.indexOf("from('orders').insert(freeInsertPayload)", payloadStart);
    assert.ok(legacyInsertIdx !== -1, 'INSERT free legacy harus ada');
    assert.ok(legacyInsertIdx < gateIdxOfFreePath(route), 'insert free legacy harus sebelum gate');
});
function gateIdxOfFreePath(route: string): number {
    const freeStart = route.indexOf('if (pricing.total === 0) {');
    const idx = route.indexOf('await claimPromoAndSpendCoins(', freeStart);
    assert.ok(idx > freeStart);
    return idx;
}
