import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { needsSellerAction, resolveOrderPhase } from '../lib/order-status-source.ts';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
const PAGE = readProjectFile('app/(app)/dashboard/penjual/[storeId]/pesanan/page.tsx');
const PAGE_CODE = PAGE.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\{\s*\}/g, '');
const TOPBAR = readProjectFile('app/components/dashboard-penjual/Topbar.tsx');
test('pesanan dibayar dan disiapkan dihitung butuh aksi penjual', () => {
    assert.equal(needsSellerAction('paid'), true);
    assert.equal(needsSellerAction('processing'), true);
});
test('pesanan yang belum dibayar bukan beban penjual', () => {
    assert.equal(needsSellerAction('pending'), false);
    assert.equal(needsSellerAction('cancelled'), false);
    assert.equal(needsSellerAction('completed'), false);
    assert.equal(needsSellerAction('out_for_delivery'), false);
    assert.equal(needsSellerAction('ready_for_pickup'), false);
});
test('penanda memakai fase yang sama dengan sumber status pesanan', () => {
    const paidPhase = resolveOrderPhase({ status: 'ongoing', orderStatus: 'paid' });
    const processingPhase = resolveOrderPhase({ status: 'ongoing', orderStatus: 'processing' });
    const pendingPhase = resolveOrderPhase({ status: 'ongoing', orderStatus: 'pending' });
    assert.equal(needsSellerAction(paidPhase), true);
    assert.equal(needsSellerAction(processingPhase), true);
    assert.equal(needsSellerAction(pendingPhase), false);
});
test('lonceng penjual menyegarkan hitungan saat ada perubahan pesanan', () => {
    assert.match(TOPBAR, /ORDERS_UPDATED_EVENT/);
    assert.match(TOPBAR, /addEventListener\(ORDERS_UPDATED_EVENT/);
    assert.match(TOPBAR, /removeEventListener\(ORDERS_UPDATED_EVENT/);
});
test('kartu pesanan menampilkan tanda butuh aksi dan garis tegas', () => {
    assert.match(PAGE_CODE, /const waitingForSeller = isOngoing && needsSellerAction\(phase\)/);
    assert.match(PAGE_CODE, /Butuh aksi/);
    assert.match(PAGE_CODE, /waitingForSeller \? 'border-destructive\/40'/);
});
test('ada tab Butuh Aksi yang menghitung pesanan menunggu', () => {
    assert.match(PAGE_CODE, /value: 'butuh-aksi' as const/);
    assert.match(PAGE_CODE, /tab === 'butuh-aksi'/);
    assert.match(PAGE_CODE, /waitingOrders\.filter|ongoing\.filter\(\(order\) => needsSellerAction/);
});
test('posisi kurir tampil lewat peta, bukan chat pribadi', () => {
    assert.doesNotMatch(PAGE_CODE, /CourierChat/);
    assert.doesNotMatch(PAGE_CODE, /Chat Kurir/);
    assert.match(PAGE_CODE, /<DeliveryMap/);
    assert.match(PAGE_CODE, /courierPosition=\{/);
    assert.match(PAGE_CODE, /useCourierLocation\(/);
});
test('peta dan panel posisi hanya muncul saat pesanan benar-benar diantar', () => {
    assert.match(PAGE_CODE, /const courierToolsActive =\s*order\.fulfillment === 'delivery' && phase === 'out_for_delivery'/);
    assert.match(PAGE_CODE, /\{courierToolsActive && \(/);
    assert.match(PAGE_CODE, /<CourierPositionPanel location=\{courierLocation\} freshness=\{courierFreshness\}\/>/);
});
