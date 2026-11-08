import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getSellerAction, resolveOrderPhase, } from '../lib/order-status-source.ts';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
const SELLER_PAGE = readProjectFile('app/(app)/dashboard/penjual/[storeId]/pesanan/page.tsx');
const ORDER_UTILS = readProjectFile('lib/order-utils.ts');
const STATUS_SOURCE = readProjectFile('lib/order-status-source.ts');
function stripComments(source: string): string {
    return source
        .split('\n')
        .map((line) => {
        const tanpaBlok = line.replace(/\/\*.*?\*\//g, '');
        return tanpaBlok.replace(/\/\/.*$/, '');
    })
        .join('\n');
}
const SELLER_CODE = stripComments(SELLER_PAGE);
const ORDER_UTILS_CODE = stripComments(ORDER_UTILS);
const STATUS_SOURCE_CODE = stripComments(STATUS_SOURCE);
test('dashboard penjual memakai sumber kebenaran tunggal', () => {
    assert.ok(!SELLER_CODE.includes('!order.progressStatus'), 'dashboard penjual masih memakai syarat !order.progressStatus');
    assert.ok(SELLER_CODE.includes('resolveOrderPhase'), 'dashboard penjual harus menentukan fase lewat resolveOrderPhase');
    assert.ok(SELLER_CODE.includes('getSellerAction'), 'dashboard penjual harus menentukan aksi lewat getSellerAction');
});
test('dashboard penjual tidak lagi memakai getValidActions', () => {
    assert.ok(!SELLER_CODE.includes('getValidActions'), 'dashboard penjual masih memakai getValidActions (lama)');
});
test('tidak ada jalur tombol yang mencoba paid langsung ke out_for_delivery', () => {
    assert.ok(!/const target = order\.fulfillment === 'delivery' \? 'out_for_delivery'/.test(SELLER_CODE), 'masih ada handler yang mencoba paid -> out_for_delivery');
});
test('getOrderSubStatus diturunkan dari fase operasional', () => {
    assert.ok(ORDER_UTILS_CODE.includes('resolveOrderPhase'), 'getOrderSubStatus harus memakai resolveOrderPhase');
    const body = ORDER_UTILS_CODE.slice(ORDER_UTILS_CODE.indexOf('export function getOrderSubStatus'));
    const beforeFallback = body.slice(0, body.indexOf('SUB_STATUS_LABEL'));
    assert.ok(!/order\.progressStatus/.test(beforeFallback), 'getOrderSubStatus masih membaca progress_status secara langsung');
});
test('modul sumber kebenaran tidak memakai progress_status sebagai penentu', () => {
    const advancedBlock = STATUS_SOURCE_CODE.slice(STATUS_SOURCE_CODE.indexOf('const PROGRESS_ADVANCED'), STATUS_SOURCE_CODE.indexOf('const NOT_YET_ADVANCED'));
    assert.ok(!advancedBlock.includes('disiapkan'), "PROGRESS_ADVANCED tidak boleh memuat 'disiapkan'");
});
test('alur dua langkah dari paid bisa diselesaikan', () => {
    let order = {
        status: 'ongoing',
        orderStatus: 'paid',
        progressStatus: 'disiapkan',
        fulfillment: 'delivery',
    };
    const first = getSellerAction(resolveOrderPhase(order), order.fulfillment);
    assert.ok(first, 'harus ada aksi pada status paid');
    assert.equal(first.targetStatus, 'processing');
    order = { ...order, orderStatus: first.targetStatus };
    const second = getSellerAction(resolveOrderPhase(order), order.fulfillment);
    assert.ok(second, 'harus ada aksi pada status processing');
    assert.equal(second.targetStatus, 'out_for_delivery');
    order = { ...order, orderStatus: second.targetStatus };
    const third = getSellerAction(resolveOrderPhase(order), order.fulfillment);
    assert.ok(third, 'harus ada aksi pada status out_for_delivery');
    assert.equal(third.targetStatus, 'completed');
});
test('setiap langkah alur ini diizinkan trigger database', () => {
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
            if (!action)
                continue;
            assert.ok(allowed.has(`${phase}>${action.targetStatus}`), `pasangan ${phase}>${action.targetStatus} tidak diizinkan trigger`);
        }
    }
});
test('pesanan lama dengan progress_status diantar tidak kembali ke pending', () => {
    const phase = resolveOrderPhase({
        status: 'ongoing',
        orderStatus: 'paid',
        progressStatus: 'diantar',
    });
    assert.equal(phase, 'out_for_delivery');
});
