/**
 * Test token usulan aksi chatbot (lib/chatbot/actions.ts).
 *
 * Kenapa tes ini penting melebihi tes biasa: token inilah satu-satunya yang
 * memisahkan "model mengusulkan" dari "data berubah". Kalau tanda tangan bisa
 * dipalsukan, diubah isinya, atau dipakai ulang oleh admin lain, maka seluruh
 * lapisan konfirmasi menjadi hiasan.
 *
 * Jalankan: node --test tests/chatbot-actions.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTION_TOKEN_TTL_MS,
  ActionTokenError,
  actionErrorMessage,
  resolveActionSecret,
  signAction,
  verifyAction,
} from '../lib/chatbot/actions.ts';

const ENV = { CHATBOT_ACTION_SECRET: 'rahasia-uji-yang-panjang' } as NodeJS.ProcessEnv;
const ADMIN_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ADMIN_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NOW = 1_700_000_000_000;

function makeToken(overrides?: Partial<Parameters<typeof signAction>[0]>) {
  return signAction({
    adminId: ADMIN_A,
    action: 'tolak_produk',
    payload: { produk_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
    reason: 'Foto produk tidak menampilkan makanan sebenarnya.',
    now: NOW,
    nonce: 'nonce-tetap',
    env: ENV,
    ...overrides,
  });
}

test('token yang sah dapat diverifikasi dan isinya utuh', () => {
  const { token, exp } = makeToken();

  assert.equal(exp, NOW + ACTION_TOKEN_TTL_MS);

  const payload = verifyAction(token, ADMIN_A, { now: NOW, env: ENV });
  assert.equal(payload.adminId, ADMIN_A);
  assert.equal(payload.action, 'tolak_produk');
  assert.equal(payload.payload.produk_id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  assert.match(payload.reason, /Foto produk/);
  assert.equal(payload.nonce, 'nonce-tetap');
});

test('tanda tangan yang diubah DITOLAK', () => {
  const { token } = makeToken();
  const parts = token.split('.');
  // Ubah satu karakter tanda tangan.
  const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -1)}A`;

  assert.throws(
    () => verifyAction(tampered, ADMIN_A, { now: NOW, env: ENV }),
    (err: unknown) => err instanceof ActionTokenError && err.code === 'bad-signature'
  );
});

test('isi token yang diubah DITOLAK karena tanda tangan tidak cocok', () => {
  const { token } = makeToken();
  const parts = token.split('.');

  // Ganti payload: admin minta "tolak", penyerang mengubahnya menjadi "setujui".
  const forgedBody = Buffer.from(
    JSON.stringify({
      adminId: ADMIN_A,
      action: 'setujui_produk',
      payload: { produk_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
      reason: 'disisipkan',
      exp: NOW + ACTION_TOKEN_TTL_MS,
      nonce: 'nonce-tetap',
    })
  ).toString('base64url');

  const forged = `${parts[0]}.${forgedBody}.${parts[2]}`;

  assert.throws(
    () => verifyAction(forged, ADMIN_A, { now: NOW, env: ENV }),
    (err: unknown) => err instanceof ActionTokenError && err.code === 'bad-signature',
    'mengubah isi harus merusak tanda tangan'
  );
});

test('token kedaluwarsa DITOLAK', () => {
  const { token } = makeToken();

  assert.throws(
    () => verifyAction(token, ADMIN_A, { now: NOW + ACTION_TOKEN_TTL_MS + 1, env: ENV }),
    (err: unknown) => err instanceof ActionTokenError && err.code === 'expired'
  );

  // Tepat pada batas masih boleh.
  const stillValid = verifyAction(token, ADMIN_A, { now: exp1(), env: ENV });
  assert.equal(stillValid.action, 'tolak_produk');

  function exp1() {
    return NOW + ACTION_TOKEN_TTL_MS;
  }
});

test('token milik admin lain DITOLAK', () => {
  const { token } = makeToken();

  assert.throws(
    () => verifyAction(token, ADMIN_B, { now: NOW, env: ENV }),
    (err: unknown) => err instanceof ActionTokenError && err.code === 'wrong-admin',
    'usulan admin A tidak boleh dieksekusi admin B'
  );
});

test('token cacat DITOLAK sebagai malformed', () => {
  for (const bad of ['', '   ', 'bukan-token', 'v1.hanya-dua-bagian', 'v2.a.b']) {
    assert.throws(
      () => verifyAction(bad, ADMIN_A, { now: NOW, env: ENV }),
      (err: unknown) => err instanceof ActionTokenError,
      `token "${bad}" harus ditolak`
    );
  }
});

test('kunci berbeda menghasilkan tanda tangan berbeda', () => {
  const a = makeToken();
  const b = makeToken({ env: { CHATBOT_ACTION_SECRET: 'rahasia-lain' } as NodeJS.ProcessEnv });

  assert.notEqual(a.token, b.token, 'kunci berbeda harus menghasilkan token berbeda');

  assert.throws(
    () => verifyAction(b.token, ADMIN_A, { now: NOW, env: ENV }),
    (err: unknown) => err instanceof ActionTokenError && err.code === 'bad-signature',
    'token yang dibuat dengan kunci lain tidak boleh diterima'
  );
});

test('tanpa secret sama sekali, penandatanganan gagal tertutup', () => {
  assert.throws(
    () => resolveActionSecret({} as NodeJS.ProcessEnv),
    (err: unknown) => err instanceof ActionTokenError && err.code === 'missing-secret',
    'tanpa kunci tidak boleh membuat token dengan kunci kosong'
  );
});

test('secret diturunkan dari service key bila CHATBOT_ACTION_SECRET kosong', () => {
  const env = { SUPABASE_SERVICE_ROLE_KEY: 'service-key-uji' } as NodeJS.ProcessEnv;
  const derived = resolveActionSecret(env);
  assert.ok(derived.length > 0);

  // Deterministik: nilai turunan sama setiap kali.
  const again = resolveActionSecret(env);
  assert.equal(derived.toString('utf8'), again.toString('utf8'));

  // Berbeda dari service key mentah — kunci turunan tidak boleh sama dengan induknya.
  assert.notEqual(derived.toString('utf8'), 'service-key-uji');
});

test('dua usulan identik tetap menghasilkan token berbeda (nonce)', () => {
  const a = signAction({
    adminId: ADMIN_A,
    action: 'setujui_produk',
    payload: { produk_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
    reason: 'sama',
    now: NOW,
    env: ENV,
  });
  const b = signAction({
    adminId: ADMIN_A,
    action: 'setujui_produk',
    payload: { produk_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' },
    reason: 'sama',
    now: NOW,
    env: ENV,
  });

  assert.notEqual(a.token, b.token, 'nonce harus membuat token unik');
});

test('pesan error untuk admin tidak membocorkan detail internal', () => {
  const cases: Array<[unknown, RegExp]> = [
    [new ActionTokenError('expired', 'exp internal'), /kedaluwarsa/i],
    [new ActionTokenError('wrong-admin', 'admin mismatch'), /bukan milik Anda/i],
    [new ActionTokenError('missing-secret', 'env kosong'), /belum dikonfigurasi/i],
    [new ActionTokenError('bad-signature', 'hmac fail'), /tidak sah/i],
    [new Error('boom'), /tidak dapat diproses/i],
  ];

  for (const [error, pattern] of cases) {
    const message = actionErrorMessage(error);
    assert.match(message, pattern);
    assert.ok(
      !message.includes('exp internal') &&
        !message.includes('admin mismatch') &&
        !message.includes('hmac fail'),
      'pesan tidak boleh membocorkan teks internal'
    );
  }
});
