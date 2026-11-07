import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SELLER_DASHBOARD_ROOT, SELLER_SUB_PAGES, isSellerSubPage, parseSellerStorePath, sellerPathForCurrentPage, sellerStorePath, } from '../lib/seller-store-path.ts';
const STORE_ID = '8f3a1c2e-1111-2222-3333-444455556666';
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
test('tanpa id toko, alamatnya alamat lama yang punya halaman pengalih', () => {
    for (const kosong of [null, undefined, '', '   ']) {
        assert.equal(sellerStorePath(kosong), SELLER_DASHBOARD_ROOT);
        assert.equal(sellerStorePath(kosong, 'pesanan'), `${SELLER_DASHBOARD_ROOT}/pesanan`);
    }
});
test('dengan id toko, alamatnya memuat id itu', () => {
    assert.equal(sellerStorePath(STORE_ID), `${SELLER_DASHBOARD_ROOT}/${STORE_ID}`);
    assert.equal(sellerStorePath(STORE_ID, 'pesanan'), `${SELLER_DASHBOARD_ROOT}/${STORE_ID}/pesanan`);
});
test('id toko tidak bisa menyusupkan segmen alamat', () => {
    for (const jahat of ['../../admin', 'a/b', '..\\admin', '..', '.']) {
        const alamat = sellerStorePath(jahat, 'pesanan');
        assert.ok(!alamat.includes('..'), `${jahat}: titik-titik harus hilang`);
        assert.ok(alamat === `${SELLER_DASHBOARD_ROOT}/pesanan`, `${jahat}: harus jatuh ke alamat lama, bukan menyusup (dapat ${alamat})`);
    }
    assert.equal(sellerStorePath('a b', 'menu'), `${SELLER_DASHBOARD_ROOT}/a%20b/menu`);
});
test('setiap sub-halaman menghasilkan alamat unik dan berakhiran nama segmennya', () => {
    const terlihat = new Set<string>();
    for (const sub of SELLER_SUB_PAGES) {
        const alamat = sellerStorePath(STORE_ID, sub);
        assert.ok(alamat.endsWith(`/${sub}`), `${sub}: alamat tidak berakhir segmennya`);
        assert.ok(!terlihat.has(alamat), `${sub}: alamat duplikat dengan sub-halaman lain`);
        terlihat.add(alamat);
    }
    assert.equal(terlihat.size, SELLER_SUB_PAGES.length);
});
test('isSellerSubPage hanya mengenali segmen yang terdaftar', () => {
    for (const sub of SELLER_SUB_PAGES) {
        assert.equal(isSellerSubPage(sub), true, `${sub} harus dikenali`);
    }
    for (const lain of ['chat', 'Pesanan', '', null, undefined, 7]) {
        assert.equal(isSellerSubPage(lain), false, `${String(lain)} tidak boleh dikenali`);
    }
});
test('alamat ber-id dikenali beserta sub-halamannya', () => {
    assert.deepEqual(parseSellerStorePath(`${SELLER_DASHBOARD_ROOT}/${STORE_ID}`), {
        storeId: STORE_ID,
        sub: null,
    });
    assert.deepEqual(parseSellerStorePath(`${SELLER_DASHBOARD_ROOT}/${STORE_ID}/pesanan`), { storeId: STORE_ID, sub: 'pesanan' });
});
test('query dan hash tidak mengacaukan pembacaan', () => {
    assert.deepEqual(parseSellerStorePath(`${SELLER_DASHBOARD_ROOT}/${STORE_ID}/menu?tab=aktif#atas`), { storeId: STORE_ID, sub: 'menu' });
});
test('alamat yang bukan dashboard penjual dikembalikan null', () => {
    for (const lain of [
        null,
        undefined,
        '',
        '/dashboard/admin',
        '/dashboard',
        '/home',
        SELLER_DASHBOARD_ROOT,
        `${SELLER_DASHBOARD_ROOT}/`,
        '/dashboard/penjual/',
    ]) {
        assert.equal(parseSellerStorePath(lain), null, `${String(lain)} tidak boleh dikenali`);
    }
});
test('sub-halaman tak dikenal dan segmen berlebih ditolak', () => {
    for (const alamat of [
        `${SELLER_DASHBOARD_ROOT}/${STORE_ID}/chat`,
        `${SELLER_DASHBOARD_ROOT}/${STORE_ID}/Pesanan`,
        `${SELLER_DASHBOARD_ROOT}/${STORE_ID}/pesanan/detail`,
    ]) {
        assert.equal(parseSellerStorePath(alamat), null, `${alamat} tidak boleh dikenali`);
    }
    assert.deepEqual(parseSellerStorePath(`${SELLER_DASHBOARD_ROOT}/${STORE_ID}/pesanan/`), { storeId: STORE_ID, sub: 'pesanan' });
});
test('encoding rusak ditolak, bukan dilempar sebagai error', () => {
    assert.equal(parseSellerStorePath(`${SELLER_DASHBOARD_ROOT}/%zz`), null);
});
test('alamat LAMA tidak dibaca sebagai id toko', () => {
    for (const sub of SELLER_SUB_PAGES) {
        assert.equal(parseSellerStorePath(`${SELLER_DASHBOARD_ROOT}/${sub}`), null, `${sub} adalah sub-halaman, bukan id toko`);
    }
});
test('alamat yang dirakit selalu terbaca kembali sama', () => {
    for (const sub of [null, ...SELLER_SUB_PAGES] as const) {
        const alamat = sellerStorePath(STORE_ID, sub ?? undefined);
        assert.deepEqual(parseSellerStorePath(alamat), { storeId: STORE_ID, sub });
    }
});
test('alamat halaman yang sedang dibuka mempertahankan sub-halamannya', () => {
    assert.equal(sellerPathForCurrentPage(STORE_ID, `${SELLER_DASHBOARD_ROOT}/id-lama/ulasan`), `${SELLER_DASHBOARD_ROOT}/${STORE_ID}/ulasan`);
    assert.equal(sellerPathForCurrentPage(STORE_ID, `${SELLER_DASHBOARD_ROOT}/id-lama`), `${SELLER_DASHBOARD_ROOT}/${STORE_ID}`);
    assert.equal(sellerPathForCurrentPage(STORE_ID, '/home'), `${SELLER_DASHBOARD_ROOT}/${STORE_ID}`);
});
test('setiap sub-halaman punya page.tsx di disk', () => {
    const base = path.join(PROJECT_ROOT, 'app', '(app)', 'dashboard', 'penjual', '[storeId]');
    assert.ok(existsSync(path.join(base, 'page.tsx')), 'dashboard penjual ber-id harus punya page.tsx');
    for (const sub of SELLER_SUB_PAGES) {
        assert.ok(existsSync(path.join(base, sub, 'page.tsx')), `sub-halaman "${sub}" dirakit oleh sellerStorePath tetapi page.tsx-nya tidak ada`);
    }
});
