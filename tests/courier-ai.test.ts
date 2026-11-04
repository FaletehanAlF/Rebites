/**
 * Kurir AI (Gemini) - pengujian lengkap.
 *
 * Yang dikunci (sesuai kriteria audit):
 *  1. Key tidak diatur -> fallback yang aman.
 *  2. Key salah / timeout / kuota habis / provider gagal -> error aman, tidak
 *     membocorkan rahasia; respons tidak pernah menyebut key.
 *  3. Pesanan demo sah -> Kurir AI aktif otomatis (decision murni + gate route).
 *  4. Pesanan kurir nyata -> tidak ada balasan AI otomatis.
 *  5. Bukan peserta -> ditolak (resolveParticipantRole + kontrak route).
 *  6. Pertanyaan lanjutan -> konteks riwayat terbawa & digabung per giliran.
 *  7. Pesanan berbeda -> riwayat tidak tercampur (route memfilter order_id).
 *  8. Pertanyaan di luar scope -> ditolak sopan (instruksi sistem).
 *  9. Status/ETA tidak diketahui -> AI tidak mengarang (instruksi sistem).
 *  10. Realtime/polling/retry -> tidak ada balasan ganda (dedup reply_to
 *     + unique partial index; polling tidak pernah POST).
 *  11. Aturan akses penjual vs pembeli.
 *  12. Perilaku chat lama tetap berjalan (user/demo_courier kompatibel).
 *
 * TIDAK memerlukan GEMINI_API_KEY asli: semua jaringan di-mock.
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
  resolveParticipantRole,
  decideAutoReplyMode,
  autoReplySenderKind,
} from '../lib/courier-auto-reply.ts';
import {
  HISTORY_MAX_MESSAGES,
  HISTORY_MAX_MESSAGE_CHARS,
  HISTORY_MAX_TOTAL_CHARS,
  buildHistoryContents,
  hasBuyerMessage,
} from '../lib/server/courier-history.ts';
import {
  resolveGeminiConfig,
  geminiGenerateContentUrl,
  geminiGetModelUrl,
  classifyGeminiHttpStatus,
  buildGenerateContentPayload,
  buildGenerateContentHeaders,
  extractGeminiText,
  sanitizeGeminiReply,
  generateCourierAiReply,
  checkGeminiConnection,
  isGeminiConfigured,
  GeminiNotConfiguredError,
  GeminiProviderError,
  GEMINI_DEFAULT_MODEL,
  GEMINI_ENDPOINT_BASE,
  GEMINI_MAX_REPLY_CHARS,
  COURIER_AI_SYSTEM_INSTRUCTION,
} from '../lib/server/gemini.ts';
import {
  generateDemoCourierAiReply,
  claimCourierAiSlot,
  COURIER_AI_LIMIT_USER,
} from '../lib/server/courier-ai.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');

const ENV_OK = { GEMINI_API_KEY: 'test-key-SECRET-DO-NOT-LEAK', GEMINI_MODEL: '' } as unknown as NodeJS.ProcessEnv;
const ENV_MODEL = { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'custom-model-1' } as unknown as NodeJS.ProcessEnv;

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
const okGemini = (text = 'Baik.') =>
  okResponse({ candidates: [{ content: { parts: [{ text }] } }] });
const userContent = (text: string) => [{ role: 'user' as const, parts: [{ text }] }];

// ---------------------------------------------------------------------------
// 1 & 12. Pemetaan sender_kind & kompatibilitas chat lama
// ---------------------------------------------------------------------------

test('pemetaan sender_kind: nilai dikenal dan fallback ke user', () => {
  assert.equal(normalizeCourierSenderKind('user'), 'user');
  assert.equal(normalizeCourierSenderKind('demo_courier'), 'demo_courier');
  assert.equal(normalizeCourierSenderKind('ai_courier'), 'ai_courier');
  assert.equal(normalizeCourierSenderKind('AI_COURIER'), 'user');
  assert.equal(normalizeCourierSenderKind('hacker'), 'user');
  assert.equal(normalizeCourierSenderKind(undefined), 'user');
});

test('label dan flag otomatis', () => {
  assert.equal(courierSenderLabel('ai_courier'), 'Kurir AI');
  assert.equal(courierSenderLabel('demo_courier'), 'Kurir Demo');
  assert.equal(courierSenderLabel('user'), 'Kurir');
  assert.equal(isAutomatedSenderKind('ai_courier'), true);
  assert.equal(isAutomatedSenderKind('demo_courier'), true);
  assert.equal(isAutomatedSenderKind('user'), false);
});

// ---------------------------------------------------------------------------
// 5 & 11. Siapa yang boleh memicu jalur otomatis
// ---------------------------------------------------------------------------

test('resolveParticipantRole: buyer menang; courier; seller; stranger', () => {
  assert.equal(
    resolveParticipantRole({ userId: 'u1', buyerId: 'u1', assignedCourierId: null }),
    'buyer'
  );
  assert.equal(
    resolveParticipantRole({ userId: 'u2', buyerId: 'u1', assignedCourierId: 'u2' }),
    'courier'
  );
  assert.equal(
    resolveParticipantRole({
      userId: 'u3',
      buyerId: 'u1',
      assignedCourierId: 'u2',
      sellerUserIds: ['u3'],
    }),
    'seller'
  );
  assert.equal(
    resolveParticipantRole({ userId: 'stranger', buyerId: 'u1', assignedCourierId: 'u2' }),
    'none'
  );
});

test('decideAutoReplyMode: demo hanya untuk buyer; AI bila terkonfigurasi', () => {
  assert.equal(
    decideAutoReplyMode({ role: 'buyer', isDemoOrder: true, geminiConfigured: true }),
    'ai'
  );
  assert.equal(
    decideAutoReplyMode({ role: 'buyer', isDemoOrder: true, geminiConfigured: false }),
    'fallback'
  );
  // Pesanan kurir nyata / non-buyer -> 'none' (tidak ada AI otomatis).
  assert.equal(
    decideAutoReplyMode({ role: 'buyer', isDemoOrder: false, geminiConfigured: true }),
    'none'
  );
  assert.equal(
    decideAutoReplyMode({ role: 'courier', isDemoOrder: true, geminiConfigured: true }),
    'none'
  );
  assert.equal(
    decideAutoReplyMode({ role: 'seller', isDemoOrder: true, geminiConfigured: true }),
    'none'
  );
  assert.equal(
    decideAutoReplyMode({ role: 'none', isDemoOrder: true, geminiConfigured: true }),
    'none'
  );
});

test('autoReplySenderKind (server-only, tidak dari klien)', () => {
  assert.equal(autoReplySenderKind('ai'), 'ai_courier');
  assert.equal(autoReplySenderKind('fallback'), 'demo_courier');
  assert.equal(autoReplySenderKind('none'), null);
});

// ---------------------------------------------------------------------------
// 6 & 7. Konteks riwayat percakapan
// ---------------------------------------------------------------------------

test('buildHistoryContents: urutan dipertahankan, peran digabung berurutan', () => {
  const rows = [
    { senderKind: 'user', body: 'halo' },
    { senderKind: 'user', body: 'kurir sudah sampai?' },
    { senderKind: 'ai_courier', body: 'Belum, pesanan masih disiapkan.' },
    { senderKind: 'ai_courier', body: 'Saya kabari lagi.' },
    { senderKind: 'user', body: 'oke' },
  ];
  const contents = buildHistoryContents(rows);
  assert.deepEqual(
    contents.map((c) => c.role),
    ['user', 'model', 'user']
  );
  assert.ok(contents[0].parts[0].text.includes('halo'));
  assert.ok(contents[0].parts[0].text.includes('kurir sudah sampai?'));
  assert.equal(contents[1].parts[0].text, 'Belum, pesanan masih disiapkan.\nSaya kabari lagi.');
  assert.equal(contents[2].parts[0].text, 'oke');
  assert.equal(hasBuyerMessage(contents), true);
});

test('buildHistoryContents: konteks tidak diawali giliran model tanpa user (regresi)', () => {
  // Skenario riil: sapaan otomatis (greeting Kurir Demo/AI) memotong konteks
  // sehingga giliran pertama adalah 'model' — payload begitu dapat ditolak
  // sebagian varian model Gemini.
  const contents = buildHistoryContents([
    { senderKind: 'demo_courier', body: 'Halo, saya Kurir Demo.' },
    { senderKind: 'ai_courier', body: 'Ada yang bisa dibantu?' },
    { senderKind: 'user', body: 'kurir sudah sampai?' },
  ]);
  assert.deepEqual(contents.map((c) => c.role), ['user']);
  assert.equal(contents[0].parts[0].text, 'kurir sudah sampai?');
  assert.equal(hasBuyerMessage(contents), true);
});

test('buildHistoryContents: riwayat hanya model -> kosong (AI tidak dipanggil)', () => {
  const contents = buildHistoryContents([
    { senderKind: 'ai_courier', body: 'salam' },
    { senderKind: 'demo_courier', body: 'salam lagi' },
  ]);
  assert.deepEqual(contents, []);
  assert.equal(hasBuyerMessage(contents), false);
});

test('buildHistoryContents: pesan asing dianggap user; kosong dibuang', () => {
  const contents = buildHistoryContents([
    { senderKind: 'hacker', body: 'pura-pura ai' },
    { senderKind: 'user', body: '   ' },
    { senderKind: 'user', body: 'halo' },
  ]);
  assert.equal(contents[0].role, 'user');
  assert.ok(contents[0].parts[0].text.includes('pura-pura ai'));
  assert.ok(contents[0].parts[0].text.includes('halo'));
});

test('buildHistoryContents: batas jumlah pesan dan karakter total', () => {
  const long = 'x'.repeat(HISTORY_MAX_MESSAGE_CHARS + 50);
  // Giliran bergantian agar tidak digabung satu sama lain.
  const rows = Array.from({ length: 12 }, (_, i) => ({
    senderKind: i % 2 === 0 ? 'user' : 'ai_courier',
    body: `msg${i}_${'y'.repeat(230)}`,
  }));
  const contents = buildHistoryContents(rows);
  const total = contents.reduce((acc, c) => acc + c.parts[0].text.length, 0);
  assert.ok(total <= HISTORY_MAX_TOTAL_CHARS, `total ${total} melebihi batas`);
  assert.ok(contents.length <= HISTORY_MAX_MESSAGES);
  assert.ok(contents[contents.length - 1].parts[0].text.startsWith('msg11_'));
  assert.equal(
    buildHistoryContents([{ senderKind: 'user', body: long }])[0].parts[0].text.length,
    HISTORY_MAX_MESSAGE_CHARS
  );
});

// ---------------------------------------------------------------------------
// 2. Konfigurasi & health-check; 8,9,13. Penanganan error provider
// ---------------------------------------------------------------------------

test('resolveGeminiConfig: tanpa key melempar not_configured; URL benar', () => {
  assert.throws(() => resolveGeminiConfig({} as NodeJS.ProcessEnv), GeminiNotConfiguredError);
  const cfg = resolveGeminiConfig(ENV_OK);
  assert.equal(cfg.model, GEMINI_DEFAULT_MODEL);
  assert.equal(cfg.url, geminiGenerateContentUrl(GEMINI_DEFAULT_MODEL));
  assert.equal(resolveGeminiConfig(ENV_MODEL).model, 'custom-model-1');
  assert.equal(isGeminiConfigured(ENV_OK), true);
  assert.equal(isGeminiConfigured({} as NodeJS.ProcessEnv), false);
  assert.equal(
    geminiGetModelUrl(GEMINI_DEFAULT_MODEL),
    `${GEMINI_ENDPOINT_BASE}/models/${GEMINI_DEFAULT_MODEL}`
  );
});

test('classifyGeminiHttpStatus: 401/403->invalid_key, 429->quota_exceeded, 404->model_unavailable, 500->provider_error', () => {
  assert.equal(classifyGeminiHttpStatus(401), 'invalid_key');
  assert.equal(classifyGeminiHttpStatus(403), 'invalid_key');
  assert.equal(classifyGeminiHttpStatus(429), 'quota_exceeded');
  assert.equal(classifyGeminiHttpStatus(400), 'provider_error');
  assert.equal(classifyGeminiHttpStatus(404), 'model_unavailable');
  assert.equal(classifyGeminiHttpStatus(500), 'provider_error');
});

test('buildGenerateContentPayload: memuat contents, tanpa key', () => {
  const contents = [
    { role: 'user' as const, parts: [{ text: 'halo' }] },
    { role: 'model' as const, parts: [{ text: 'baik' }] },
  ];
  const payload = buildGenerateContentPayload({
    orderCode: 'RB-1',
    orderStatus: 'processing',
    contents,
  }) as Record<string, unknown>;
  const serialized = JSON.stringify(payload);
  assert.ok(serialized.includes('halo'));
  assert.ok(!serialized.includes('test-key-SECRET-DO-NOT-LEAK'));
  assert.deepEqual(payload.contents, contents);
  const headers = buildGenerateContentHeaders('SECRET-KEY-XYZ');
  assert.equal(headers['x-goog-api-key'], 'SECRET-KEY-XYZ');
});

test('extractGeminiText & sanitizeGeminiReply: diblokir/kosong/bentuk asing ditangani aman', () => {
  assert.equal(
    extractGeminiText({ candidates: [{ content: { parts: [{ text: 'Halo!' }] } }] }),
    'Halo!'
  );
  assert.throws(
    () => extractGeminiText({ promptFeedback: { blockReason: 'SAFETY' } }),
    /memblokir/
  );
  assert.throws(() => extractGeminiText({ candidates: [] }), GeminiProviderError);
  assert.throws(() => extractGeminiText(null), GeminiProviderError);

  assert.equal(sanitizeGeminiReply('Halo  dunia'), 'Halo dunia');
  assert.throws(() => sanitizeGeminiReply('   '), GeminiProviderError);
  const long = 'x'.repeat(GEMINI_MAX_REPLY_CHARS + 50);
  assert.equal(sanitizeGeminiReply(long).length, GEMINI_MAX_REPLY_CHARS);
});

test('generateCourierAiReply: sukses; 500/JSON rusak/timeout -> error terpetakan, key tidak bocor', async () => {
  const ok = await generateCourierAiReply(
    {
      orderCode: 'RB-1',
      orderStatus: 'processing',
      contents: userContent('halo'),
    },
    { fetchImpl: async () => okGemini('Sampai nanti, ya!'), env: ENV_OK }
  );
  assert.equal(ok, 'Sampai nanti, ya!');

  const fail500 = async () => new Response('boom', { status: 500 });
  await assert.rejects(
    async () =>
      generateCourierAiReply(
        { orderCode: 'RB-1', orderStatus: 'processing', contents: userContent('m') },
        { fetchImpl: fail500 as unknown as typeof fetch, env: ENV_OK }
      ),
    (err: unknown) =>
      err instanceof GeminiProviderError &&
      err.reason === 'provider_error' &&
      !err.message.includes('boom') &&
      !err.message.includes('test-key')
  );

  const badJson = async () => new Response('not-json', { status: 200 });
  await assert.rejects(
    async () =>
      generateCourierAiReply(
        { orderCode: 'RB-1', orderStatus: 'processing', contents: userContent('m') },
        { fetchImpl: badJson as unknown as typeof fetch, env: ENV_OK }
      ),
    (err: unknown) => err instanceof GeminiProviderError && err.reason === 'invalid_response'
  );

  const aborted = async () => {
    const err = new Error('The operation was aborted due to timeout');
    err.name = 'AbortError';
    throw err;
  };
  await assert.rejects(
    async () =>
      generateCourierAiReply(
        { orderCode: 'RB-1', orderStatus: 'processing', contents: userContent('m') },
        { fetchImpl: aborted as unknown as typeof fetch, env: ENV_OK }
      ),
    (err: unknown) => err instanceof GeminiProviderError && err.reason === 'timeout'
  );
});

test('checkGeminiConnection: 200 ok; 401 invalid_key; 404 model_unavailable; tanpa key = not_configured', async () => {
  const ok = await checkGeminiConnection({
    fetchImpl: async () => new Response('{}', { status: 200 }),
    env: ENV_OK,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.model, GEMINI_DEFAULT_MODEL);

  const badKey = await checkGeminiConnection({
    fetchImpl: async () => new Response('{}', { status: 401 }),
    env: ENV_OK,
  });
  assert.equal(badKey.ok, false);
  if (!badKey.ok) assert.equal(badKey.reason, 'invalid_key');

  const missingModel = await checkGeminiConnection({
    fetchImpl: async () => new Response('{}', { status: 404 }),
    env: { GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'model-tidak-ada' } as unknown as NodeJS.ProcessEnv,
  });
  assert.equal(missingModel.ok, false);
  if (!missingModel.ok) assert.equal(missingModel.reason, 'model_unavailable');

  const noEnv = await checkGeminiConnection({ env: {} as NodeJS.ProcessEnv });
  assert.equal(noEnv.ok, false);
  if (!noEnv.ok) assert.equal(noEnv.reason, 'not_configured');

  // Output tidak pernah memuat nilai key.
  const raw = JSON.stringify([ok, badKey, missingModel, noEnv]);
  assert.ok(!raw.includes('test-key'));
});

test('test:gemini-connection tidak gagal saat .env.local belum ada (regresi)', () => {
  const pkg = JSON.parse(read('package.json')) as {
    scripts?: Record<string, string>;
  };
  const cmd = pkg.scripts?.['test:gemini-connection'] ?? '';
  assert.ok(cmd.startsWith('node '));
  // Flag --env-file membuat perintah gagal ketika file belum ada; memuat env
  // harus dilakukan skrip sendiri (bila ada), bukan lewat flag Node.
  assert.ok(!cmd.includes('--env-file'));
  const script = read('scripts/check-gemini-connection.ts');
  assert.match(script, /tryLoadProjectEnv/);
  assert.match(script, /existsSync/);
});

// ---------------------------------------------------------------------------
// 2 & 3. Orkestrasi: konfigurasi, rate limit, fallback ramah
// ---------------------------------------------------------------------------

test('generateDemoCourierAiReply: key tidak diatur -> not_configured (fallback aman)', async () => {
  const out = await generateDemoCourierAiReply(
    {
      userId: 'u-noconfig',
      orderCode: 'RB-1',
      orderStatus: 'processing',
      contents: userContent('halo'),
    },
    { env: {} as NodeJS.ProcessEnv }
  );
  assert.equal(out.ok, false);
  if (!out.ok) assert.equal(out.reason, 'not_configured');
});

test('generateDemoCourierAiReply: sukses; 429 -> provider_failed + quota_exceeded', async () => {
  const okFetch = async () => okGemini('Siap, pesanan diantar.');
  const out = await generateDemoCourierAiReply(
    {
      userId: `u-ok-${Date.now()}`,
      orderCode: 'RB-2',
      orderStatus: 'out_for_delivery',
      contents: userContent('sudah sampai?'),
    },
    { fetchImpl: okFetch as unknown as typeof fetch, env: ENV_OK }
  );
  assert.equal(out.ok, true);
  if (out.ok) assert.equal(out.reply, 'Siap, pesanan diantar.');

  const quotaFetch = async () => new Response('{}', { status: 429 });
  const out2 = await generateDemoCourierAiReply(
    {
      userId: `u-quota-${Date.now()}`,
      orderCode: 'RB-2',
      orderStatus: 'processing',
      contents: userContent('lagi'),
    },
    { fetchImpl: quotaFetch as unknown as typeof fetch, env: ENV_OK }
  );
  assert.equal(out2.ok, false);
  if (!out2.ok) {
    assert.equal(out2.reason, 'provider_failed');
    assert.equal(out2.providerReason, 'quota_exceeded');
    assert.ok(!out2.message.includes('test-key'));
  }
});

test('rate limit: kuota per pengguna; melebihi ditolak', () => {
  const userId = `u-rate-${Date.now()}`;
  for (let i = 0; i < COURIER_AI_LIMIT_USER; i += 1) {
    assert.equal(claimCourierAiSlot(userId).allowed, true);
  }
  const limited = claimCourierAiSlot(userId);
  assert.equal(limited.allowed, false);
  assert.ok(limited.retryAfterSeconds >= 1);
});

// ---------------------------------------------------------------------------
// 4, 10. Route: gating demo, peserta, dan dedup balasan
// ---------------------------------------------------------------------------

test('route: balasan otomatis hanya di jalur is_demo; sender_kind tidak dari body', () => {
  const route = read('app/api/courier/messages/route.ts');
  assert.ok(route.includes('delivery_assignments'), 'harus cek assignment');
  assert.ok(route.includes('is_demo'), 'harus cek is_demo dari DB');
  assert.ok(!route.includes('body.sender_kind'));
  assert.ok(!route.includes("headers.get('sender_kind')"));
  assert.ok(route.includes("sender_kind: 'user'"));
  assert.ok(route.includes("'ai_courier'"));
  assert.ok(route.includes('createServiceClient'));
  assert.ok(route.includes('createAuthedServerClient'));
});

test('route: retry ganda tidak membuat balasan kedua (reply_to_message_id + 23505)', () => {
  const route = read('app/api/courier/messages/route.ts');
  assert.ok(route.includes('reply_to_message_id'));
  assert.ok(route.includes('insertAutomatedReply'));
  assert.ok(route.includes('already_answered'));
  assert.ok(route.includes('23505'));
});

test('migrasi dedup: kolom reply_to_message_id + unique partial index', () => {
  const sql = read('supabase/migrations/20261105000000_courier_ai_reply_dedup.sql');
  assert.match(sql, /reply_to_message_id/);
  assert.match(sql, /CREATE UNIQUE INDEX/i);
  assert.match(sql, /sender_kind IN \('ai_courier', 'demo_courier'\)/);
});

test('migrasi 20261104: ai_courier diizinkan; migrasi demo lama tidak dilonggarkan', () => {
  const sql = read('supabase/migrations/20261104000000_ai_courier_gemini.sql');
  assert.match(sql, /'ai_courier'/);
  assert.match(sql, /courier_messages_sender_kind_check/);
  const demo = read('supabase/migrations/20261031020000_demo_courier.sql');
  assert.match(demo, /sender_kind = 'user'/);
});

test('route: penjual tidak bisa menulis sebelum insert; penjaga peserta mendahului', () => {
  const route = read('app/api/courier/messages/route.ts');
  const guard = route.indexOf('Anda bukan peserta percakapan pesanan ini');
  const insertIdx = route.indexOf("sender_kind: 'user'");
  assert.ok(guard > 0 && insertIdx > guard, 'penjaga peserta harus mendahului insert');
});

test('route: riwayat dimuat dengan filter order_id (tidak tercampur pesanan lain)', () => {
  const route = read('app/api/courier/messages/route.ts');
  assert.ok(route.includes(".eq('order_id', orderId)"));
  assert.ok(route.includes('loadCourierHistory(service, orderId)'));
});

test('client tidak bisa memalsukan ai_courier (tidak tulis sender_kind)', () => {
  const chat = read('app/components/order-history/courier-chat.tsx');
  assert.ok(!chat.includes('sender_kind'));
  const posts = chat.match(/method: 'POST'/g) ?? [];
  assert.equal(posts.length, 1);
});

test('komponen chat: hanya 2 fetch (GET refresh + POST kirim)', () => {
  const chat = read('app/components/order-history/courier-chat.tsx');
  const fetches = chat.match(/fetchWithAuth\(/g) ?? [];
  assert.equal(fetches.length, 2);
});

// ---------------------------------------------------------------------------
// 8 & 9. Ruang lingkup Kurir AI
// ---------------------------------------------------------------------------

test('instruksi sistem: tolak sopan di luar scope pengantaran', () => {
  assert.match(COURIER_AI_SYSTEM_INSTRUCTION, /di luar/i);
  assert.match(COURIER_AI_SYSTEM_INSTRUCTION, /[Tt]olak/);
  assert.match(COURIER_AI_SYSTEM_INSTRUCTION, /pengantaran/i);
});

test('instruksi sistem: JANGAN mengarang ETA/lokasi/status', () => {
  assert.match(COURIER_AI_SYSTEM_INSTRUCTION, /JANGAN pernah mengarang/);
  assert.match(COURIER_AI_SYSTEM_INSTRUCTION, /ETA/);
  assert.match(COURIER_AI_SYSTEM_INSTRUCTION, /posisi kurir/);
});

test('instruksi sistem: tidak meminta kredensial', () => {
  assert.match(COURIER_AI_SYSTEM_INSTRUCTION, /kata sandi|OTP/i);
});
