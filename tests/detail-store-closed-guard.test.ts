import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isStoreOpen, parseVendorHours, vendorPurchaseWindowState, } from '../lib/store-hours.ts';

function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}

test('parseVendorHours membaca format "09.00-21.00" termasuk en-dash', () => {
    assert.deepEqual(parseVendorHours('09.00-21.00'), { from: '09:00', to: '21:00' });
    assert.deepEqual(parseVendorHours('08.30–22.00'), { from: '08:30', to: '22:00' });
    assert.equal(parseVendorHours('tutup selamanya'), null);
    assert.equal(parseVendorHours(null), null);
    assert.equal(parseVendorHours(undefined), null);
});

test('isStoreOpen menyertakan jam tutup dan bisa diuji dengan waktu eksplisit', () => {
    const noon = new Date(2026, 0, 1, 12, 0);
    const closeEdge = new Date(2026, 0, 1, 21, 0);
    const late = new Date(2026, 0, 1, 22, 0);
    assert.equal(isStoreOpen('09:00', '21:00', noon), true);
    assert.equal(isStoreOpen('09:00', '21:00', closeEdge), true);
    assert.equal(isStoreOpen('09:00', '21:00', late), false);
});

test('vendorPurchaseWindowState: toko aktif dan buka di luar jam => tertutup', () => {
    const late = new Date(2026, 0, 1, 23, 0);
    const noon = new Date(2026, 0, 1, 12, 0);
    const outside = vendorPurchaseWindowState({ openHours: '09.00-21.00', isOpen: true, isActive: true }, '08:00', '20:00', late);
    assert.equal(outside.closed, true);
    assert.deepEqual({ from: outside.from, to: outside.to }, { from: '09:00', to: '21:00' });
    const inside = vendorPurchaseWindowState({ openHours: '09.00-21.00', isOpen: true, isActive: true }, '08:00', '20:00', noon);
    assert.equal(inside.closed, false);
});

test('vendorPurchaseWindowState: toko nonaktif atau keluaran => tertutup meski di dalam jam', () => {
    const noon = new Date(2026, 0, 1, 12, 0);
    assert.equal(vendorPurchaseWindowState({ openHours: '09.00-21.00', isOpen: true, isActive: false }, '08:00', '20:00', noon).closed, true);
    assert.equal(vendorPurchaseWindowState({ openHours: '09.00-21.00', isOpen: false, isActive: true }, '08:00', '20:00', noon).closed, true);
});

test('vendorPurchaseWindowState: tanpa open_hours memakai jendela jual produk', () => {
    const noon = new Date(2026, 0, 1, 12, 0);
    const early = new Date(2026, 0, 1, 5, 0);
    const state = vendorPurchaseWindowState({ openHours: null, isOpen: true, isActive: true }, '08:00', '20:00', noon);
    assert.equal(state.closed, false);
    const closedEarly = vendorPurchaseWindowState({ openHours: null, isOpen: true, isActive: true }, '08:00', '20:00', early);
    assert.equal(closedEarly.closed, true);
    assert.deepEqual({ from: closedEarly.from, to: closedEarly.to }, { from: '08:00', to: '20:00' });
});

test('tipe ProductDetail memuat status toko dan detail-data memetakannya dari umkm', () => {
    const data = readProjectFile('app/components/detail-product/data.ts');
    for (const field of ['storeOpenHours', 'storeIsOpen', 'storeIsActive']) {
        assert.ok(data.includes(field), `ProductDetail maka mengenalkan ${field}`);
    }
    const detailData = readProjectFile('app/components/detail-product/detail-data.ts');
    assert.match(detailData, /umkm\.open_hours/);
    assert.match(detailData, /umkm\.is_open !== false/);
    assert.match(detailData, /umkm\.is_active !== false/);
});

test('handleOrder di detail produk validasi dulu sebelum menavigasi ke checkout', () => {
    const page = readProjectFile('app/components/detail-product/detail-page.tsx');
    assert.match(page, /vendorPurchaseWindowState\(\{[\s\S]*?openHours: product\.storeOpenHours/);
    assert.match(page, /if \(storeStatus\.closed\) \{[\s\S]*?openStoreClosedModal\(storeStatus\.from, storeStatus\.to\)/);
    assert.match(page, /<StoreClosedModal isOpen=\{storeClosedModal\.isOpen\}/);
    const guardIndex = page.indexOf('if (storeStatus.closed)');
    const pushIndex = page.indexOf('router.push(`/detail/pesanan?product=');
    assert.ok(guardIndex >= 0, 'validasi toko tutup wajib ada di handleOrder');
    assert.ok(pushIndex >= 0, 'navigasi ke checkout tetap ada');
    assert.ok(guardIndex < pushIndex, 'cek toko tutup harus terjadi sebelum navigasi checkout');
});
