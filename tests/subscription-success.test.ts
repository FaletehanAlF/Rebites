import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveSuccessStatus, resolvePostPaymentHref, } from '../lib/subscription-success.ts';
import { getSubscriptionPlan } from '../lib/subscription-plans.ts';
test('redirect: akun yang punya toko tetap ke dashboard penjual', () => {
    assert.equal(resolvePostPaymentHref({ hasStore: true }), '/dashboard/penjual');
});
test('redirect: dengan id toko, tujuannya alamat toko itu', () => {
    assert.equal(resolvePostPaymentHref({ hasStore: true, storeId: 'toko-abc' }), '/dashboard/penjual/toko-abc');
});
test('redirect: id toko diabaikan bila akun tidak punya toko', () => {
    assert.equal(resolvePostPaymentHref({ hasStore: false, storeId: 'toko-abc' }), '/home');
});
test('redirect: pembeli tanpa toko TIDAK diarahkan ke dashboard penjual', () => {
    assert.equal(resolvePostPaymentHref({ hasStore: false }), '/home');
});
test('redirect: kondisi akun belum diketahui tidak ditebak sebagai penjual', () => {
    assert.equal(resolvePostPaymentHref({ hasStore: null }), '/home');
    assert.equal(resolvePostPaymentHref({ hasStore: undefined }), '/home');
});
test('status: tanpa external_id baru boleh dianggap aktif', () => {
    assert.equal(resolveSuccessStatus({ externalId: undefined }), 'active');
    assert.equal(resolveSuccessStatus({ externalId: null }), 'active');
    assert.equal(resolveSuccessStatus({ externalId: '' }), 'active');
});
test('status: dengan external_id selalu menunggu verifikasi, bukan aktif', () => {
    assert.equal(resolveSuccessStatus({ externalId: 'SUB-1F15CA-MVTBZBMU' }), 'pending');
});
test('plan: slug yang terdaftar dikenali beserta harganya', () => {
    for (const slug of ['basic', 'standar', 'premium']) {
        const plan = getSubscriptionPlan(slug);
        assert.ok(plan, `paket ${slug} harus dikenali`);
        assert.equal(plan?.slug, slug);
        assert.ok(plan!.name.length > 0);
    }
});
test('plan: null / kosong / tidak dikenal TIDAK menghasilkan paket', () => {
    for (const value of [null, undefined, '', 'standard', 'Pro', 'premium-plus', 'BASIC']) {
        assert.equal(getSubscriptionPlan(value as string | null | undefined), undefined, `nilai ${JSON.stringify(value)} tidak boleh dianggap paket sah`);
    }
});
function readSource(rel: string): string {
    return readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}
test('sumber: halaman sukses memakai helper, bukan redirect spesifik penjual', () => {
    const src = readSource('app/components/subscription/subscription-success-client.tsx');
    assert.match(src, /resolvePostPaymentHref\(\{ hasStore, storeId \}\)/);
    assert.doesNotMatch(src, /router\.replace\('\/dashboard\/penjual'\)/);
    assert.match(src, /resolveSuccessStatus\(\{ externalId \}\)/);
    assert.doesNotMatch(src, /externalId \? 'pending' : 'active'/);
});
