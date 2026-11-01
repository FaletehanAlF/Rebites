/**
 * Regresi: notifikasi "tunda penayangan" ke penjual ditolak RLS.
 *
 * GEJALA di BUG.md:
 *   POST /api/admin/products/:id/reject 500
 *   Super admin menunda penayangan, tetapi status produk tidak pernah tercatat
 *   sebagai "Ditunda Admin" di sisi penjual.
 *
 * AKAR MASALAH:
 *   Route reject memakai createAuthedServerClient() (klien ber-auth admin)
 *   untuk notifySellerModeration(), yang INSERT ke public.notifications.
 *   Policy notifications_insert_self (20261007000006) mensyaratkan
 *   auth.uid() = user_id, dan auth.uid() di sini adalah admin — bukan penjual.
 *   Notification insert untuk penjual karena itu ditolak RLS.
 *
 * TES INI (memeriksa konfigurasi yang dapat dibuktikan dari sumber):
 *   A. Route reject memakai createServiceClient() untuk notifikasi.
 *   B. createServiceClient() memakai SUPABASE_SERVICE_ROLE_KEY (bukan anon key).
 *   C. Policy notifications_insert_self memang mensyaratkan auth.uid() = user_id,
 *      sehingga alasan perbaikan A benar.
 *
 * Jalankan: node --test tests/moderation-notification-service-role.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

/** Windows + core.autocrlf=true menyimpan CRLF; bandingkan teks ternormalisasi. */
function readSource(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

test('route reject memakai klien service role untuk notifikasi penjual', () => {
  const src = readSource('app/api/admin/products/[id]/reject/route.ts');

  assert.match(
    src,
    /import\s*\{[^}]*createServiceClient[^}]*\}\s*from\s*'@\/lib\/server\/supabase'/,
    'createServiceClient harus diimpor di route reject'
  );
  assert.match(
    src,
    /const notifier = createServiceClient\(\);/,
    'notifikasi harus dikirim lewat klien service role'
  );
  assert.match(
    src,
    /notifySellerModeration\(notifier,/,
    'notifySellerModeration harus menerima klien service role, bukan klien admin'
  );
  assert.doesNotMatch(
    src,
    /notifySellerModeration\(db,/,
    'klien admin ber-auth (db) akan ditolak RLS notifications_insert_self'
  );
});

test('createServiceClient memakai service role key', () => {
  const src = readSource('lib/server/supabase.ts');
  const start = src.indexOf('export function createServiceClient(');
  assert.ok(start >= 0, 'createServiceClient harus ada');
  const body = src.slice(start, start + 800);

  assert.match(body, /SUPABASE_SERVICE_ROLE_KEY/, 'harus memakai SUPABASE_SERVICE_ROLE_KEY');
  assert.doesNotMatch(body, /ANON_KEY/, 'tidak boleh memakai anon key');
});

test('policy notifications_insert_self mensyaratkan auth.uid() = user_id', () => {
  const src = readSource(
    'supabase/migrations/20261007000006_p1b_review_notification_security.sql'
  );
  const start = src.indexOf('CREATE POLICY "notifications_insert_self"');
  assert.ok(start >= 0, 'policy notifications_insert_self harus ada');

  const policy = src.slice(start, src.indexOf(';', start));
  assert.match(policy, /ON public\.notifications FOR INSERT/, 'policy harus untuk INSERT');
  assert.match(policy, /auth\.uid\(\) = user_id/, 'WITH CHECK harus auth.uid() = user_id');
});
