/**
 * Penjaga sumber untuk migrasi kurir DEMO.
 *
 * Yang dijaga adalah aturan yang TIDAK bisa dilihat dari TypeScript, karena
 * semuanya hidup di database:
 * 1. `courier_user_id` boleh NULL — tetapi HANYA untuk baris demo.
 *    Tanpa constraint itu, penugasan nyata bisa kehilangan kurirnya diam-diam.
 * 2. `sender_user_id` boleh NULL — tetapi HANYA untuk balasan demo.
 * 3. Policy INSERT chat hanya menerima pesan pengguna sungguhan, sehingga
 *    klien tidak bisa memalsukan balasan "kurir demo".
 *
 * Jalankan: node --test tests/demo-courier-migration.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Baca berkas proyek sebagai teks berakhiran LF (checkout Windows = CRLF). */
function readProjectFile(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(
    /\r\n/g,
    '\n'
  );
}

/** Buang komentar `--` baris-per-baris agar pemeriksaan melihat DDL saja. */
function stripSqlComments(sql: string): string {
  return sql
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join('\n');
}

const rawSql = readProjectFile('supabase/migrations/20261031020000_demo_courier.sql');
const sql = stripSqlComments(rawSql);

test('kolom kurir pada penugasan boleh NULL', () => {
  assert.match(
    sql,
    /ALTER TABLE public\.delivery_assignments\s+ALTER COLUMN courier_user_id DROP NOT NULL/i
  );
});

test('NULL hanya sah untuk baris demo, bukan penugasan nyata', () => {
  assert.match(sql, /ADD CONSTRAINT delivery_assignments_courier_required/i);
  assert.match(sql, /CHECK \(is_demo OR courier_user_id IS NOT NULL\)/i);
});

test('balasan demo ditandai kolom sendiri, bukan punya pengirim palsu', () => {
  assert.match(sql, /ADD COLUMN IF NOT EXISTS sender_kind text NOT NULL DEFAULT 'user'/i);
  assert.match(sql, /CHECK \(sender_kind IN \('user', 'demo_courier'\)\)/i);
});

test('pengirim wajib diisi untuk pesan pengguna dan wajib kosong untuk demo', () => {
  assert.match(sql, /courier_messages_sender_required/i);
  assert.match(sql, /sender_kind = 'user' AND sender_user_id IS NOT NULL/i);
  assert.match(sql, /sender_kind = 'demo_courier' AND sender_user_id IS NULL/i);
});

test('policy insert chat menolak pesan yang bukan dari pengguna', () => {
  const policy = sql.slice(sql.indexOf('CREATE POLICY "courier_messages_insert_participants"'));
  assert.match(policy, /sender_kind = 'user'/i);
  assert.match(policy, /sender_user_id = auth\.uid\(\)/i);
  // Pengirim yang bukan peserta order tetap ditolak.
  assert.match(policy, /o\.buyer_id = auth\.uid\(\)/i);
  assert.match(policy, /a\.courier_user_id = auth\.uid\(\)/i);
});

test('tidak ada DELETE/GRANT berlebih pada migrasi ini', () => {
  assert.equal(/DROP TABLE/i.test(sql), false);
  assert.equal(/GRANT ALL/i.test(sql), false);
});
