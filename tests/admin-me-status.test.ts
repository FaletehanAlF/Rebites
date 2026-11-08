/**
 * Regresi status Super Admin ReBites — lokal, tanpa database, tanpa jaringan.
 *
 * MASALAH YANG DIJAGA: `useAdminMe()` dulu menyimpan `me = null` untuk semua
 * kegagalan. Saat jaringan/server terganggu, panel menampilkan "bukan admin"
 * (label "Tidak terverifikasi", form permintaan hilang, tombol sanksi hilang)
 * padahal pengguna mungkin Super Admin yang sah.
 *
 * Yang dibuktikan di sini:
 * 1. `classifyAdminMeFailure` memetakan 401/403 → `unverified`, sedangkan
 *    5xx/503/timeout/jaringan → `error` (bukan penolakan hak akses).
 * 2. `withTimeout` benar-benar menolak saat operasi menggantung, dan
 *    meneruskan nilai/penolakan asli bila selesai lebih dulu.
 * 3. Hook memakai klasifikasi itu, punya `retry()`, penjaga respons basi, dan
 *    TIDAK pernah mengisi `me` saat gagal (fail-closed).
 * 4. Semua pemanggil membedakan status `error` dari "bukan Super Admin".
 *
 * KETERBATASAN (jujur): tes unit + source-guard. Tidak ada browser, Supabase,
 * atau jaringan yang dijalankan di sini; hook React tidak dieksekusi.
 *
 * Jalankan: node --test tests/admin-me-status.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  ADMIN_ME_ERROR_MESSAGE,
  classifyAdminMeFailure,
} from '../lib/admin-me-status.ts';
import { OperationTimeoutError, withTimeout } from '../lib/async-timeout.ts';

function readProjectFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}

// ---------------------------------------------------------------------------
// 1. Klasifikasi kegagalan
// ---------------------------------------------------------------------------

test('classifyAdminMeFailure: sesi tidak valid dan non-admin tetap "unverified"', () => {
  assert.equal(classifyAdminMeFailure({ status: 401 }).status, 'unverified');
  assert.equal(classifyAdminMeFailure({ status: 403 }).status, 'unverified');
  // Keputusan pasti tidak membawa pesan gangguan.
  assert.equal(classifyAdminMeFailure({ status: 401 }).message, null);
  assert.equal(classifyAdminMeFailure({ status: 403 }).message, null);
});

test('classifyAdminMeFailure: gangguan server bukan penolakan hak akses', () => {
  for (const status of [500, 502, 503, 504]) {
    const failure = classifyAdminMeFailure({ status });
    assert.equal(failure.status, 'error', `status HTTP ${status} harus error`);
    assert.equal(failure.message, ADMIN_ME_ERROR_MESSAGE);
  }
});

test('classifyAdminMeFailure: kegagalan jaringan/timeout bukan penolakan hak akses', () => {
  const networkErrors = [
    new TypeError('Failed to fetch'),
    Object.assign(new Error('fetch failed'), { name: 'AuthRetryableFetchError', status: 0 }),
    new OperationTimeoutError(15_000),
    undefined,
    null,
    'bukan error',
  ];
  for (const err of networkErrors) {
    const failure = classifyAdminMeFailure(err);
    assert.equal(failure.status, 'error', `${String(err)} harus error`);
    assert.equal(failure.message, ADMIN_ME_ERROR_MESSAGE);
  }
});

test('classifyAdminMeFailure: tidak pernah memberi status verified dari sebuah error', () => {
  const inputs: unknown[] = [
    { status: 400 },
    { status: 401 },
    { status: 403 },
    { status: 500 },
    { status: 503 },
    { status: 0 },
    {},
    new Error('x'),
  ];
  for (const err of inputs) {
    assert.notEqual(classifyAdminMeFailure(err).status, 'verified');
  }
});

// ---------------------------------------------------------------------------
// 2. withTimeout (dijalankan sungguhan)
// ---------------------------------------------------------------------------

test('withTimeout: meneruskan nilai asli bila selesai sebelum batas waktu', async () => {
  assert.equal(await withTimeout(Promise.resolve('ok'), 1_000), 'ok');
});

test('withTimeout: menolak dengan OperationTimeoutError saat operasi menggantung', async () => {
  const never = new Promise<string>(() => {});
  await assert.rejects(withTimeout(never, 10), (err: unknown) => {
    return err instanceof OperationTimeoutError && err.name === 'OperationTimeoutError';
  });
});

test('withTimeout: penolakan asli diteruskan, bukan ditelan', async () => {
  const boom = Object.assign(new Error('gagal'), { status: 503 });
  await assert.rejects(withTimeout(Promise.reject(boom), 1_000), (err: unknown) => {
    return err === boom;
  });
});

// ---------------------------------------------------------------------------
// 3. Hook: kontrak status, retry, dan penjaga respons basi
// ---------------------------------------------------------------------------

test('useAdminMe: memisahkan loading/verified/unverified/error', () => {
  const source = readProjectFile('hooks/use-admin-me.ts');
  const statusModule = readProjectFile('lib/admin-me-status.ts');

  // Keempat status didefinisikan di modul murni dan dipakai hook lewat tipe,
  // bukan disalin sebagai literal.
  for (const status of ['loading', 'verified', 'unverified', 'error']) {
    assert.match(
      statusModule,
      new RegExp(`'${status}'`),
      `status ${status} harus didefinisikan di lib/admin-me-status.ts`
    );
  }
  assert.match(source, /type AdminMeStatus/);
  assert.match(source, /status: 'loading', errorMessage: null/);
  assert.match(source, /classifyAdminMeFailure\(err\)/);
  // `me` hanya diisi dari respons sukses.
  assert.match(source, /setState\(\{ me, status: 'verified', errorMessage: null \}\)/);
  // Semua jalur gagal menulis `me: null` (fail-closed), tanpa memberi akses.
  assert.match(source, /me: null,\s*status: failure\.status/);
  assert.match(source, /withTimeout\(fetchAdminMe\(\), ADMIN_ME_TIMEOUT_MS\)/);
  assert.match(source, /loading: state\.status === 'loading'/);
});

test('useAdminMe: retry tersedia dan hasil percobaan lama diabaikan', () => {
  const source = readProjectFile('hooks/use-admin-me.ts');
  assert.match(source, /const retry = useCallback\(/);
  assert.match(source, /setAttempt\(\(value\) => value \+ 1\)/);
  // Penjaga respons basi: id percobaan dibandingkan sebelum menulis state.
  assert.match(source, /const requestId = requestIdRef\.current \+ 1/);
  assert.match(source, /if \(!isCurrent\(\)\) return;/);
  const guards = source.match(/if \(!isCurrent\(\)\) return;/g) ?? [];
  assert.ok(guards.length >= 2, 'sukses dan gagal sama-sama harus dijaga');
  assert.doesNotMatch(source, /\.catch\(\(\) => \{\s*if \(mounted\) setState\(\{ loading: false, me: null \}\)/);
});

test('useRequireAdmin memakai helper timeout bersama, bukan salinan', () => {
  const source = readProjectFile('hooks/use-require-admin.ts');
  assert.match(source, /from "@\/lib\/async-timeout"/);
  assert.match(source, /withTimeout\(/);
  assert.doesNotMatch(source, /function withTimeout<T>\(/);
  assert.doesNotMatch(source, /class AdminCheckTimeoutError/);
});

test('fetchAdminMe: refresh 1x + retry 1x, bukan token sekali pakai', () => {
  // Regresi: dengan getAdminAuthHeader, token yang masuk refresh window
  // menghasilkan 401 → hook menyimpulkan "bukan Super Admin" untuk sesi yang
  // sebenarnya masih dapat dipulihkan.
  const source = readProjectFile('lib/admin-me.ts');
  assert.match(source, /fetchAdminWithAuth\('\/api\/admin\/me'/);
  assert.match(source, /instanceof AuthError/);
  assert.doesNotMatch(source, /getAdminAuthHeader/);
  assert.doesNotMatch(source, /AdminAuthError/);
});

// ---------------------------------------------------------------------------
// 4. Pemanggil membedakan "gagal diperiksa" dari "bukan Super Admin"
// ---------------------------------------------------------------------------

test('pemakai hook: akses Super Admin tidak disimpulkan saat pemeriksaan gagal', () => {
  const consumers = [
    'app/components/admin/role-requests-view.tsx',
    'app/components/admin/user-role-editor.tsx',
    'app/components/admin/sanction-decision-modal.tsx',
  ];

  for (const file of consumers) {
    const source = readProjectFile(file);
    assert.match(source, /status: accessStatus/, `${file} harus membaca status hook`);
    assert.match(source, /retry: retryAccess/, `${file} harus menyediakan retry`);
    assert.match(source, /accessStatus === 'error'/, `${file} harus membedakan error`);
    // Tombol retry benar-benar terpasang pada handler hook.
    assert.match(source, /onClick=\{retryAccess\}/, `${file} tombol retry belum terpasang`);
    // Gating akses tetap eksplisit memeriksa isSuperAdmin === true.
    assert.match(source, /me\?\.isSuperAdmin === true/);
  }
});

test('halaman pengaturan tidak menulis "Tidak terverifikasi" saat pemeriksaan gagal', () => {
  const source = readProjectFile('app/dashboard/admin/pengaturan/page.tsx');
  assert.match(
    source,
    /adminMe\.status === 'error'[\s\S]{0,200}'Tidak dapat diperiksa'/
  );
});

test('halaman pengaturan: tombol retry terpasang pada pemeriksaan Super Admin yang ada', () => {
  const source = readProjectFile('app/dashboard/admin/pengaturan/page.tsx');

  // Memakai mekanisme pemeriksaan yang sudah ada — bukan fetch/helper baru.
  assert.match(source, /adminMe\.retry\(\)/);
  assert.doesNotMatch(source, /fetchAdminMe\(/, 'tidak boleh memanggil API langsung');
  // Tombol nyata, bukan tautan: dapat difokus dan diaktifkan keyboard.
  assert.match(source, /onClick=\{handleRetryAdminMe\}/);
  assert.match(source, /<Button[\s\S]{0,400}onClick=\{handleRetryAdminMe\}/);
  assert.doesNotMatch(source, /<a [^>]*onClick=\{handleRetryAdminMe\}/);
  // Status loading saat retry berjalan.
  assert.match(source, /disabled=\{adminMe\.loading\}/);
  assert.match(source, /aria-busy=\{adminMe\.loading\}/);
  assert.match(source, /'Memeriksa…'/);
  // Penjaga klik berulang: satu request per retry, bukan dua.
  assert.match(source, /const accessRetryGuard = useRef\(false\)/);
  assert.match(source, /if \(accessRetryGuard\.current \|\| adminMe\.loading\) return;/);
  // Blok error + retry hanya muncul saat gagal (atau sedang mengulang).
  assert.match(source, /\{\(adminMe\.status === 'error' \|\| \(accessRetrying && adminMe\.loading\)\) && \(/);
  assert.match(source, /role="alert"/);
  // Tidak memberi hak Super Admin sebelum terverifikasi.
  assert.doesNotMatch(source, /adminMe\.status === 'error'[\s\S]{0,80}isSuperAdmin = true/);
});

test('role requests: blok error akses dirender SEBELUM tabel', () => {
  const source = readProjectFile('app/components/admin/role-requests-view.tsx');

  const errorIdx = source.indexOf("{accessStatus === 'error' && (");
  const tableIdx = source.indexOf('<AdminTableCard label="Daftar permintaan role"');
  assert.ok(errorIdx >= 0, 'blok error akses harus ada');
  assert.ok(tableIdx >= 0, 'tabel harus ada');
  assert.ok(errorIdx < tableIdx, 'blok error harus muncul sebelum tabel');

  // Hanya satu blok error akses (tidak ada salinan yang tertinggal di bawah).
  const blocks = source.match(/\{accessStatus === 'error' && \(/g) ?? [];
  assert.equal(blocks.length, 1, 'blok error akses tidak boleh diduplikasi');

  // Tombol retry tetap terpasang pada mekanisme yang ada.
  assert.match(source, /onClick=\{retryAccess\}/);
  assert.match(source, /role="alert"/);
});

test('sidebar penjual hanya menautkan Panel Admin untuk akun ber-role admin', () => {
  const source = readProjectFile('app/components/dashboard-penjual/Sidebar.tsx');
  // Role dibaca dari profiles sendiri; bukan /api/admin/me yang selalu 403
  // untuk penjual biasa dan memenuhi log dengan penolakan yang wajar.
  assert.match(source, /useIsAdminAccount/);
  assert.match(source, /\{isAdmin && \(/);
  assert.doesNotMatch(source, /useAdminMe/);
});
