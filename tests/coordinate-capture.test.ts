import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCoordinatePairInput, validateCoordinatePairFields, isValidLatitude, isValidLongitude, } from '../lib/location-validation.ts';
import { requestDeviceLocation } from '../lib/device-location.ts';
import type { DeviceGeolocationLike } from '../lib/device-location.ts';
function fakeGeo(impl: (success: Parameters<DeviceGeolocationLike['getCurrentPosition']>[0], error?: Parameters<DeviceGeolocationLike['getCurrentPosition']>[1], options?: Parameters<DeviceGeolocationLike['getCurrentPosition']>[2]) => void): DeviceGeolocationLike {
    return {
        getCurrentPosition: (success, error, options) => impl(success, error, options),
    };
}
const VALID_POSITION = { coords: { latitude: -6.2, longitude: 106.8 } };
test('parseCoordinatePairInput: kosong dua-duanya -> NULL (bukan 0, bukan karangan)', () => {
    for (const [lat, lng] of [
        ['', ''],
        ['   ', '\t'],
        [null, undefined],
        [undefined, null],
    ] as const) {
        assert.deepEqual(parseCoordinatePairInput(lat, lng), {
            ok: true,
            latitude: null,
            longitude: null,
        });
    }
});
test('parseCoordinatePairInput: pasangan valid (angka & teks, koma desimal)', () => {
    assert.deepEqual(parseCoordinatePairInput('-6.2', '106.8'), {
        ok: true,
        latitude: -6.2,
        longitude: 106.8,
    });
    assert.deepEqual(parseCoordinatePairInput(' -6,2 ', '106,8'), {
        ok: true,
        latitude: -6.2,
        longitude: 106.8,
    });
    assert.deepEqual(parseCoordinatePairInput(-6.2, 106.8), {
        ok: true,
        latitude: -6.2,
        longitude: 106.8,
    });
});
test('parseCoordinatePairInput: setengah pasangan ditolak (tanpa menebak)', () => {
    const latOnly = parseCoordinatePairInput('-6.2', '');
    assert.equal(latOnly.ok, false);
    const lngOnly = parseCoordinatePairInput('', '106.8');
    assert.equal(lngOnly.ok, false);
    if (!latOnly.ok && !lngOnly.ok) {
        assert.match(latOnly.error, /sekaligus/i);
        assert.match(lngOnly.error, /sekaligus/i);
    }
});
test('parseCoordinatePairInput: nilai tidak sah / di luar rentang ditolak', () => {
    assert.equal(parseCoordinatePairInput('abc', '106.8').ok, false);
    assert.equal(parseCoordinatePairInput('-6.2', 'x').ok, false);
    assert.equal(parseCoordinatePairInput('91', '106.8').ok, false);
    assert.equal(parseCoordinatePairInput('-91', '106.8').ok, false);
    assert.equal(parseCoordinatePairInput('-6.2', '181').ok, false);
    assert.equal(parseCoordinatePairInput('-6.2', '-181').ok, false);
    assert.equal(parseCoordinatePairInput('90', '180').ok, true);
    assert.equal(parseCoordinatePairInput('-90', '-180').ok, true);
});
test('parseCoordinatePairInput: hasil selalu lolos validator rentang bersama', () => {
    const parsed = parseCoordinatePairInput('-6,2', '106,8');
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
        assert.equal(isValidLatitude(parsed.latitude as number), true);
        assert.equal(isValidLongitude(parsed.longitude as number), true);
    }
});
test('requestDeviceLocation: sukses -> koordinat perangkat apa adanya', async () => {
    const result = await requestDeviceLocation(fakeGeo((success) => success(VALID_POSITION)));
    assert.deepEqual(result, { ok: true, latitude: -6.2, longitude: 106.8 });
});
test('requestDeviceLocation: nilai perangkat aneh -> unavailable (tidak mengarang)', async () => {
    const nan = await requestDeviceLocation(fakeGeo((success) => success({ coords: { latitude: Number.NaN, longitude: 106.8 } })));
    assert.deepEqual(nan, { ok: false, reason: 'unavailable' });
    const outOfRange = await requestDeviceLocation(fakeGeo((success) => success({ coords: { latitude: 91, longitude: 181 } })));
    assert.deepEqual(outOfRange, { ok: false, reason: 'unavailable' });
    const missing = await requestDeviceLocation(fakeGeo((success) => success({ coords: {} })));
    assert.deepEqual(missing, { ok: false, reason: 'unavailable' });
});
test('requestDeviceLocation: izin ditolak -> denied; error lain -> unavailable', async () => {
    const denied = await requestDeviceLocation(fakeGeo((_success, error) => error?.({ code: 1 })));
    assert.deepEqual(denied, { ok: false, reason: 'denied' });
    for (const err of [{ code: 2 }, { code: 3 }, {}, null]) {
        const unavailable = await requestDeviceLocation(fakeGeo((_success, error) => error?.(err)));
        assert.deepEqual(unavailable, { ok: false, reason: 'unavailable' });
    }
});
test('requestDeviceLocation: tanpa geolocation / gagal sinkron -> unavailable', async () => {
    assert.deepEqual(await requestDeviceLocation(null), {
        ok: false,
        reason: 'unavailable',
    });
    const notAFunction = {
        getCurrentPosition: null,
    } as unknown as DeviceGeolocationLike;
    assert.deepEqual(await requestDeviceLocation(notAFunction), {
        ok: false,
        reason: 'unavailable',
    });
    const throwing = fakeGeo(() => {
        throw new Error('blocked');
    });
    assert.deepEqual(await requestDeviceLocation(throwing), {
        ok: false,
        reason: 'unavailable',
    });
});
test('requestDeviceLocation: opsi aman (tanpa high accuracy, timeout 10 dtk)', async () => {
    let seen: unknown;
    const result = await requestDeviceLocation(fakeGeo((success, _error, options) => {
        seen = options;
        success(VALID_POSITION);
    }));
    assert.equal(result.ok, true);
    assert.deepEqual(seen, {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
    });
});
test('requestDeviceLocation: tanpa argumen & tanpa browser -> unavailable (bukan throw)', async () => {
    const result = await requestDeviceLocation();
    assert.deepEqual(result, { ok: false, reason: 'unavailable' });
});
test('validateCoordinatePairFields: dua-duanya tidak dikirim -> tidak ada perubahan', () => {
    assert.deepEqual(validateCoordinatePairFields(undefined, undefined), {
        ok: true,
        provided: false,
    });
});
test('validateCoordinatePairFields: dua-duanya kosong -> NULL (menghapus koordinat)', () => {
    for (const [lat, lng] of [
        [null, null],
        ['', ''],
        ['   ', '\t'],
        [null, ''],
        ['', null],
    ] as const) {
        assert.deepEqual(validateCoordinatePairFields(lat, lng), {
            ok: true,
            provided: true,
            latitude: null,
            longitude: null,
        });
    }
});
test('validateCoordinatePairFields: pasangan lengkap valid diterima (angka, teks, batas rentang)', () => {
    assert.deepEqual(validateCoordinatePairFields(-6.2, 106.8), {
        ok: true,
        provided: true,
        latitude: -6.2,
        longitude: 106.8,
    });
    assert.deepEqual(validateCoordinatePairFields('-6.2', ' 106.8 '), {
        ok: true,
        provided: true,
        latitude: -6.2,
        longitude: 106.8,
    });
    assert.deepEqual(validateCoordinatePairFields(-90, -180), {
        ok: true,
        provided: true,
        latitude: -90,
        longitude: -180,
    });
    assert.deepEqual(validateCoordinatePairFields(90, 180), {
        ok: true,
        provided: true,
        latitude: 90,
        longitude: 180,
    });
});
test('validateCoordinatePairFields: setengah pasangan ditolak (lat terisi, lng kosong)', () => {
    for (const [lat, lng] of [
        [-6.2, null],
        [-6.2, ''],
        [-6.2, undefined],
    ] as const) {
        const result = validateCoordinatePairFields(lat, lng);
        assert.equal(result.ok, false);
        if (!result.ok)
            assert.match(result.error, /sekaligus/i);
    }
});
test('validateCoordinatePairFields: setengah pasangan ditolak (lng terisi, lat kosong)', () => {
    for (const [lat, lng] of [
        [null, 106.8],
        ['', 106.8],
        [undefined, 106.8],
    ] as const) {
        const result = validateCoordinatePairFields(lat, lng);
        assert.equal(result.ok, false);
        if (!result.ok)
            assert.match(result.error, /sekaligus/i);
    }
});
test('validateCoordinatePairFields: satu sisi dikirim NULL tanpa pasangannya tetap ditolak', () => {
    for (const [lat, lng] of [
        [null, undefined],
        [undefined, null],
    ] as const) {
        const result = validateCoordinatePairFields(lat, lng);
        assert.equal(result.ok, false);
        if (!result.ok)
            assert.match(result.error, /sekaligus/i);
    }
});
test('validateCoordinatePairFields: nonnumerik / non-finite ditolak', () => {
    for (const [lat, lng] of [
        ['abc', 106.8],
        [-6.2, 'abc'],
        [Number.NaN, 106.8],
        [Number.POSITIVE_INFINITY, 106.8],
        [true, 106.8],
        [{}, 106.8],
    ] as const) {
        const result = validateCoordinatePairFields(lat, lng);
        assert.equal(result.ok, false);
        if (!result.ok)
            assert.match(result.error, /angka/i);
    }
});
test('validateCoordinatePairFields: di luar rentang ditolak (tanpa menebak)', () => {
    const latHigh = validateCoordinatePairFields(91, 106.8);
    assert.equal(latHigh.ok, false);
    if (!latHigh.ok)
        assert.match(latHigh.error, /latitude/i);
    const latLow = validateCoordinatePairFields(-91, 106.8);
    assert.equal(latLow.ok, false);
    if (!latLow.ok)
        assert.match(latLow.error, /latitude/i);
    const lngHigh = validateCoordinatePairFields(-6.2, 181);
    assert.equal(lngHigh.ok, false);
    if (!lngHigh.ok)
        assert.match(lngHigh.error, /longitude/i);
    assert.equal(validateCoordinatePairFields(-6.2, -181).ok, false);
    assert.equal(validateCoordinatePairFields(null, 181).ok, false);
});
