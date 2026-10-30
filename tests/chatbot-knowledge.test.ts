/**
 * Test basis pengetahuan chatbot (lib/chatbot/knowledge.ts).
 *
 * Dua hal yang dijaga, dan keduanya adalah cara paling umum asisten menjadi
 * salah tanpa ada yang menyadarinya:
 *   1. RUTE YATIM — asisten menuntun pengguna ke halaman yang sudah dihapus
 *      atau diganti nama. Setiap entri wajib punya `page.tsx` nyata di disk.
 *   2. ANGKA BASI — harga atau batas produk berubah di aplikasi tetapi prompt
 *      masih menyebut nilai lama. Seed dibandingkan langsung dengan
 *      `SUBSCRIPTION_PLANS` yang dipakai halaman langganan.
 *
 * Jalankan: node --test tests/chatbot-knowledge.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  ADMIN_ROUTES,
  BUYER_ROUTES,
  PUBLIC_ROUTES,
  SELLER_ROUTES,
  SUBSCRIPTION_FACTS_SEED,
  buildSystemPrompt,
  subscriptionFacts,
  subscriptionProductLimits,
  type RouteDoc,
} from '../lib/chatbot/knowledge.ts';
import { SUBSCRIPTION_PLANS } from '../lib/subscription-plans.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(HERE, '..', 'app');

const ALL_ROUTE_GROUPS: Array<{ name: string; routes: RouteDoc[] }> = [
  { name: 'PUBLIC_ROUTES', routes: PUBLIC_ROUTES },
  { name: 'BUYER_ROUTES', routes: BUYER_ROUTES },
  { name: 'SELLER_ROUTES', routes: SELLER_ROUTES },
  { name: 'ADMIN_ROUTES', routes: ADMIN_ROUTES },
];

test('setiap entri route menunjuk page.tsx yang benar-benar ada', () => {
  for (const group of ALL_ROUTE_GROUPS) {
    assert.ok(group.routes.length > 0, `${group.name} tidak boleh kosong`);
    for (const route of group.routes) {
      const file = path.join(APP_DIR, route.page);
      assert.ok(
        existsSync(file),
        `${group.name}: "${route.path}" menunjuk ${route.page} yang TIDAK ADA (${file})`
      );
    }
  }
});

test('setiap entri route punya label, detail, dan grup yang terisi', () => {
  for (const group of ALL_ROUTE_GROUPS) {
    for (const route of group.routes) {
      assert.ok(route.path.startsWith('/'), `${group.name}: path harus absolut: ${route.path}`);
      assert.ok(route.label.trim().length > 2, `${route.path}: label terlalu pendek`);
      assert.ok(route.detail.trim().length > 20, `${route.path}: detail terlalu pendek`);
      assert.ok(route.group.trim().length > 2, `${route.path}: grup menu kosong`);
    }
  }
});

test('harga dan fitur paket identik dengan SUBSCRIPTION_PLANS', () => {
  assert.equal(
    SUBSCRIPTION_FACTS_SEED.length,
    SUBSCRIPTION_PLANS.length,
    'jumlah paket di seed harus sama dengan aplikasi'
  );

  for (const plan of SUBSCRIPTION_PLANS) {
    const seed = SUBSCRIPTION_FACTS_SEED.find((item) => item.slug === plan.slug);
    assert.ok(seed, `paket "${plan.slug}" ada di aplikasi tetapi tidak di seed pengetahuan`);

    assert.equal(seed.name, plan.name, `nama paket ${plan.slug} berbeda`);
    assert.equal(seed.monthly, plan.monthly, `harga bulanan ${plan.slug} berbeda`);
    assert.equal(seed.yearly, plan.yearly, `harga tahunan ${plan.slug} berbeda`);
    assert.equal(seed.tagline, plan.tagline, `tagline ${plan.slug} berbeda`);
    assert.deepEqual(seed.features, plan.features, `fitur ${plan.slug} berbeda`);
  }

  // Seed yang tidak ada di aplikasi berarti paket sudah dihapus.
  for (const seed of SUBSCRIPTION_FACTS_SEED) {
    assert.ok(
      SUBSCRIPTION_PLANS.some((plan) => plan.slug === seed.slug),
      `seed memuat paket "${seed.slug}" yang tidak ada di aplikasi`
    );
  }
});

test('batas produk diturunkan dari fitur, bukan diketik ulang', () => {
  const limits = subscriptionProductLimits();
  const bySlug = new Map(limits.map((item) => [item.slug, item.limit]));

  assert.equal(bySlug.get('basic'), 3);
  assert.equal(bySlug.get('standar'), 5);
  assert.equal(bySlug.get('premium'), 15);
});

test('subscriptionFacts menyebut rupiah dan nama paket', () => {
  const facts = subscriptionFacts();
  assert.equal(facts.length, SUBSCRIPTION_PLANS.length);
  for (const line of facts) {
    assert.match(line, /Rp/, 'setiap baris harus memuat harga rupiah');
    assert.match(line, /per bulan/, 'setiap baris harus menyebut siklus bulanan');
    assert.match(line, /per tahun/, 'setiap baris harus menyebut siklus tahunan');
  }
});

test('prompt publik memuat cara pesan tetapi TIDAK menyebut tools', () => {
  const prompt = buildSystemPrompt('publik');

  assert.match(prompt, /ReBites/);
  assert.match(prompt, /\/auth\/login/, 'harus menyebut cara masuk');
  assert.match(prompt, /\/auth\/register\/penjual/, 'harus menyebut cara daftar penjual');
  assert.match(prompt, /\/makanan/, 'harus menyebut katalog makanan');

  assert.ok(
    !/tools?\b/i.test(prompt),
    'prompt publik tidak boleh menjanjikan tools yang tidak dimiliki profil ini'
  );
  assert.ok(
    !/MODE ADMIN/i.test(prompt),
    'prompt publik tidak boleh memuat bagian mode admin'
  );
});

test('prompt anggota memuat menu pembeli dan penjual', () => {
  const prompt = buildSystemPrompt('anggota');

  assert.match(prompt, /\/riwayatPesanan/, 'harus menyebut riwayat pesanan');
  assert.match(prompt, /\/dashboard\/penjual\/menu/, 'harus menyebut menu penjual');
  assert.match(prompt, /Diskon Kilat/, 'harus menyebut menu diskon kilat');
  assert.ok(!/MODE ADMIN/i.test(prompt));
});

test('prompt admin memuat tools DAN kewajiban konfirmasi', () => {
  const prompt = buildSystemPrompt('admin');

  assert.match(prompt, /MODE ADMIN/);
  assert.match(prompt, /tools/i, 'harus menjelaskan adanya tools data');
  assert.match(prompt, /konfirmasi|Setujui/i, 'harus menjelaskan aksi perlu konfirmasi admin');
  assert.match(
    prompt,
    /TIDAK BOLEH memberi sanksi|tidak boleh memberi sanksi/i,
    'harus menyatakan sanksi di luar wewenang bot'
  );
  assert.match(prompt, /\/dashboard\/admin\/monitoring\/sanksi/);
});

test('semua profil memuat aturan bahasa Indonesia dan batas topik', () => {
  for (const profile of ['publik', 'anggota', 'admin'] as const) {
    const prompt = buildSystemPrompt(profile);
    assert.match(prompt, /bahasa Indonesia/i, `${profile}: harus mengatur bahasa jawaban`);
    assert.match(prompt, /BATAS TOPIK/, `${profile}: harus memuat batas topik`);
    assert.match(prompt, /role play/i, `${profile}: harus melarang role play`);
    assert.match(prompt, /kode program/i, `${profile}: harus melarang menulis kode`);
  }
});

test('tidak ada path duplikat di dalam satu grup kecuali anchor pada halaman sama', () => {
  for (const group of ALL_ROUTE_GROUPS) {
    const seen = new Set<string>();
    for (const route of group.routes) {
      // `/home` dan `/home#rekomendasi` sah berbagi halaman; yang tidak boleh
      // adalah path identik dua kali.
      assert.ok(!seen.has(route.path), `${group.name}: path duplikat ${route.path}`);
      seen.add(route.path);
    }
  }
});
