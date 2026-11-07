import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTimelineTimes, STATUS_TO_STEPS, type OrderStatusHistoryEntry, } from '../lib/order-timeline-steps.ts';
function entri(status: string, at: string): OrderStatusHistoryEntry {
    return { status, at, note: null };
}
test('tahap pembayaran menampilkan waktu dari riwayat', () => {
    const times = buildTimelineTimes({}, [entri('paid', '2026-10-31T08:00:00Z')]);
    assert.equal(times.confirmed, '2026-10-31T08:00:00Z');
});
test('satu status out_for_delivery menyalakan tiga tahap', () => {
    const times = buildTimelineTimes({}, [entri('out_for_delivery', '2026-10-31T09:00:00Z')]);
    assert.equal(times.confirmed, '2026-10-31T09:00:00Z');
    assert.equal(times.prepared, '2026-10-31T09:00:00Z');
    assert.equal(times['on-the-way'], '2026-10-31T09:00:00Z');
});
test('tahap tanpa entri riwayat tetap null, tidak dikarang', () => {
    const times = buildTimelineTimes({}, [entri('paid', '2026-10-31T08:00:00Z')]);
    assert.equal(times.prepared, undefined);
    assert.equal(times.completed, undefined);
    assert.equal(times['on-the-way'], undefined);
});
test('entri paling awal menang untuk satu tahap', () => {
    const times = buildTimelineTimes({}, [entri('paid', '2026-10-31T08:00:00Z'), entri('paid', '2026-10-31T20:00:00Z')]);
    assert.equal(times.confirmed, '2026-10-31T08:00:00Z');
});
test('entri tanpa timestamp diabaikan', () => {
    const times = buildTimelineTimes({}, [{ status: 'paid', at: null, note: null }]);
    assert.equal(times.confirmed, undefined);
});
test('fallback completedAt dipakai saat riwayat kosong', () => {
    const times = buildTimelineTimes({ completedAt: '2026-10-31T10:00:00Z' }, []);
    assert.equal(times.completed, '2026-10-31T10:00:00Z');
});
test('fallback deliveryStartedAt dipakai saat riwayat kosong', () => {
    const times = buildTimelineTimes({ deliveryStartedAt: '2026-10-31T09:30:00Z' }, []);
    assert.equal(times['on-the-way'], '2026-10-31T09:30:00Z');
});
test('riwayat lebih diprioritaskan daripada fallback baris pesanan', () => {
    const times = buildTimelineTimes({ completedAt: '2026-10-31T23:00:00Z' }, [entri('completed', '2026-10-31T11:00:00Z')]);
    assert.equal(times.completed, '2026-10-31T11:00:00Z');
});
test('status dibatalkan menghasilkan tahap cancelled', () => {
    const times = buildTimelineTimes({}, [entri('cancelled', '2026-10-31T12:00:00Z')]);
    assert.equal(times.cancelled, '2026-10-31T12:00:00Z');
});
test('status tak dikenal tidak merusak pemetaan', () => {
    const times = buildTimelineTimes({}, [entri('entah-apa', '2026-10-31T12:00:00Z')]);
    assert.equal(Object.keys(times).length, 0);
});
test('setiap status dikenal punya pemetaan tahap', () => {
    const statusTerdaftar = [
        'paid',
        'processing',
        'preparing',
        'ready',
        'ready_for_pickup',
        'out_for_delivery',
        'completed',
        'cancelled',
        'refunded',
        'failed',
    ];
    for (const status of statusTerdaftar) {
        assert.ok(STATUS_TO_STEPS[status], `status "${status}" harus punya pemetaan tahap`);
    }
});
test('status paid menyalakan hanya tahap confirmed', () => {
    assert.deepEqual(STATUS_TO_STEPS.paid, ['confirmed']);
});
