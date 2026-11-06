/**
 * Test aturan halaman konfirmasi pembayaran langganan.
 *
 * Regresi yang dijaga (lihat catatan bug di lib/subscription-success.ts):
 *   A. Pembeli tanpa toko tidak boleh diarahkan ke /dashboard/penjual.
 *   B. `plan` null / tidak dikenal tidak boleh tampil sebagai "paket aktif".
 *
 * Jalankan: node --test tests/subscription-success.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  resolveSuccessStatus,
  resolvePostPaymentHref,
} from '../lib/subscription-success.ts';
import { getSubscriptionPlan } from '../lib/subscription-plans.ts';

// ---------------------------------------------------------------------------
// A. Tujuan redirect sesuai kondisi akun
// ---------------------------------------------------------------------------

test('redirect: akun yang punya toko tetap ke dashboard penjual', () => {
  assert.equal(resolvePostPaymentHref({ hasStore: true }), '/dashboard/penjual');
});

test('redirect: pembeli tanpa toko TIDAK diarahkan ke dashboard penjual', () => {
  assert.equal(resolvePostPaymentHref({ hasStore: false }), '/home');
});

test('redirect: kondisi akun belum diketahui tidak ditebak sebagai penjual', () => {
  assert.equal(resolvePostPaymentHref({ hasStore: null }), '/home');
  assert.equal(resolvePostPaymentHref({ hasStore: undefined }), '/home');
});

// ---------------------------------------------------------------------------
// B. Status awal tidak pernah menyimpulkan lunas dari URL
// ---------------------------------------------------------------------------

test('status: tanpa external_id baru boleh dianggap aktif', () => {
  assert.equal(resolveSuccessStatus({ externalId: undefined }), 'active');
  assert.equal(resolveSuccessStatus({ externalId: null }), 'active');
  assert.equal(resolveSuccessStatus({ externalId: '' }), 'active');
});

test('status: dengan external_id selalu menunggu verifikasi, bukan aktif', () => {
  assert.equal(resolveSuccessStatus({ externalId: 'SUB-1F15CA-MVTBZBMU' }), 'pending');
});

// ---------------------------------------------------------------------------
// C. Resolusi paket: valid, null, tidak dikenal
// ---------------------------------------------------------------------------

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
    assert.equal(
      getSubscriptionPlan(value as string | null | undefined),
      undefined,
      `nilai ${JSON.stringify(value)} tidak boleh dianggap paket sah`
    );
  }
});

// ---------------------------------------------------------------------------
// D. Sumber: tidak ada lagi tujuan yang di-hardcode ke dashboard penjual
// ---------------------------------------------------------------------------

function readSource(rel: string): string {
  return readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

test('sumber: halaman sukses memakai helper, bukan redirect spesifik penjual', () => {
  const src = readSource('app/components/subscription/subscription-success-client.tsx');

  assert.match(src, /resolvePostPaymentHref\(\{ hasStore \}\)/);
  // Redirect otomatis tidak boleh lagi menulis tujuan penjual secara langsung.
  assert.doesNotMatch(src, /router\.replace\('\/dashboard\/penjual'\)/);
  // Status awal wajib lewat helper agar external_id selalu berarti pending.
  assert.match(src, /resolveSuccessStatus\(\{ externalId \}\)/);
  assert.doesNotMatch(src, /externalId \? 'pending' : 'active'/);
});
