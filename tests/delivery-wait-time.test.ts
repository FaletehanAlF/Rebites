import test from 'node:test';
import assert from 'node:assert/strict';
import { formatElapsedSince, resolveWaitSince, } from '../lib/delivery-wait-time.ts';
const T0 = Date.parse('2026-10-31T08:00:00Z');
const MENIT = 60000;
const JAM = 60 * MENIT;
const HARI = 24 * JAM;
test('kurang dari satu menit', () => {
    assert.equal(formatElapsedSince('2026-10-31T08:00:00Z', T0 + 30000), 'kurang dari 1 menit');
});
test('menit bulat tanpa pecahan', () => {
    assert.equal(formatElapsedSince('2026-10-31T08:00:00Z', T0 + 12 * MENIT + 30000), '12 menit');
});
test('satu jam tanpa menit sisa', () => {
    assert.equal(formatElapsedSince('2026-10-31T08:00:00Z', T0 + JAM), '1 jam');
});
test('jam dan menit sisa', () => {
    assert.equal(formatElapsedSince('2026-10-31T08:00:00Z', T0 + JAM + 5 * MENIT), '1 jam 5 menit');
});
test('satu hari tanpa jam sisa', () => {
    assert.equal(formatElapsedSince('2026-10-31T08:00:00Z', T0 + HARI), '1 hari');
});
test('hari dan jam sisa', () => {
    assert.equal(formatElapsedSince('2026-10-31T08:00:00Z', T0 + HARI + 2 * JAM), '1 hari 2 jam');
});
test('titik awal kosong -> null, bukan 0 menit', () => {
    assert.equal(formatElapsedSince(null, T0), null);
    assert.equal(formatElapsedSince(undefined, T0), null);
    assert.equal(formatElapsedSince('', T0), null);
});
test('titik awal tidak valid -> null', () => {
    assert.equal(formatElapsedSince('bukan-tanggal', T0), null);
});
test('waktu di masa depan -> null', () => {
    assert.equal(formatElapsedSince('2026-10-31T09:00:00Z', T0), null);
});
test('resolveWaitSince memakai perubahan status terakhir', () => {
    const since = resolveWaitSince({ orderStatus: 'out_for_delivery', createdAt: '2026-10-31T07:00:00Z' }, '2026-10-31T08:00:00Z');
    assert.equal(since, '2026-10-31T08:00:00Z');
});
test('resolveWaitSince jatuh ke waktu pesanan dibuat bila status belum berubah', () => {
    const since = resolveWaitSince({ orderStatus: 'paid', createdAt: '2026-10-31T07:00:00Z' }, null);
    assert.equal(since, '2026-10-31T07:00:00Z');
});
test('resolveWaitSince null untuk pesanan selesai', () => {
    const since = resolveWaitSince({ orderStatus: 'completed', createdAt: '2026-10-31T07:00:00Z' }, '2026-10-31T08:00:00Z');
    assert.equal(since, null);
});
test('resolveWaitSince null untuk pesanan dibatalkan', () => {
    for (const status of ['cancelled', 'refunded', 'failed']) {
        const since = resolveWaitSince({ orderStatus: status, createdAt: '2026-10-31T07:00:00Z' }, '2026-10-31T08:00:00Z');
        assert.equal(since, null, `status ${status} tidak boleh menunggu`);
    }
});
test('resolveWaitSince null untuk pesanan dengan createdAt kosong', () => {
    const since = resolveWaitSince({ orderStatus: 'paid', createdAt: '' }, null);
    assert.equal(since, null);
});
