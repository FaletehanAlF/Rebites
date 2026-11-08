import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_PIE_SLICES, buildVisitorPieSlices, type VisitorDailyPoint, } from '../lib/visitor-chart.ts';
function point(day: string, visitors: number): VisitorDailyPoint {
    return { day, visitors, visits: visitors * 2 };
}
test('hari kosong dilewati, bukan digambar selebar nol', () => {
    assert.deepEqual(buildVisitorPieSlices([]), []);
    assert.deepEqual(buildVisitorPieSlices([point('2026-11-01', 0), point('2026-11-02', 0)]), []);
    assert.deepEqual(buildVisitorPieSlices([{ day: 'x', visitors: Number.NaN, visits: 0 }]), []);
});
test('tanpa perlu digabung: satu irisan per hari, urut terbesar', () => {
    const slices = buildVisitorPieSlices([
        point('2026-11-01', 4),
        point('2026-11-02', 9),
        point('2026-11-03', 6),
    ]);
    assert.deepEqual(slices.map((s) => [s.key, s.visitors, s.days, s.aggregated]), [
        ['2026-11-02', 9, 1, false],
        ['2026-11-03', 6, 1, false],
        ['2026-11-01', 4, 1, false],
    ]);
});
test('lebih dari batas: hari terkecil digabung, total tidak berubah', () => {
    const days: VisitorDailyPoint[] = Array.from({ length: 20 }, (_, index) => point(`2026-11-${String(index + 1).padStart(2, '0')}`, index + 1));
    const total = days.reduce((sum, d) => sum + d.visitors, 0);
    const slices = buildVisitorPieSlices(days);
    assert.equal(slices.length, MAX_PIE_SLICES);
    assert.equal(slices.reduce((sum, s) => sum + s.visitors, 0), total);
    const last = slices[slices.length - 1];
    assert.equal(last.aggregated, true);
    assert.equal(last.key, 'lainnya');
    assert.equal(last.days, 9);
    assert.equal(last.visitors, 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9);
    assert.equal(slices[0].visitors, 20);
    for (let i = 1; i < slices.length - 1; i += 1) {
        assert.ok(slices[i].visitors <= slices[i - 1].visitors);
        assert.equal(slices[i].aggregated, false);
    }
});
test('batas minimal dua irisan dijaga', () => {
    const days = [point('a', 1), point('b', 2), point('c', 3)];
    const slices = buildVisitorPieSlices(days, 1);
    assert.equal(slices.length, 2);
    assert.equal(slices[0].visitors, 3);
    assert.equal(slices[1].aggregated, true);
    assert.equal(slices[1].visitors, 3);
});
