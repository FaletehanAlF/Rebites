/**
 * Validator path internal (redirect/next) — lokal, tanpa browser.
 *
 * Membuktikan:
 * - Path internal wajar diterima.
 * - Protocol-relative ('//'), backslash mentah ('/\'), karakter kontrol
 *   (tab/newline yang dihapus parser URL), dan varian terenkodenya
 *   ('/%5C', '/%2F') ditolak — tidak ada jalur open redirect.
 * - Wrapper isSafeRedirectPath (lib/current-user) dan isSafeNextPath
 *   (lib/auth-email) memakai validator yang sama.
 *
 * Jalankan: node --test tests/safe-path.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { isSafeInternalPath } from '../lib/safe-path.ts';

test('isSafeInternalPath: menerima path internal yang wajar', () => {
  assert.equal(isSafeInternalPath('/'), true);
  assert.equal(isSafeInternalPath('/home'), true);
  assert.equal(isSafeInternalPath('/dashboard/admin?tab=users'), true);
  assert.equal(isSafeInternalPath('/dashboard/admin/pengguna'), true);
  assert.equal(isSafeInternalPath('/auth/login?next=%2Fhome'), true);
  assert.equal(isSafeInternalPath('/riwayatPesanan#top'), true);
});

test('isSafeInternalPath: menolak non-path / nilai kosong', () => {
  assert.equal(isSafeInternalPath(''), false);
  assert.equal(isSafeInternalPath(null), false);
  assert.equal(isSafeInternalPath(undefined), false);
  assert.equal(isSafeInternalPath('home'), false);
  assert.equal(isSafeInternalPath(' /home'), false);
  assert.equal(isSafeInternalPath('https://evil.com'), false);
  assert.equal(isSafeInternalPath('javascript:alert(1)'), false);
  assert.equal(isSafeInternalPath('data:text/html,x'), false);
});

test('isSafeInternalPath: menolak protocol-relative & varian backslash', () => {
  assert.equal(isSafeInternalPath('//evil.com'), false);
  assert.equal(isSafeInternalPath('/\\evil.com'), false); // '/\evil.com'
  assert.equal(isSafeInternalPath('\\\\evil.com'), false); // '\\evil.com'
  assert.equal(isSafeInternalPath('/home\\'), false);
  assert.equal(isSafeInternalPath('/a\\b'), false); // backslash di tengah
  // Varian terenkode (double-decode / konsumen lain).
  assert.equal(isSafeInternalPath('/%5Cevil.com'), false);
  assert.equal(isSafeInternalPath('/%5cevil.com'), false);
  assert.equal(isSafeInternalPath('/a%5Cb'), false);
  assert.equal(isSafeInternalPath('/%2F%2Fevil.com'), false);
  assert.equal(isSafeInternalPath('/%2f%2fevil.com'), false);
});

test('isSafeInternalPath: menolak karakter kontrol (tab/newline dihapus parser URL)', () => {
  assert.equal(isSafeInternalPath('/\t/evil.com'), false); // '/<tab>/evil.com' → '//evil.com'
  assert.equal(isSafeInternalPath('/\n/evil.com'), false);
  assert.equal(isSafeInternalPath('/\r/evil.com'), false);
  assert.equal(isSafeInternalPath('/\u0000evil'), false);
  assert.equal(isSafeInternalPath('/\u007f'), false);
});

test('source guard: kedua wrapper mendelegasikan ke isSafeInternalPath', () => {
  const read = (relative: string) =>
    readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), 'utf8');

  const extraction = (source: string, marker: string) => {
    const start = source.indexOf(marker);
    assert.ok(start >= 0, `tidak menemukan ${marker}`);
    const end = source.indexOf('}', start);
    assert.ok(end > start);
    return source.slice(start, end);
  };

  // Wrapper di lib/current-user.ts dan lib/auth-email.ts hanya boleh
  // mendelegasikan ke validator bersama (bukan logika lama yang lemah).
  assert.match(
    extraction(read('lib/current-user.ts'), 'export function isSafeRedirectPath'),
    /return isSafeInternalPath\(path\);/
  );
  assert.match(
    extraction(read('lib/auth-email.ts'), 'export function isSafeNextPath'),
    /return isSafeInternalPath\(path\);/
  );

  // Tidak ada lagi pola lama "startsWith('/') && !startsWith('//')" sebagai
  // satu-satunya proteksi.
  assert.doesNotMatch(
    read('lib/current-user.ts'),
    /return path\.startsWith\('\/'\) && !path\.startsWith\('\/\/'\)/
  );
  assert.doesNotMatch(
    read('lib/auth-email.ts'),
    /return path\.startsWith\('\/'\) && !path\.startsWith\('\/\/'\)/
  );
});
