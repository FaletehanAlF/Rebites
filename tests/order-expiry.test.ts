import test from 'node:test';
import assert from 'node:assert/strict';
import { IN_FLIGHT_STATUSES, shouldAutoComplete, } from '../lib/order-expiry.ts';
const NOW = Date.parse('2026-10-31T12:00:00Z');
const EARLIER = new Date(NOW - 10 * 60000).toISOString();
const LATER = new Date(NOW + 10 * 60000).toISOString();
test('diantar + tenggat lewat -> boleh selesai otomatis', () => {
    assert.equal(shouldAutoComplete({ status: 'ongoing', orderStatus: 'out_for_delivery', estimatedCompletionAt: EARLIER }, NOW), true);
});
test('siap diambil + tenggat lewat -> boleh selesai otomatis', () => {
    assert.equal(shouldAutoComplete({ status: 'ongoing', orderStatus: 'ready_for_pickup', estimatedCompletionAt: EARLIER }, NOW), true);
});
test('tenggat belum lewat -> TIDAK selesai', () => {
    assert.equal(shouldAutoComplete({ status: 'ongoing', orderStatus: 'out_for_delivery', estimatedCompletionAt: LATER }, NOW), false);
});
test('pesanan yang belum pernah dimajukan TIDAK selesai otomatis', () => {
    for (const status of ['pending', 'paid', 'processing', 'preparing']) {
        assert.equal(shouldAutoComplete({ status: 'ongoing', orderStatus: status, estimatedCompletionAt: EARLIER }, NOW), false, `status ${status} tidak boleh selesai otomatis`);
    }
});
test('tanpa tenggat -> TIDAK selesai (tidak ada dasar)', () => {
    assert.equal(shouldAutoComplete({ status: 'ongoing', orderStatus: 'out_for_delivery', estimatedCompletionAt: null }, NOW), false);
    assert.equal(shouldAutoComplete({ status: 'ongoing', orderStatus: 'out_for_delivery' }, NOW), false);
});
test('tenggat tidak valid -> TIDAK selesai', () => {
    assert.equal(shouldAutoComplete({ status: 'ongoing', orderStatus: 'out_for_delivery', estimatedCompletionAt: 'bukan-tanggal' }, NOW), false);
});
test('pesanan sudah selesai/dibatalkan tidak diproses lagi', () => {
    assert.equal(shouldAutoComplete({ status: 'completed', orderStatus: 'out_for_delivery', estimatedCompletionAt: EARLIER }, NOW), false);
    assert.equal(shouldAutoComplete({ status: 'ongoing', orderStatus: 'cancelled', estimatedCompletionAt: EARLIER }, NOW), false);
});
test('status di luar daftar in-flight ditolak', () => {
    assert.deepEqual([...IN_FLIGHT_STATUSES], ['out_for_delivery', 'ready_for_pickup']);
});
test('tenggat tepat sama dengan sekarang dianggap lewat', () => {
    assert.equal(shouldAutoComplete({
        status: 'ongoing',
        orderStatus: 'out_for_delivery',
        estimatedCompletionAt: new Date(NOW).toISOString(),
    }, NOW), true);
});
