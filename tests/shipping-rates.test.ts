import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildBiteshipRateItem, buildBiteshipRatesPayload, classifyBiteshipRatesError, } from '../lib/server/biteship.ts';
import { buildAddressRateSignature } from '../lib/location-validation.ts';
import { calculateDeliveryFee } from '../lib/shipping-tariff.ts';
const BASE_ITEM = {
    name: 'Nasi Goreng Surplus',
    unitValue: 15000,
    quantity: 3,
    weightGram: 500,
};
function basePayloadInput() {
    return {
        originPostalCode: 16424,
        destinationPostalCode: 16411,
        couriers: ['grab'],
        items: [buildBiteshipRateItem(BASE_ITEM)],
    };
}
test('item rates: berat per unit + quantity (tanpa perkalian ganda / konversi kg)', () => {
    const item = buildBiteshipRateItem({ ...BASE_ITEM, unitValue: 15000.6 });
    assert.equal(item.weight, 500);
    assert.equal(item.quantity, 3);
    assert.equal(item.value, 15001);
    assert.equal(item.category, 'food_and_drink');
    assert.equal(item.name, 'Nasi Goreng Surplus');
    assert.equal('length' in item, false);
    assert.equal('width' in item, false);
    assert.equal('height' in item, false);
});
test('item rates: dimensi hanya bila angka positif (0/negatif/NaN/teks kosong diabaikan)', () => {
    const item = buildBiteshipRateItem({
        ...BASE_ITEM,
        lengthCm: 20.9,
        widthCm: 0,
        heightCm: -5,
    });
    assert.equal(item.length, 20);
    assert.equal('width' in item, false);
    assert.equal('height' in item, false);
    const second = buildBiteshipRateItem({
        ...BASE_ITEM,
        lengthCm: '15',
        widthCm: null,
        heightCm: undefined,
    });
    assert.equal(second.length, 15);
    assert.equal('width' in second, false);
    assert.equal('height' in second, false);
});
test('payload rates: postal-only bila koordinat tidak tersedia (perilaku lama utuh)', () => {
    const payload = buildBiteshipRatesPayload({
        ...basePayloadInput(),
        originCoordinates: { latitude: null, longitude: null },
        destinationCoordinates: {},
    });
    assert.equal(payload.origin_postal_code, 16424);
    assert.equal(payload.destination_postal_code, 16411);
    assert.equal(payload.couriers, 'grab');
    assert.equal(payload.items.length, 1);
    assert.equal('origin_latitude' in payload, false);
    assert.equal('origin_longitude' in payload, false);
    assert.equal('destination_latitude' in payload, false);
    assert.equal('destination_longitude' in payload, false);
});
test('payload rates: koordinat valid ikut dikirim (angka & string), per sisi', () => {
    const payload = buildBiteshipRatesPayload({
        ...basePayloadInput(),
        originCoordinates: { latitude: '-6.38', longitude: '106.83' },
        destinationCoordinates: { latitude: -6.2, longitude: 106.8 },
    });
    assert.equal(payload.origin_latitude, -6.38);
    assert.equal(payload.origin_longitude, 106.83);
    assert.equal(payload.destination_latitude, -6.2);
    assert.equal(payload.destination_longitude, 106.8);
});
test('payload rates: koordinat di luar rentang / setengah pasangan / bukan angka TIDAK dikirim', () => {
    const outOfRange = buildBiteshipRatesPayload({
        ...basePayloadInput(),
        originCoordinates: { latitude: 91, longitude: 106.8 },
        destinationCoordinates: { latitude: -6.2, longitude: 181 },
    });
    assert.equal('origin_latitude' in outOfRange, false);
    assert.equal('destination_latitude' in outOfRange, false);
    const halfPair = buildBiteshipRatesPayload({
        ...basePayloadInput(),
        originCoordinates: { latitude: -6.2, longitude: null },
    });
    assert.equal('origin_latitude' in halfPair, false);
    const junk = buildBiteshipRatesPayload({
        ...basePayloadInput(),
        originCoordinates: { latitude: 'abc', longitude: 106.8 },
    });
    assert.equal('origin_latitude' in junk, false);
    const mixed = buildBiteshipRatesPayload({
        ...basePayloadInput(),
        originCoordinates: { latitude: -6.2, longitude: 106.8 },
        destinationCoordinates: { latitude: 91, longitude: 106.8 },
    });
    assert.equal(mixed.origin_latitude, -6.2);
    assert.equal(mixed.origin_longitude, 106.8);
    assert.equal('destination_latitude' in mixed, false);
});
test('classify error: pesan saldo Biteship -> provider_balance + pesan Indonesia (mentah tidak diteruskan)', () => {
    const exact = classifyBiteshipRatesError('No sufficient balance to call rates API. Please top up your balance');
    assert.equal(exact?.code, 'provider_balance');
    assert.ok(exact?.message.includes('saldo'));
    assert.doesNotMatch(exact?.message ?? '', /sufficient balance|top up/i);
    assert.equal(classifyBiteshipRatesError('Insufficient balance')?.code, 'provider_balance');
    assert.equal(classifyBiteshipRatesError('Please top up your balance')?.code, 'provider_balance');
});
test('classify error: kuota/rate limit -> provider_quota; pesan lain -> null (passthrough apa adanya)', () => {
    assert.equal(classifyBiteshipRatesError('Too Many Requests')?.code, 'provider_quota');
    assert.equal(classifyBiteshipRatesError('Rate limit exceeded')?.code, 'provider_quota');
    assert.equal(classifyBiteshipRatesError('Courier grab is not available'), null);
    assert.equal(classifyBiteshipRatesError(''), null);
});
test('ongkir: dibatasi plafon walau jarak sangat jauh, dan tidak pernah di bawah minimum', () => {
    for (const km of [0, 1, 5, 12, 40, 200]) {
        const fee = calculateDeliveryFee(km);
        assert.ok(fee >= 3000, `ongkir ${km} km tidak boleh di bawah minimum 3000: ${fee}`);
        assert.ok(fee <= 10000, `ongkir ${km} km harus <= plafon 10000, dapat ${fee}`);
        assert.equal(fee % 100, 0, 'ongkir dibulatkan ratusan rupiah');
    }
});
test('ongkir: naik seiring jarak (bukan nilai tetap) sampai menyentuh plafon', () => {
    const near = calculateDeliveryFee(1);
    const mid = calculateDeliveryFee(4);
    assert.ok(mid > near, 'jarak lebih jauh harus lebih mahal sebelum plafon');
    assert.equal(calculateDeliveryFee(40), 10000);
    assert.equal(calculateDeliveryFee(200), 10000);
    assert.ok(calculateDeliveryFee(1000) <= 10000);
});
test('route rates & checkout memakai helper bersama dan tidak menyentuh API key', () => {
    const ratesSrc = readFileSync(new URL('../app/api/shipping/rates/route.ts', import.meta.url), 'utf8');
    const checkoutSrc = readFileSync(new URL('../app/api/checkout/xendit/route.ts', import.meta.url), 'utf8');
    for (const src of [ratesSrc, checkoutSrc]) {
        assert.match(src, /shipping-tariff/);
        assert.doesNotMatch(src, /BITESHIP_API_KEY/);
        assert.doesNotMatch(src, /NEXT_PUBLIC_BITESHIP/);
        assert.doesNotMatch(src, /getBiteshipRates/);
    }
});
test('signature alamat (Tahap 3): berubah saat field penentu tarif berubah, stabil saat sama', () => {
    const base = { postalCode: '16424', latitude: -6.2, longitude: 106.8 };
    const sBase = buildAddressRateSignature(base);
    assert.equal(sBase, buildAddressRateSignature({ ...base }));
    assert.notEqual(sBase, buildAddressRateSignature({ ...base, postalCode: '16411' }));
    assert.notEqual(sBase, buildAddressRateSignature({ ...base, latitude: -6.3 }));
    assert.notEqual(sBase, buildAddressRateSignature({ ...base, longitude: 106.9 }));
    assert.notEqual(sBase, buildAddressRateSignature({ ...base, latitude: null, longitude: null }));
    assert.equal(sBase, buildAddressRateSignature({ ...base, postalCode: ' 16424 ' }));
    assert.equal(buildAddressRateSignature(null), '');
    assert.equal(buildAddressRateSignature(undefined), '');
    assert.equal(buildAddressRateSignature({ postalCode: null, latitude: Number.NaN, longitude: Infinity }), '||');
});
