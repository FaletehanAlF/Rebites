import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRouteCacheKey, distanceKmBetween, headingAtProgress, isValidRouteGeometry, pointAtProgress, routePolylineKm, simplifyRoute, straightRoute, tripProgressAt, ROUTE_MAX_POINTS, type RouteCoordinate, } from '../lib/route-geometry.ts';
const EASTWARD: RouteCoordinate[] = [
    [106.8, -6.2],
    [106.81, -6.2],
    [106.82, -6.2],
];
test('geometri: polyline sah hanya bila >= 2 titik dan semua koordinat wajar', () => {
    assert.equal(isValidRouteGeometry(EASTWARD), true);
    assert.equal(isValidRouteGeometry([]), false);
    assert.equal(isValidRouteGeometry([[106.8, -6.2]]), false);
    assert.equal(isValidRouteGeometry(null), false);
    assert.equal(isValidRouteGeometry('bukan array'), false);
    assert.equal(isValidRouteGeometry([[106.8, -6.2], [106.81, null]]), false);
    assert.equal(isValidRouteGeometry([[106.8, -6.2], [106.81, 91]]), false);
    assert.equal(isValidRouteGeometry([[106.8, -6.2], [181, -6.2]]), false);
    assert.equal(isValidRouteGeometry([[106.8, -6.2], ['106.81', -6.2]]), false);
});
test('geometri: panjang polyline = jumlah panjang segmen', () => {
    const total = routePolylineKm(EASTWARD);
    const firstLeg = distanceKmBetween(EASTWARD[0], EASTWARD[1]);
    const secondLeg = distanceKmBetween(EASTWARD[1], EASTWARD[2]);
    assert.ok(Math.abs(total - (firstLeg + secondLeg)) < 1e-9);
    assert.ok(total > 0);
    assert.equal(routePolylineKm([]), 0);
    assert.equal(routePolylineKm([[106.8, -6.2]]), 0);
});
test('geometri: posisi pada progres mengikuti PANJANG segmen, bukan indeks titik', () => {
    const mid = pointAtProgress(EASTWARD, 0.5);
    assert.ok(mid);
    assert.ok(Math.abs(mid![0] - 106.81) < 1e-9, `lng tengah salah: ${mid![0]}`);
    assert.ok(Math.abs(mid![1] - -6.2) < 1e-9);
    assert.deepEqual(pointAtProgress(EASTWARD, 0), EASTWARD[0]);
    assert.deepEqual(pointAtProgress(EASTWARD, 1), EASTWARD[2]);
});
test('geometri: progres di luar 0..1 dijepit, bukan menghasilkan titik liar', () => {
    assert.deepEqual(pointAtProgress(EASTWARD, -5), EASTWARD[0]);
    assert.deepEqual(pointAtProgress(EASTWARD, 99), EASTWARD[2]);
    assert.deepEqual(pointAtProgress(EASTWARD, Number.NaN), EASTWARD[0]);
});
test('geometri: segmen panjang & pendek dilalui dengan kecepatan sama', () => {
    const uneven: RouteCoordinate[] = [
        [106.8, -6.2],
        [106.81, -6.2],
        [106.83, -6.2],
    ];
    const half = pointAtProgress(uneven, 0.5);
    assert.ok(half);
    assert.ok(half![0] > 106.81, `titik tengah ${half![0]} seharusnya masuk segmen kedua`);
});
test('geometri: arah hadap mengikuti arah jalan', () => {
    const east = headingAtProgress(EASTWARD, 0.3);
    assert.ok(Math.abs(east - 90) < 1, `arah ke timur seharusnya ~90, dapat ${east}`);
    const northward: RouteCoordinate[] = [
        [106.8, -6.2],
        [106.8, -6.1],
    ];
    const north = headingAtProgress(northward, 0.5);
    assert.ok(north < 1 || north > 359, `arah ke utara seharusnya ~0, dapat ${north}`);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const deg = headingAtProgress(EASTWARD, t);
        assert.ok(deg >= 0 && deg < 360, `arah ${deg} di luar rentang`);
    }
    assert.equal(headingAtProgress([], 0.5), 0);
    assert.equal(headingAtProgress([[106.8, -6.2]], 0.5), 0);
});
test('geometri: simplify mempertahankan ujung-ujung rute', () => {
    const long: RouteCoordinate[] = [];
    for (let i = 0; i < 2000; i += 1)
        long.push([106.8 + i * 0.0001, -6.2]);
    const simplified = simplifyRoute(long, 100);
    assert.equal(simplified.length, 100);
    assert.deepEqual(simplified[0], long[0]);
    assert.deepEqual(simplified[simplified.length - 1], long[long.length - 1]);
    assert.equal(simplifyRoute(EASTWARD, ROUTE_MAX_POINTS).length, EASTWARD.length);
});
test('geometri: perjalanan ilustratif hanya MAJU, tidak pernah mundur', () => {
    const DUR = 40000;
    assert.equal(tripProgressAt(0, DUR), 0);
    assert.equal(tripProgressAt(DUR / 2, DUR), 0.5);
    assert.equal(tripProgressAt(DUR, DUR), 1);
    assert.equal(tripProgressAt(DUR * 3, DUR), 1);
    let prev = -1;
    for (let ms = 0; ms <= DUR * 2; ms += 250) {
        const t = tripProgressAt(ms, DUR);
        assert.ok(t >= prev, `progres menurun di ${ms} ms: ${t} < ${prev}`);
        assert.ok(t >= 0 && t <= 1, `progres di luar 0..1: ${t}`);
        prev = t;
    }
    assert.equal(tripProgressAt(Number.NaN, DUR), 0);
    assert.equal(tripProgressAt(-100, DUR), 0);
    assert.equal(tripProgressAt(1000, 0), 0);
    assert.equal(tripProgressAt(1000, Number.NaN), 0);
});
test('geometri: cache key stabil & membedakan arah', () => {
    const a = { latitude: -6.2, longitude: 106.8 };
    const b = { latitude: -6.24, longitude: 106.82 };
    assert.equal(buildRouteCacheKey(a, b), buildRouteCacheKey(a, b));
    assert.notEqual(buildRouteCacheKey(a, b), buildRouteCacheKey(b, a));
    assert.equal(buildRouteCacheKey(a, b), buildRouteCacheKey({ latitude: -6.2000001, longitude: 106.8000001 }, b));
});
test('geometri: rute cadangan berupa garis lurus dua titik', () => {
    const origin = { latitude: -6.2, longitude: 106.8 };
    const destination = { latitude: -6.24, longitude: 106.82 };
    const straight = straightRoute(origin, destination);
    assert.equal(straight.length, 2);
    assert.deepEqual(straight[0], [106.8, -6.2]);
    assert.deepEqual(straight[1], [106.82, -6.24]);
    assert.equal(isValidRouteGeometry(straight), true);
});
