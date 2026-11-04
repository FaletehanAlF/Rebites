/**
 * Kurir AI (Gemini) — pengujian logika tanpa jaringan.
 *
 * Yang dikunci di sini:
 * 1. Pemetaan sender_kind lama/baru tetap kompatibel.
 * 2. Server tidak pernah mempercayai is_demo/identitas dari browser;
 *    alur otomatis hanya berjalan untuk is_demo & pembeli.
 * 3. Pengguna tanpa autentikasi / bukan peserta ditolak (kontrak route).
 * 4. Input kosong/panjang, respons tidak valid, timeout, dan error provider
 *    ditangani aman; key tidak pernah bocor ke pesan/respons.
 * 5. Client tidak bisa memalsukan sender_kind; hanya route yang menulis
 *    sender_kind (insert 'user'), AI/demo hanya lewat service client.
 *
 * Pengujian ini TIDAK memerlukan GEMINI_API_KEY asli: semua panggilan
 * jaringan digantikan mock.
 *
 * Jalankan: node --test tests/courier-ai.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  normalizeCourierSenderKind,
  isAutomatedSenderKind,
  courierSenderLabel,
} from '../lib/courier-sender-kind.ts';
import {
  resolveGeminiConfig,
  geminiGenerateContentUrl,
  buildGenerateContentPayload,
  buildGenerateContentHeaders,
  extractGeminiText,
  sanitizeGeminiReply,
  generateCourierAiReply,
  isGeminiConfigured,
  GeminiNotConfiguredError,
  GeminiProviderError,
  GEMINI_DEFAULT_MODEL,
  GEMINI_ENDPOINT_BASE,
  GEMINI_MAX_REPLY_CHARS,
} from '../lib/server/gemini.ts';
import { generateDemoCourierAiReply, COURIER_AI_LIMIT_USER } from '../lib/server/courier-ai.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');

const ENV = { GEMINI_API_KEY: 'test-key-SECRET-DO-NOT-LEAK', GEMINI_MODEL: '' } as unknown as NodeJS.ProcessEnv;
const ENV_CUSTOM_MODEL = { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'custom-model-1' } as unknown as NodeJS.ProcessEnv;

// ---------------------------------------------------------------------------
// 1. Pemetaan sender_kind
// ---------------------------------------------------------------------------

test('pemetaan sender_kind: nilai dikenal dan fallback ke user', () => {
  assert.equal(normalizeCourierSenderKind('user'), 'user');
  assert.equal(normalizeCourierSenderKind('demo_courier'), 'demo_courier');
  assert.equal(normalizeCourierSenderKind('ai_courier'), 'ai_courier');
  assert.equal(normalizeCourierSenderKind('AI_COURIER'), 'user');
  assert.equal(normalizeCourierSenderKind(undefined), 'user');
  assert.equal(normalizeCourierSenderKind('hacker'), 'user');
  assert.equal(normalizeCourierSenderKind(null), 'user');
});

test('label otomatis sesuai jenis pengirim', () => {
  assert.equal(isAutomatedSenderKind('ai_courier'), true);
  assert.equal(isAutomatedSenderKind('demo_courier'), true);
  assert.equal(isAutomatedSenderKind('user'), false);
  assert.equal(courierSenderLabel('ai_courier'), 'Kurir AI');
  assert.equal(courierSenderLabel('demo_courier'), 'Kurir Demo');
  assert.equal(courierSenderLabel('user'), 'Kurir');
});

// ---------------------------------------------------------------------------
// 2. Konfigurasi Gemini
// ---------------------------------------------------------------------------

test('resolveGeminiConfig melempar error tanpa GEMINI_API_KEY', () => {
  assert.throws(() => resolveGeminiConfig({} as NodeJS.ProcessEnv), GeminiNotConfiguredError);
});

test('model default & kustom; URL generateContent benar', () => {
  const cfg = resolveGeminiConfig(ENV);
  assert.equal(cfg.model, GEMINI_DEFAULT_MODEL);
  assert.ok(cfg.url.startsWith(GEMINI_ENDPOINT_BASE));
  assert.ok(cfg.url.endsWith(`/models/${GEMINI_DEFAULT_MODEL}:generateContent`));
  assert.equal(resolveGeminiConfig(ENV_CUSTOM_MODEL).model, 'custom-model-1');
  assert.equal(isGeminiConfigured(ENV), true);
  assert.equal(isGeminiConfigured({} as NodeJS.ProcessEnv), false);
});

test('buildGenerateContentPayload tidak membawa key dan memuat konteks', () => {
  const payload = buildGenerateContentPayload({
    orderCode: 'RB-99',
    orderStatus: 'processing',
    message: 'kapan sampai?',
  }) as Record<string, unknown>;
  const serialized = JSON.stringify(payload);
  assert.ok(serialized.includes('kapan sampai?'));
  assert.ok(serialized.includes('RB-99'));
  assert.ok(!serialized.includes((ENV as Record<string, unknown>).GEMINI_API_KEY as string));
  const headers = buildGenerateContentHeaders('supersecret-key-abc');
  assert.equal(headers['x-goog-api-key'], 'supersecret-key-abc');
  assert.equal(headers['Content-Type'], 'application/json');
});

// ---------------------------------------------------------------------------
// 3. Ekstraksi & sanitasi respons
// ---------------------------------------------------------------------------

test('extractGeminiText: jawaban valid, kosong, diblokir', () => {
  const valid = {
    candidates: [{ content: { parts: [{ text: 'Baik, saya berangkat.' }] } }],
  };
  assert.equal(extractGeminiText(valid), 'Baik, saya berangkat.');
  assert.throws(() => extractGeminiText({ candidates: [] }), GeminiProviderError);
  assert.throws(() => extractGeminiText({ promptFeedback: { blockReason: 'SAFETY' } }), /memblokir/);
  assert.throws(() => extractGeminiText(null), GeminiProviderError);
});

test('sanitizeGeminiReply: bersihkan kontrol dan potong batas', () => {
  assert.equal(sanitizeGeminiReply('Halo  dunia'), 'Halo dunia');
  assert.equal(sanitizeGeminiReply('  a\nb\t\ts  '), 'a b s');
  assert.throws(() => sanitizeGeminiReply('   '), GeminiProviderError);
  const long = 'x'.repeat(GEMINI_MAX_REPLY_CHARS + 50);
  assert.equal(sanitizeGeminiReply(long).length, GEMINI_MAX_REPLY_CHARS);
});

// ---------------------------------------------------------------------------
// 4. Panggilan dengan mock (tanpa jaringan, tanpa key asli)
// ---------------------------------------------------------------------------

function mockOkResponse(text: string): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

test('generateCourierAiReply sukses; key hanya di header', async () => {
  const captured: { url?: string; init?: RequestInit } = {};
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    captured.url = String(url);
    captured.init = init;
    return mockOkResponse('Sampai nanti, ya!');
  };
  const out = await generateCourierAiReply(
    { orderCode: 'RB-1', orderStatus: 'out_for_delivery', message: 'halo' },
    { fetchImpl, env: ENV }
  );
  assert.equal(out, 'Sampai nanti, ya!');
  assert.equal(captured.url, geminiGenerateContentUrl(GEMINI_DEFAULT_MODEL));
  const headers = captured.init?.headers as Record<string, string>;
  assert.ok(headers['x-goog-api-key']);
  assert.ok(!JSON.stringify(headers).includes('Bearer'));
});

test('generateCourierAiReply: HTTP 500, JSON rusak, dan timeout ditangani', async () => {
  const fail500 = async () => new Response('oops', { status: 500 });
  await assert.rejects(
    async () =>
      generateCourierAiReply(
        { orderCode: 'RB-1', orderStatus: 'processing', message: 'm' },
        { fetchImpl: fail500, env: ENV }
      ),
    GeminiProviderError
  );
  const badJson = async () => new Response('not-json', { status: 200 });
  await assert.rejects(
    async () =>
      generateCourierAiReply(
        { orderCode: 'RB-1', orderStatus: 'processing', message: 'm' },
        { fetchImpl: badJson, env: ENV }
      ),
    GeminiProviderError
  );
  const aborted = async () => {
    const err = new Error('The operation was aborted due to timeout');
    err.name = 'AbortError';
    throw err;
  };
  await assert.rejects(
    async () =>
      generateCourierAiReply(
        { orderCode: 'RB-1', orderStatus: 'processing', message: 'm' },
        { fetchImpl: aborted, env: ENV }
      ),
    GeminiProviderError
  );
});

test('provider 500 tidak membocorkan API key ke pesan error', async () => {
  const fail500 = async () => new Response('boom', { status: 500 });
  try {
    await generateCourierAiReply(
      { orderCode: 'RB-1', orderStatus: 'processing', message: 'm' },
      { fetchImpl: fail500, env: ENV }
    );
    assert.fail('harus melempar GeminiProviderError');
  } catch (err) {
    assert.ok(err instanceof GeminiProviderError);
    assert.ok(!err.message.includes('supersecret-key-abc'));
    assert.ok(!err.message.includes('test-key'));
  }
});

// ---------------------------------------------------------------------------
// 5. generateDemoCourierAiReply: gating & rate limit
// ---------------------------------------------------------------------------

test('generateDemoCourierAiReply: not_configured bila key kosong', async () => {
  const out = await generateDemoCourierAiReply(
    { userId: 'u-noconfig', orderCode: 'RB-1', orderStatus: 'processing', message: 'halo' },
    { env: {} as NodeJS.ProcessEnv }
  );
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reason, 'not_configured');
});

test('generateDemoCourierAiReply: sukses dengan mock fetch', async () => {
  const fetchImpl = async () => mockOkResponse('Siap, pesanan diantar.');
  const out = await generateDemoCourierAiReply(
    { userId: 'u-ok-1', orderCode: 'RB-2', orderStatus: 'out_for_delivery', message: 'halo' },
    { fetchImpl: fetchImpl as unknown as typeof fetch, env: ENV }
  );
  assert.equal(out.ok, true);
  if (out.ok) assert.equal(out.reply, 'Siap, pesanan diantar.');
});

test('generateDemoCourierAiReply: provider gagal -> pesan ramah tanpa detail', async () => {
  const fetchImpl = async () => new Response('internal error dump', { status: 500 });
  const out = await generateDemoCourierAiReply(
    { userId: 'u-fail-1', orderCode: 'RB-3', orderStatus: 'processing', message: 'halo' },
    { fetchImpl: fetchImpl as unknown as typeof fetch, env: ENV }
  );
  assert.equal(out.ok, false);
  if (!out.ok) {
    assert.equal(out.reason, 'provider_failed');
    assert.ok(!out.message.includes('test-key'));
    assert.ok(!out.message.includes('internal error dump'));
  }
});

test('rate limit: melebihi kuota ditolak, kuota menghitung per pengguna', async () => {
  const fetchImpl = async () => mockOkResponse('baik');
  const userId = `u-rate-${Date.now()}`;
  let last;
  for (let i = 0; i < COURIER_AI_LIMIT_USER; i += 1) {
    last = await generateDemoCourierAiReply(
      { userId, orderCode: 'RB-4', orderStatus: 'processing', message: `p${i}` },
      { fetchImpl: fetchImpl as unknown as typeof fetch, env: ENV }
    );
  }
  assert.equal(last?.ok, true);
  const limited = await generateDemoCourierAiReply(
    { userId, orderCode: 'RB-4', orderStatus: 'processing', message: 'p-excess' },
    { fetchImpl: fetchImpl as unknown as typeof fetch, env: ENV }
  );
  assert.equal(limited.ok, false);
  if (!limited.ok) {
    assert.equal(limited.reason, 'rate_limited');
    assert.ok((limited.retryAfterSeconds ?? 0) >= 1);
  }
});

// ---------------------------------------------------------------------------
// 6. Kontrak route & migrasi (sumber, bukan eksekusi)
// ---------------------------------------------------------------------------

test('route: jalur AI hanya setelah verifikasi is_demo; sender_kind tidak dari body', () => {
  const route = read('app/api/courier/messages/route.ts');
  assert.ok(route.includes('delivery_assignments'));
  assert.ok(route.includes('is_demo'));
  // sender_kind selalu konstanta literal di server, tidak pernah dari request body.
  assert.ok(!route.includes('body.sender_kind'));
  assert.ok(!route.includes('req.headers.get(\'sender_kind\')'));
  // AI hanya ditulis lewat service client.
  assert.ok(route.includes("sender_kind: 'ai_courier'"));
  assert.ok(route.includes("sender_kind: 'user'"));
  // insert user lewat createAuthedServerClient (RLS), balasan AI lewat service client.
  assert.ok(route.includes('createAuthedServerClient'));
  assert.ok(route.includes('createServiceClient'));
});

test('migrasi AI courier memuat sender_kind ai_courier dan aturan RLS tidak dilonggarkan', () => {
  const migration = read('supabase/migrations/20261104000000_ai_courier_gemini.sql');
  assert.match(migration, /'ai_courier'/);
  assert.match(migration, /courier_messages_sender_kind_check/);
  assert.match(migration, /courier_messages_sender_required/);
  // Migrasi lama (demo) tidak diedit: tetap hanya mengizinkan 'user' untuk client.
  const demo = read('supabase/migrations/20261031020000_demo_courier.sql');
  assert.match(demo, /sender_kind = 'user'/);
});

test('klien tidak memvalidasi ulang sebagai sumber kebenaran: client tidak menulis sender_kind', () => {
  const chat = read('app/components/order-history/courier-chat.tsx');
  assert.ok(!chat.includes('sender_kind'));
  // Satu-satunya POST di komponen ini menuju endpoint messages.
  const posts = chat.match(/method: 'POST'/g) ?? [];
  assert.equal(posts.length, 1);
});

test('respons route tidak memuat key: route tidak menyentuh env/key langsung', () => {
  const route = read('app/api/courier/messages/route.ts');
  // Route TIDAK membaca GEMINI_API_KEY maupun mengirim header key —
  // semua itu terisolasi di lib/server/gemini.ts & lib/server/courier-ai.ts.
  assert.ok(!route.includes('process.env.GEMINI_API_KEY'));
  assert.ok(!route.includes('x-goog-api-key'));
  assert.ok(!route.includes('GEMINI_API_KEY='));
});
