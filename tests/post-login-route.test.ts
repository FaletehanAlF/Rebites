import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolvePostLoginRoute } from '../lib/post-login-route.ts';
const BUYER_HOME = '/home';
const SELLER_HOME = '/dashboard/penjual';
const ADMIN_HOME = '/dashboard/admin';
function route(overrides: Partial<Parameters<typeof resolvePostLoginRoute>[0]> = {}) {
    return resolvePostLoginRoute({
        safeRedirect: null,
        sellerOnboardingTarget: null,
        roleHome: BUYER_HOME,
        buyerHome: BUYER_HOME,
        sellerHome: SELLER_HOME,
        hasStore: false,
        ...overrides,
    });
}
test('pembeli tanpa toko tetap ke beranda pembeli', () => {
    assert.equal(route(), BUYER_HOME);
});
test('akun yang punya toko tidak pernah mendarat di beranda pembeli', () => {
    assert.equal(route({ hasStore: true }), SELLER_HOME);
});
test('peran admin tidak diturunkan walau akun punya toko', () => {
    assert.equal(route({ roleHome: ADMIN_HOME, hasStore: true }), ADMIN_HOME);
});
test('peran umkm tanpa toko tetap diarahkan ke dashboard penjual', () => {
    assert.equal(route({ roleHome: SELLER_HOME, hasStore: false }), SELLER_HOME);
});
test('redirect eksplisit menang atas aturan pemilik toko', () => {
    assert.equal(route({ safeRedirect: '/detail/product?id=abc', hasStore: true }), '/detail/product?id=abc');
});
test('onboarding paket (?plan=) menang atas aturan pemilik toko', () => {
    assert.equal(route({
        sellerOnboardingTarget: '/auth/register/penjual?plan=standar&billing=monthly',
        hasStore: true,
    }), '/auth/register/penjual?plan=standar&billing=monthly');
});
test('redirect eksplisit menang atas onboarding paket', () => {
    assert.equal(route({
        safeRedirect: '/riwayatPesanan',
        sellerOnboardingTarget: '/auth/register/penjual?plan=basic&billing=monthly',
    }), '/riwayatPesanan');
});
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
test('completeAuthSession memakai aturan ini dan memeriksa kepemilikan toko', () => {
    const source = readProjectFile('lib/auth-post-login.ts');
    assert.match(source, /resolvePostLoginRoute\(/, 'jalur login harus memakai resolver bersama, bukan aturan yang ditulis ulang');
    assert.match(source, /import\('\.\/product-storage'\)/, 'kepemilikan toko harus dibaca dari helper yang sudah ada (getSellerUmkmResult)');
    assert.match(source, /getSellerUmkmResult\(\)/, 'helper kepemilikan toko tidak dipanggil');
    assert.match(source, /hasStore\s*=\s*result\.kind === 'ok'/, "hanya kind 'ok' yang boleh dianggap punya toko");
});
