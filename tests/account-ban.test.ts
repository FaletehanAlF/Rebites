import test from 'node:test';
import assert from 'node:assert/strict';
import { LIFT_BAN_DURATION, PERMANENT_BAN_DURATION, activeSanctionEnds, computeBanDuration, } from '../lib/server/account-ban.ts';
const NOW = Date.parse('2026-11-05T03:00:00.000Z');
function hoursFromNow(hours: number): string {
    return new Date(NOW + hours * 3600000).toISOString();
}
test('tanpa sanksi aktif, ban dicabut', () => {
    assert.equal(computeBanDuration([], NOW), LIFT_BAN_DURATION);
    assert.equal(computeBanDuration([], NOW), 'none');
});
test('sanksi permanen (end_at null) menjadi ban ~100 tahun', () => {
    assert.equal(computeBanDuration([null], NOW), PERMANENT_BAN_DURATION);
    assert.equal(computeBanDuration([hoursFromNow(2), null], NOW), PERMANENT_BAN_DURATION);
});
test('durasi ban selalu berakhir SEBELUM end_at sanksi', () => {
    assert.equal(computeBanDuration([hoursFromNow(2)], NOW), '1h59m');
    assert.equal(computeBanDuration([hoursFromNow(1)], NOW), '59m');
    assert.equal(computeBanDuration([hoursFromNow(0.5)], NOW), '29m');
    assert.equal(computeBanDuration([new Date(NOW + 30000).toISOString()], NOW), '1s');
    assert.equal(computeBanDuration([new Date(NOW + 90000).toISOString()], NOW), '30s');
});
test('durasi tidak pernah menjadi "none" selama masih ada sanksi aktif', () => {
    for (const secs of [1, 2, 30, 59, 60, 90, 120, 3599, 3600, 7200, 86400]) {
        const out = computeBanDuration([new Date(NOW + secs * 1000).toISOString()], NOW);
        assert.notEqual(out, LIFT_BAN_DURATION, `sanksi ${secs} dtk harus tetap ber-ban`);
        assert.notEqual(out, '0s', `sanksi ${secs} dtk tidak boleh jadi durasi 0`);
    }
});
test('sanksi terbesar yang menentukan durasi ban', () => {
    assert.equal(computeBanDuration([hoursFromNow(2), hoursFromNow(50)], NOW), '49h59m');
    assert.equal(computeBanDuration([hoursFromNow(50), hoursFromNow(2)], NOW), '49h59m');
});
test('end_at yang tidak terbaca diperlakukan permanen (fail-closed)', () => {
    assert.equal(computeBanDuration(['bukan-tanggal'], NOW), PERMANENT_BAN_DURATION);
    assert.equal(computeBanDuration([undefined], NOW), PERMANENT_BAN_DURATION);
});
test('hanya sanksi yang masih berlaku ikut dihitung', () => {
    const rows = [
        { end_at: null },
        { end_at: hoursFromNow(3) },
        { end_at: new Date(NOW - 3600000).toISOString() },
    ];
    assert.deepEqual(activeSanctionEnds(rows, NOW), [null, hoursFromNow(3)]);
    assert.deepEqual(activeSanctionEnds([{ end_at: new Date(NOW - 1).toISOString() }], NOW), []);
});
test('baris sanksi yang tidak terbaca diperlakukan permanen (fail-closed)', () => {
    assert.deepEqual(activeSanctionEnds([{ end_at: 'bukan-tanggal' }], NOW), [null]);
    assert.deepEqual(activeSanctionEnds([{ end_at: 12345 }], NOW), [null]);
    assert.deepEqual(activeSanctionEnds([{}], NOW), [null]);
    assert.equal(computeBanDuration(activeSanctionEnds([{}], NOW), NOW), PERMANENT_BAN_DURATION);
});
