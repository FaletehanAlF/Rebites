import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDeliveryFee, estimateRoadDistanceKm, getDeliveryTariffConfig, haversineKm, isValidCoordinatePair, ROAD_FACTOR, } from '../lib/shipping-tariff.ts';
import { calculateTravelMinutes, estimateOrderMinutes, getVendorPreparationMinutes, COURIER_AVG_SPEED_KM_PER_HOUR, HANDOVER_MINUTES, MAX_TRAVEL_MINUTES, } from '../lib/delivery-estimate.ts';
test('koordinat: null/undefined/string kosong TIDAK sah (Number(null) === 0 jebakan)', () => {
    assert.equal(isValidCoordinatePair(null, null), false);
    assert.equal(isValidCoordinatePair(undefined, undefined), false);
    assert.equal(isValidCoordinatePair('', ''), false);
    assert.equal(isValidCoordinatePair('  ', '  '), false);
    assert.equal(isValidCoordinatePair(-6.2, null), false);
    assert.equal(isValidCoordinatePair(null, 106.8), false);
});
test('koordinat: (0,0) adalah Null Island, bukan lokasi nyata', () => {
    assert.equal(isValidCoordinatePair(0, 0), false);
    assert.equal(isValidCoordinatePair('0', '0'), false);
    assert.equal(isValidCoordinatePair(0, 106.8), true);
    assert.equal(isValidCoordinatePair(-6.2, 0), true);
});
test('koordinat: nilai sah diterima, di luar rentang / bukan angka ditolak', () => {
    assert.equal(isValidCoordinatePair(-6.3862, 106.869579), true);
    assert.equal(isValidCoordinatePair('-6.38', '106.87'), true);
    assert.equal(isValidCoordinatePair(91, 106.8), false);
    assert.equal(isValidCoordinatePair(-6.2, 181), false);
    assert.equal(isValidCoordinatePair('abc', 106.8), false);
    assert.equal(isValidCoordinatePair(Number.NaN, 106.8), false);
    assert.equal(isValidCoordinatePair(Infinity, 106.8), false);
});
test('tarif: ongkir terjangkau untuk makanan surplus (plafon 10.000)', () => {
    const cfg = getDeliveryTariffConfig();
    assert.equal(cfg.baseFee, 3000);
    assert.equal(cfg.perKmFee, 1000);
    assert.equal(cfg.minFee, 3000);
    assert.equal(cfg.maxFee, 10000);
});
test('tarif: naik seiring jarak, lalu berhenti di plafon (tidak pernah melebihi)', () => {
    const near = calculateDeliveryFee(1);
    const mid = calculateDeliveryFee(4);
    const far = calculateDeliveryFee(9);
    assert.ok(mid > near, `4 km harus lebih mahal dari 1 km (${mid} vs ${near})`);
    assert.ok(far > mid, `9 km harus lebih mahal dari 4 km (${far} vs ${mid})`);
    assert.equal(calculateDeliveryFee(40), 10000);
    assert.equal(calculateDeliveryFee(200), 10000);
    for (const km of [0, 0.3, 1, 3, 5, 7, 12, 40, 200]) {
        const fee = calculateDeliveryFee(km);
        assert.equal(fee % 100, 0, `ongkir ${km} km tidak bulat: ${fee}`);
        assert.ok(fee >= 3000, `ongkir ${km} km di bawah minimum: ${fee}`);
        assert.ok(fee <= 10000, `ongkir ${km} km melebihi plafon: ${fee}`);
    }
});
test('tarif: ongkir tetap lebih murah dari harga makanan surplus biasa', () => {
    assert.ok(calculateDeliveryFee(200) <= 10000);
    assert.ok(calculateDeliveryFee(5) <= 9000);
});
test('tarif: ROAD_FACTOR tetap dipakai, dan jarak tidak sah menghasilkan 0', () => {
    assert.equal(ROAD_FACTOR, 1.3);
    assert.equal(estimateRoadDistanceKm(10), 13);
    assert.equal(estimateRoadDistanceKm(0), 0);
    assert.equal(estimateRoadDistanceKm(-5), 0);
    assert.equal(estimateRoadDistanceKm(Number.NaN), 0);
});
test('tarif: jarak (0,0)->Depok tidak lagi menghasilkan plafon', () => {
    assert.equal(isValidCoordinatePair(null, null), false);
    const depok = { latitude: -6.3862, longitude: 106.869579 };
    const nullIsland = { latitude: 0, longitude: 0 };
    const km = haversineKm(depok, nullIsland);
    assert.ok(km > 10000, `jarak ke (0,0) seharusnya ribuan km, dapat ${km}`);
});
test('persiapan: slug bersufiks acak tetap kena (awalan), bukan jatuh ke default', () => {
    assert.equal(getVendorPreparationMinutes('warkop-pak-iman'), 8);
    assert.equal(getVendorPreparationMinutes('warung-nusantara'), 12);
    assert.equal(getVendorPreparationMinutes('dapur-ibu-tini'), 15);
    assert.equal(getVendorPreparationMinutes('dapur-ibu-tini-abc123'), 15);
    assert.equal(getVendorPreparationMinutes('warkop-pak-iman-x9'), 8);
});
test('persiapan: toko tak dikenal memakai default yang wajar untuk makanan siap saji', () => {
    const unknown = getVendorPreparationMinutes('ravora-blkjz');
    assert.equal(unknown, 12);
    assert.equal(getVendorPreparationMinutes(''), 12);
    assert.equal(getVendorPreparationMinutes(undefined), 12);
    assert.equal(getVendorPreparationMinutes(null as unknown as string), 12);
    assert.ok(unknown < 20, `default persiapan masih terlalu lama: ${unknown}`);
});
test('persiapan: nama mirip tetapi bukan awalan utuh tidak ikut cocok', () => {
    assert.equal(getVendorPreparationMinutes('warung-nusantarax'), 12);
    assert.equal(getVendorPreparationMinutes('warung-nusantara-extra'), 12);
});
test('pengantaran: jarak tidak diketahui -> 0 menit (bukan angka karangan)', () => {
    assert.equal(calculateTravelMinutes(0), 0);
    assert.equal(calculateTravelMinutes(-3), 0);
    assert.equal(calculateTravelMinutes(Number.NaN), 0);
    assert.equal(calculateTravelMinutes(Infinity), 0);
});
test('pengantaran: naik seiring jarak, dengan plafon', () => {
    const one = calculateTravelMinutes(1);
    const three = calculateTravelMinutes(3);
    const eight = calculateTravelMinutes(8);
    assert.ok(one > 0, 'jarak 1 km tetap butuh waktu');
    assert.ok(three > one, `${three} harus > ${one}`);
    assert.ok(eight > three, `${eight} harus > ${three}`);
    assert.ok(calculateTravelMinutes(500) <= MAX_TRAVEL_MINUTES);
});
test('pengantaran: memakai kecepatan + serah-terima, bukan angka ajaib', () => {
    const expected = Math.round(HANDOVER_MINUTES + (6 / COURIER_AVG_SPEED_KM_PER_HOUR) * 60);
    assert.equal(calculateTravelMinutes(6), expected);
});
test('pengantaran: jarak jauh tidak pernah menghasilkan puluhan hari', () => {
    const extreme = calculateTravelMinutes(15432);
    assert.ok(extreme <= MAX_TRAVEL_MINUTES, `estimasi ${extreme} menit masih tidak masuk akal`);
    assert.ok(extreme < 1440);
});
test('estimasi: pickup tanpa waktu pengantaran; delivery menjumlahkan keduanya', () => {
    const pickup = estimateOrderMinutes({ fulfillment: 'pickup', distanceKm: 5, vendorSlug: 'ravora-blkjz' });
    assert.equal(pickup.travelMinutes, 0);
    assert.equal(pickup.estimatedMinutes, pickup.preparationMinutes);
    const delivery = estimateOrderMinutes({ fulfillment: 'delivery', distanceKm: 5, vendorSlug: 'ravora-blkjz' });
    assert.ok(delivery.travelMinutes > 0);
    assert.equal(delivery.estimatedMinutes, delivery.preparationMinutes + delivery.travelMinutes);
});
test('estimasi: pesanan dekat selesai dalam hitungan menit, bukan jam', () => {
    const est = estimateOrderMinutes({ fulfillment: 'delivery', distanceKm: 1.5, vendorSlug: 'warkop-pak-iman' });
    assert.ok(est.estimatedMinutes >= 8, `terlalu cepat: ${est.estimatedMinutes}`);
    assert.ok(est.estimatedMinutes <= 30, `masih terlalu lama untuk 1,5 km: ${est.estimatedMinutes}`);
});
