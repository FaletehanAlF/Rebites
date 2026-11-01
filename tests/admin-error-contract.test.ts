/**
 * Regresi kontrak error admin ReBites — lokal, tanpa database, tanpa jaringan.
 *
 * Membuktikan tanpa Supabase:
 * - Kegagalan query (termasuk kegagalan transport PostgREST yang TIDAK
 *   melempar) tidak berubah menjadi statistik palsu bernilai nol.
 * - Gangguan upstream diklasifikasikan sebagai "unavailable" (→ 503), dan
 *   penolakan PostgREST yang sah (punya `code`) TIDAK ikut dianggap 503.
 * - Penolakan token (AuthApiError 4xx) tetap 401, bukan 503 — supaya admin
 *   tidak terlempar ke halaman login saat jaringannya yang bermasalah.
 * - Sanitasi istilah pencarian membuang karakter struktur filter PostgREST
 *   (koma, kurung, %) tanpa merusak pencarian biasa.
 * - Route admin tidak lagi mengirim pesan exception mentah ke client.
 *
 * KETERBATASAN (jujur): modul route Next tidak dapat dijalankan langsung di
 * node:test (alias '@/', next/server, sesi Supabase asli). Untuk route, tes
 * memakai source-guard seperti pola `tests/admin-access.test.ts`; perilaku
 * yang dapat diuji langsung diuji langsung, bukan lewat pencocokan teks.
 *
 * Jalankan: node --test tests/admin-error-contract.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  SupabaseUnavailableError,
  firstFailedQuery,
  isSupabaseUnavailable,
  isTransportFailure,
} from '../lib/server/supabase-errors.ts';
import {
  isStructuralSafe,
  sanitizeSearchTerm,
  sanitizeSearchTermKeepingWords,
} from '../lib/filter-search.ts';

function readProjectFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}

// ---------------------------------------------------------------------------
// 1. Klasifikasi gangguan upstream
// ---------------------------------------------------------------------------

test('isSupabaseUnavailable: SupabaseUnavailableError dikenali sebagai gangguan upstream', () => {
  // Inilah bug aslinya: error ini dilempar getUserFromBearer(), tetapi
  // klasifikator hanya memeriksa `name` mentah milik Supabase sehingga
  // pembungkusan justru membuat route menjawab 500, bukan 503.
  assert.equal(isSupabaseUnavailable(new SupabaseUnavailableError(new Error('boom'))), true);
});

test('isSupabaseUnavailable: bentuk nyata PostgREST saat TLS/DNS gagal dianggap gangguan', () => {
  // Bentuk yang benar-benar dikembalikan postgrest-js (shouldThrowOnError=false):
  // nilai biasa, bukan exception. `code` kosong.
  assert.equal(
    isSupabaseUnavailable({
      message: 'TypeError: fetch failed',
      details: 'unable to verify the first certificate (UNABLE_TO_VERIFY_LEAF_SIGNATURE)',
      code: '',
    }),
    true
  );
  assert.equal(isSupabaseUnavailable({ message: 'fetch failed', code: '' }), true);
  assert.equal(isSupabaseUnavailable({ message: 'getaddrinfo ENOTFOUND db.example', code: '' }), true);
  assert.equal(isSupabaseUnavailable({ message: 'The operation timed out', code: '', name: 'TimeoutError' }), true);
});

test('isSupabaseUnavailable: penolakan PostgREST yang sah TIDAK dianggap gangguan upstream', () => {
  // Penolakan asli selalu membawa `code`. Kalau ini ikut jadi 503, bug RLS
  // atau drift schema akan tersamar sebagai "coba lagi nanti".
  const rejections = [
    { message: 'permission denied for table profiles', code: '42501' },
    { message: 'relation "public.warnings" does not exist', code: '42P01' },
    { message: 'JSON object requested, multiple rows returned', code: 'PGRST116' },
    { message: 'duplicate key value violates unique constraint', code: '23505' },
  ];
  for (const err of rejections) {
    assert.equal(isSupabaseUnavailable(err), false, `seharusnya bukan unavailable: ${err.code}`);
  }
});

test('isSupabaseUnavailable: penolakan token tetap 401, bukan 503', () => {
  // AuthApiError (status 4xx) = token memang ditolak. Menerjemahkannya ke 503
  // akan menyembunyikan sesi kedaluwarsa.
  assert.equal(
    isSupabaseUnavailable({ name: 'AuthApiError', status: 403, message: 'invalid claim: missing sub claim' }),
    false
  );
  assert.equal(
    isSupabaseUnavailable({ name: 'AuthApiError', status: 401, message: 'invalid JWT' }),
    false
  );
  // AuthRetryableFetchError (status 0) = jaringan, bukan penolakan.
  assert.equal(
    isSupabaseUnavailable({ name: 'AuthRetryableFetchError', status: 0, message: 'fetch failed' }),
    true
  );
});

test('isSupabaseUnavailable: nilai aneh tidak melempar dan tidak salah klasifikasi', () => {
  for (const value of [null, undefined, 0, '', false, [], 'fetch failed', {}, { code: '42501' }]) {
    assert.doesNotThrow(() => isSupabaseUnavailable(value));
    assert.equal(isSupabaseUnavailable(value), false, `nilai ${String(value)} bukan gangguan upstream`);
  }
});

test('isTransportFailure: butuh pesan transport DAN code kosong', () => {
  assert.equal(isTransportFailure({ message: 'fetch failed', code: '' }), true);
  assert.equal(isTransportFailure({ message: 'fetch failed', code: '42501' }), false);
  assert.equal(isTransportFailure({ message: 'semua baik', code: '' }), false);
  assert.equal(isTransportFailure({ code: '' }), false);
  assert.equal(isTransportFailure(null), false);
});

// ---------------------------------------------------------------------------
// 2. Kegagalan query tidak menjadi statistik nol
// ---------------------------------------------------------------------------

test('firstFailedQuery: query sukses dengan count nol BUKAN kegagalan', () => {
  // Kasus yang harus tetap sah: tabel memang kosong.
  const ok = [
    ['profiles total', { count: 0, data: null, error: null }],
    ['orders today', { count: 0, data: null, error: null }],
  ] as const;
  assert.equal(firstFailedQuery(ok), null);
});

test('firstFailedQuery: query sukses dengan data juga bukan kegagalan', () => {
  const ok = [
    ['profiles total', { count: 7, data: null, error: null }],
    ['warnings', { data: [{ user_id: 'a', warning_level: 1 }], error: null }],
  ] as const;
  assert.equal(firstFailedQuery(ok), null);
});

test('firstFailedQuery: error PostgREST terdeteksi dan menyebut query mana yang gagal', () => {
  const failed = firstFailedQuery([
    ['profiles total', { count: 0, data: null, error: null }],
    ['orders 14d', { data: null, error: { message: 'TypeError: fetch failed', code: '' } }],
    ['warnings', { data: null, error: { message: 'permission denied', code: '42501' } }],
  ] as const);
  assert.notEqual(failed, null);
  assert.equal(failed?.label, 'orders 14d');
});

test('firstFailedQuery: tidak ada kegagalan pada daftar kosong', () => {
  assert.equal(firstFailedQuery([]), null);
});

test('firstFailedQuery: hasil null/undefined tidak dianggap gagal', () => {
  assert.equal(firstFailedQuery([['x', null], ['y', undefined]] as const), null);
});

test('dashboard route: memakai firstFailedQuery dan berhenti sebelum menyusun statistik', () => {
  // Source-guard: route Next tidak dapat dijalankan di node:test.
  const route = readProjectFile('app/api/admin/dashboard/route.ts');

  assert.match(route, /firstFailedQuery\(/);
  // Kegagalan harus menghasilkan respons, bukan lanjut menghitung nol.
  assert.match(route, /if \(failed\) \{/);
  assert.match(route, /queryFailureResponse\(failed\.error, /);
  // `count ?? 0` hanya boleh muncul SETELAH pemeriksaan kegagalan.
  const failureIdx = route.indexOf('firstFailedQuery(');
  const firstZeroIdx = route.indexOf('.count ?? 0');
  assert.ok(failureIdx >= 0 && firstZeroIdx > failureIdx, 'count ?? 0 harus berada setelah pemeriksaan kegagalan');
});

test('dashboard route: autentikasi & otorisasi admin tidak dilonggarkan', () => {
  const route = readProjectFile('app/api/admin/dashboard/route.ts');
  assert.match(route, /getAdminUser\(authHeader\)/);
  assert.match(route, /status: user \? 403 : 401/);
  assert.match(route, /createAuthedServerClient\(authHeader\)/);
});

// ---------------------------------------------------------------------------
// 3. Sanitasi istilah pencarian (manipulasi sintaks filter PostgREST)
// ---------------------------------------------------------------------------

test('sanitizeSearchTerm: pencarian biasa dipertahankan', () => {
  assert.equal(sanitizeSearchTerm('kopi susu'), 'kopi susu');
  assert.equal(sanitizeSearchTerm('  Kopi  '), 'Kopi');
  assert.equal(sanitizeSearchTerm('warung-nasi_2'), 'warung-nasi_2');
  assert.equal(sanitizeSearchTerm('kafé'), 'kafé');
});

test('sanitizeSearchTerm: input kosong/null menjadi string kosong', () => {
  for (const value of [null, undefined, '', '   ']) {
    assert.equal(sanitizeSearchTerm(value), '');
  }
});

test('sanitizeSearchTerm: koma dan kurung dibuang (tidak bisa menambah kondisi or())', () => {
  // `or=(a,b)` memakai koma sebagai pemisah kondisi: koma dari input pengguna
  // akan menyisipkan kondisi filter tambahan bila dibiarkan.
  const injected = sanitizeSearchTerm('kopi,status.eq.resolved');
  assert.equal(isStructuralSafe(injected), true);
  assert.ok(!injected.includes(','));
  assert.ok(!injected.includes('('));
  assert.ok(!injected.includes(')'));

  const grouped = sanitizeSearchTerm('a(b)c');
  assert.equal(grouped, 'abc');
});

test('sanitizeSearchTerm: wildcard % dibuang agar pencarian literal', () => {
  assert.equal(sanitizeSearchTerm('%'), '');
  assert.equal(sanitizeSearchTerm('kopi%'), 'kopi');
  assert.equal(sanitizeSearchTerm('%a%b%'), 'ab');
});

test('sanitizeSearchTerm: panjang dibatasi sebelum karakter struktur dibuang', () => {
  const long = 'a'.repeat(500);
  assert.equal(sanitizeSearchTerm(long, 100).length, 100);
  assert.equal(sanitizeSearchTerm(long).length, 100); // default 100
  assert.equal(sanitizeSearchTerm('abcdef', 3), 'abc');
});

test('sanitizeSearchTerm: urutan trim-lalu-potong dipertahankan (perilaku asli)', () => {
  // Regresi T-2: implementasi sebelumnya memotong DULU baru trim, sehingga
  // masukan berawalan spasi panjang kehilangan karakter yang sah.
  // Perilaku asli: trim() dulu, jadi 100 karakter utuh tetap dipertahankan.
  const padded = ' '.repeat(30) + 'x'.repeat(150);
  assert.equal(sanitizeSearchTerm(padded).length, 100);
  assert.equal(sanitizeSearchTerm(padded), 'x'.repeat(100));
});

test('sanitizeSearchTermKeepingWords: koma/kurung diganti spasi, batas kata utuh', () => {
  // Regresi T-1: route produk aslinya mengganti karakter struktur dengan
  // spasi. Menghapusnya akan mengubah "kopi,susu" menjadi "kopisusu" dan
  // menghasilkan pencarian yang berbeda.
  assert.equal(sanitizeSearchTermKeepingWords('kopi,susu'), 'kopi susu');
  assert.equal(sanitizeSearchTermKeepingWords('teh(manis)'), 'teh manis');
  assert.equal(sanitizeSearchTermKeepingWords('nasi,ayam,pedas'), 'nasi ayam pedas');
  // Tetap aman: tidak ada karakter struktur yang tersisa.
  for (const raw of ['kopi,susu', 'teh(manis)', 'a)b(c', '%,%']) {
    assert.equal(isStructuralSafe(sanitizeSearchTermKeepingWords(raw)), true, `gagal: ${raw}`);
  }
});

test('sanitizeSearchTermKeepingWords: spasi tepi setelah penggantian dibuang', () => {
  assert.equal(sanitizeSearchTermKeepingWords(',kopi'), 'kopi');
  assert.equal(sanitizeSearchTermKeepingWords('kopi,'), 'kopi');
  assert.equal(sanitizeSearchTermKeepingWords('  ,,,  '), '');
  assert.equal(sanitizeSearchTermKeepingWords('a b'), 'a b');
});

test('sanitizeSearchTermKeepingWords: null/kosong dan batas panjang', () => {
  for (const value of [null, undefined, '']) {
    assert.equal(sanitizeSearchTermKeepingWords(value), '');
  }
  assert.equal(sanitizeSearchTermKeepingWords(' '.repeat(30) + 'y'.repeat(150)).length, 100);
  assert.equal(sanitizeSearchTermKeepingWords('abcdef', 3), 'abc');
});

test('route produk memakai varian keeping-words; enam route lain memakai varian hapus', () => {
  const products = readProjectFile('app/api/admin/products/route.ts');
  assert.match(products, /sanitizeSearchTermKeepingWords\(/);
  assert.doesNotMatch(products, /[^g]sanitizeSearchTerm\(q\)/);

  for (const file of [
    'app/api/admin/users/route.ts',
    'app/api/admin/orders/route.ts',
    'app/api/admin/subscriptions/route.ts',
    'app/api/admin/umkm/route.ts',
    'app/api/admin/articles/route.ts',
    'app/api/articles/route.ts',
  ]) {
    const source = readProjectFile(file);
    assert.match(source, /sanitizeSearchTerm\(/, `${file} harus memakai varian hapus`);
    assert.doesNotMatch(
      source,
      /sanitizeSearchTermKeepingWords\(/,
      `${file} tidak boleh ikut berubah ke varian keeping-words`
    );
  }
});

test('sanitizeSearchTerm: seluruh hasil selalu bebas karakter struktur', () => {
  const attacks = [
    'x,role.eq.admin',
    'a),or(id.neq.0',
    '(((',
    '%,%,%',
    'normal,teks(berbahaya)%',
  ];
  for (const attack of attacks) {
    assert.equal(isStructuralSafe(sanitizeSearchTerm(attack)), true, `gagal untuk: ${attack}`);
  }
});

test('isStructuralSafe: definisi konsisten dengan sanitizer', () => {
  assert.equal(isStructuralSafe('aman'), true);
  assert.equal(isStructuralSafe(''), true);
  for (const ch of [',', '(', ')', '%']) {
    assert.equal(isStructuralSafe(`a${ch}b`), false, `karakter ${ch} harus terdeteksi`);
  }
});

// ---------------------------------------------------------------------------
// 4. Tidak ada kebocoran pesan internal ke client
// ---------------------------------------------------------------------------

test('route admin: tidak mengirim pesan exception mentah ke client', () => {
  // Pola lama: `const msg = err instanceof Error ? err.message : ...` lalu
  // `{ error: msg }` — membocorkan detail TLS/query ke pemanggil.
  const files = [
    'app/api/admin/dashboard/route.ts',
    'app/api/admin/users/route.ts',
    'app/api/admin/orders/route.ts',
    'app/api/admin/sanctions/route.ts',
    'app/api/admin/reports/route.ts',
    'app/api/admin/products/route.ts',
    'app/api/admin/subscriptions/route.ts',
    'app/api/admin/articles/route.ts',
    'app/api/admin/role-requests/route.ts',
    'app/api/admin/warnings/route.ts',
    'app/api/admin/umkm/route.ts',
    'app/api/admin/health/route.ts',
  ];
  for (const file of files) {
    const source = readProjectFile(file);
    assert.doesNotMatch(
      source,
      /err instanceof Error \? err\.message/,
      `${file} masih mengembalikan err.message ke client`
    );
  }
});

test('route admin: logging server dipertahankan untuk penelusuran', () => {
  const route = readProjectFile('app/api/admin/dashboard/route.ts');
  assert.match(route, /console\.error\('\[admin\/dashboard\]/);
});

// ---------------------------------------------------------------------------
// 5. Sanitasi dipakai bersama, bukan disalin ulang
// ---------------------------------------------------------------------------

test('route yang membangun or() memakai sanitizer bersama', () => {
  const files = [
    'app/api/admin/users/route.ts',
    'app/api/admin/orders/route.ts',
    'app/api/admin/subscriptions/route.ts',
    'app/api/admin/articles/route.ts',
    'app/api/admin/products/route.ts',
    'app/api/articles/route.ts',
  ];
  for (const file of files) {
    const source = readProjectFile(file);
    assert.match(source, /from '@\/lib\/filter-search'/, `${file} belum memakai sanitizer bersama`);
    // Tidak boleh ada definisi lokal yang menyalin logika sanitasi.
    assert.doesNotMatch(
      source,
      /function sanitizeSearch\(raw: string \| null\): string \{\s*\n\s*if \(!raw\) return '';/,
      `${file} masih mendefinisikan sanitizeSearch lokal`
    );
  }
});
