/**
 * Aturan tujuan pasca-login.
 *
 * Modul murni: tanpa browser, tanpa jaringan. Yang diuji di sini adalah
 * urutan aturan yang menentukan tujuan setelah sesi aktif — bagian yang
 * paling mudah rusak diam-diam, karena kesalahan di sini hanya terlihat
 * sebagai "login mendarat di halaman yang salah", bukan error.
 *
 * Jalankan: node --test tests/post-login-route.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { resolvePostLoginRoute } from '../lib/post-login-route.ts';

const BUYER_HOME = '/home';
const SELLER_HOME = '/dashboard/penjual';
const ADMIN_HOME = '/dashboard/admin';

/** Contoh isian lengkap; tiap tes hanya menimpa yang relevan. */
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
  // Inilah keluhan yang diperbaiki: peran di `profiles` masih 'buyer'
  // (trigger pendaftaran menulis 'buyer' dan alur pendaftaran penjual tidak
  // mengubahnya), padahal akun sudah punya toko.
  assert.equal(route({ hasStore: true }), SELLER_HOME);
});

test('peran admin tidak diturunkan walau akun punya toko', () => {
  assert.equal(route({ roleHome: ADMIN_HOME, hasStore: true }), ADMIN_HOME);
});

test('peran umkm tanpa toko tetap diarahkan ke dashboard penjual', () => {
  // Perilaku lama dipertahankan: guard dashboard penjual yang melanjutkan
  // ke langkah pendaftaran toko, bukan modul ini.
  assert.equal(route({ roleHome: SELLER_HOME, hasStore: false }), SELLER_HOME);
});

test('redirect eksplisit menang atas aturan pemilik toko', () => {
  // Penjual yang masuk lewat tautan dalam (mis. detail produk) harus kembali
  // ke tautan itu, bukan dibelokkan ke dashboard.
  assert.equal(
    route({ safeRedirect: '/detail/product?id=abc', hasStore: true }),
    '/detail/product?id=abc'
  );
});

test('onboarding paket (?plan=) menang atas aturan pemilik toko', () => {
  assert.equal(
    route({
      sellerOnboardingTarget: '/auth/register/penjual?plan=standar&billing=monthly',
      hasStore: true,
    }),
    '/auth/register/penjual?plan=standar&billing=monthly'
  );
});

test('redirect eksplisit menang atas onboarding paket', () => {
  assert.equal(
    route({
      safeRedirect: '/riwayatPesanan',
      sellerOnboardingTarget: '/auth/register/penjual?plan=basic&billing=monthly',
    }),
    '/riwayatPesanan'
  );
});

// ---------------------------------------------------------------------------
// Source guard: pemasangan di jalur login nyata
// ---------------------------------------------------------------------------

function readProjectFile(relativePath: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
    'utf8'
  ).replace(/\r\n/g, '\n');
}

test('completeAuthSession memakai aturan ini dan memeriksa kepemilikan toko', () => {
  const source = readProjectFile('lib/auth-post-login.ts');

  assert.match(
    source,
    /resolvePostLoginRoute\(/,
    'jalur login harus memakai resolver bersama, bukan aturan yang ditulis ulang'
  );
  assert.match(
    source,
    /import\('\.\/product-storage'\)/,
    'kepemilikan toko harus dibaca dari helper yang sudah ada (getSellerUmkmResult)'
  );
  assert.match(
    source,
    /getSellerUmkmResult\(\)/,
    'helper kepemilikan toko tidak dipanggil'
  );
  // Gangguan jaringan/database TIDAK boleh dianggap "punya toko": kalau ini
  // ditulis `!== 'none'`, satu kegagalan query akan mengirim pembeli ke
  // dashboard penjual.
  assert.match(
    source,
    /hasStore\s*=\s*result\.kind === 'ok'/,
    "hanya kind 'ok' yang boleh dianggap punya toko"
  );
});
