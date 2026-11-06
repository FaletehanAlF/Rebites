/**
 * Tes integritas DATABASE untuk migrasi 20261105 (reply_to_message_id).
 *
 * Berbeda dari tes "source-pen" yang hanya membaca teks SQL, tes ini
 * MENGEKSEKUSI file migrasi asli (dari disk, apa adanya) ke PostgreSQL
 * in-memory PGlite (@electric-sql/pglite, keluarga PG 15+), lalu membuktikan
 * perilakunya:
 *
 *  1. Komposit FK: balasan otomatis dari pesanan B yang menunjuk pesan
 *     pemicu di pesanan A DITOLAK (lintas pesanan tertutup di level DB).
 *  2. Komposit FK: rujukan ke pesan pemicu di pesanan yang SAMA diterima.
 *  3. CHECK: pesan `user` tidak boleh mengisi reply_to_message_id (tidak bisa
 *     memalsukan tautan balikan, juga lewat REST Supabase).
 *  4. Unique partial index: dua balasan otomatis (ai ATAU demo) untuk
 *     pesan pemicu yang sama - yang kedua ditolak (efek dedup yang diandalkan
 *     route untuk menahan retry/dua request bersamaan).
 *  5. ON DELETE SET NULL (reply_to_message_id): menghapus pesan pemicu tidak
 *     menghapus balasannya; balasan bertahan, order_id-nya tetap terisi.
 *  6. Idempoten: migrasi dapat dijalankan dua kali tanpa error.
 *  7. Pola sumber: file tidak menyentuh RLS/policy (tidak melonggarkan).
 *
 * PRASYARAT fixture: schema dasar courier_messages seperti hasil
 * 20261031010000 + 20261031020000 (sender_kind user/demo_courier), sehingga
 * migrasi 20261104 dan 20261105 berjalan pada kondisi produksi yang sah.
 *
 * BATAS BUKTI: PGlite bukan Supabase (tanpa PostgREST/realtime); RLS tidak
 * dieksekusi di sini - integritas RLS dijaga oleh asersi pola sumber di
 * bagian akhir dan tes courier-ai.test.ts.
 *
 * Jalankan: node --test tests/courier-ai-reply-integrity.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const MIG_AI_KIND = readFileSync(
  new URL('../supabase/migrations/20261104000000_ai_courier_gemini.sql', import.meta.url),
  'utf8'
);

const MIG_DEDUP = readFileSync(
  new URL('../supabase/migrations/20261105000000_courier_ai_reply_dedup.sql', import.meta.url),
  'utf8'
);

// ---------------------------------------------------------------------------
// Identitas uji
// ---------------------------------------------------------------------------
const BUYER = '11111111-1111-4111-8111-111111111111';
const ORDER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'; // pesanan yang di-beli BUYER
const ORDER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'; // pesanan lain

const db = new PGlite();

async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const res = await db.query(sql, params as never[]);
  return res.rows as T[];
}

function errText(err: unknown): string {
  const e = err as { message?: string; cause?: { message?: string } };
  return String(e?.message ?? e?.cause?.message ?? err);
}

/**
 * Insert baris courier_messages; parametrik agar body/route tidak bisa
 * memanipulasi nilai lewat interpolasi.
 */
async function insertMessage(args: {
  orderId: string;
  kind: string;
  senderUserId?: string | null;
  body?: string;
  replyTo?: string | null;
}): Promise<string> {
  const res = await query<{ id: string }>(
    `INSERT INTO public.courier_messages
       (order_id, sender_kind, sender_user_id, body, reply_to_message_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [args.orderId, args.kind, args.senderUserId ?? null, args.body ?? 'halo kurir', args.replyTo ?? null]
  );
  return res[0].id;
}

let ready = false;
async function setup(): Promise<void> {
  if (ready) return;
  ready = true;

  // Fixture dasar = perilaku 20261031010000 (tabel chat) + 20261031020000
  // (sender_kind user/demo), bentuk paling ringkas yang dipentaskan migrasi
  // 20261104 & 20261105.
  await db.exec(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);

    CREATE TABLE public.orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      buyer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE
    );

    CREATE TABLE public.courier_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
      sender_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
      created_at timestamptz NOT NULL DEFAULT now()
    );

    ALTER TABLE public.courier_messages
      ADD COLUMN sender_kind text NOT NULL DEFAULT 'user';

    ALTER TABLE public.courier_messages
      ADD CONSTRAINT courier_messages_sender_kind_check
        CHECK (sender_kind IN ('user', 'demo_courier'));

    ALTER TABLE public.courier_messages
      ADD CONSTRAINT courier_messages_sender_required
        CHECK (
          (sender_kind = 'user' AND sender_user_id IS NOT NULL)
          OR (sender_kind = 'demo_courier' AND sender_user_id IS NULL)
        );

    INSERT INTO auth.users (id) VALUES ('${BUYER}');
    INSERT INTO public.orders (id, buyer_id) VALUES
      ('${ORDER_A}', '${BUYER}'),
      ('${ORDER_B}', '${BUYER}');
  `);

  // Migrasi ASLI dijalankan dari file di disk - bukan salinan manual.
  await db.exec(MIG_AI_KIND);
  await db.exec(MIG_DEDUP);
}

test.before(async () => {
  await setup();
});

test.after(async () => {
  await db.close();
});

// ---------------------------------------------------------------------------
// 2 & 1. Komposit FK: rujukan wajib dalam pesanan yang sama
// ---------------------------------------------------------------------------

test('FK komposit: balasan di pesanan yang sama DITERIMA', async () => {
  const triggerId = await insertMessage({ orderId: ORDER_A, kind: 'user', senderUserId: BUYER });

  await assert.doesNotReject(() => insertMessage({ orderId: ORDER_A, kind: 'ai_courier', replyTo: triggerId, body: 'Baik, saya kirim.' }));

  const res = await query<{ reply_to: string | null }>(
    `SELECT reply_to_message_id AS reply_to
       FROM public.courier_messages
      WHERE sender_kind = 'ai_courier'
      ORDER BY created_at DESC LIMIT 1`
  );
  assert.equal(res[0].reply_to, triggerId);
});

test('FK komposit: balasan lintas pesanan DITOLAK', async () => {
  const triggerId = await insertMessage({ orderId: ORDER_A, kind: 'user', senderUserId: BUYER });

  await assert.rejects(
    () => insertMessage({ orderId: ORDER_B, kind: 'ai_courier', replyTo: triggerId }),
    (err) => {
      assert.match(
        errText(err),
        /courier_messages_reply_same_order_fkey|violates foreign key/i,
        `harus pelanggaran FK komposit, dapat: ${errText(err)}`
      );
      return true;
    }
  );
});

test('FK komposit: balasan lintas pesanan tidak meninggalkan baris', async () => {
  const res = await query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM public.courier_messages
      WHERE order_id = $1 AND sender_kind = 'ai_courier'`,
    [ORDER_B]
  );
  assert.equal(res[0].n, 0, 'order B tidak boleh punya balasan otomatis');
});

// ---------------------------------------------------------------------------
// 3. CHECK: hanya balasan otomatis yang boleh mengisi reply_to_message_id
// ---------------------------------------------------------------------------

test('CHECK: pesan user dengan reply_to_message_id DITOLAK', async () => {
  const triggerId = await insertMessage({ orderId: ORDER_A, kind: 'user', senderUserId: BUYER });

  await assert.rejects(
    () => insertMessage({ orderId: ORDER_A, kind: 'user', senderUserId: BUYER, replyTo: triggerId }),
    (err) => {
      assert.match(
        errText(err),
        /courier_messages_reply_to_automated_check|violates check constraint/i,
        `harus pelanggaran CHECK, dapat: ${errText(err)}`
      );
      return true;
    }
  );
});

test('CHECK: balasan demo boleh mengisi reply_to_message_id', async () => {
  const triggerId = await insertMessage({ orderId: ORDER_A, kind: 'user', senderUserId: BUYER });
  await assert.doesNotReject(() =>
    insertMessage({ orderId: ORDER_A, kind: 'demo_courier', replyTo: triggerId, body: 'Sebentar lagi sampai.' })
  );
});

// ---------------------------------------------------------------------------
// 4. Unique partial index: maksimal satu balasan otomatis per pemicu
// ---------------------------------------------------------------------------

test('dedup: balasan AI kedua untuk pemicu sama DITOLAK (retry/dua request)', async () => {
  const triggerId = await insertMessage({ orderId: ORDER_A, kind: 'user', senderUserId: BUYER });

  await insertMessage({ orderId: ORDER_A, kind: 'ai_courier', replyTo: triggerId, body: 'Balasan pertama.' });

  await assert.rejects(
    () => insertMessage({ orderId: ORDER_A, kind: 'ai_courier', replyTo: triggerId, body: 'Duplikat.' }),
    (err) => {
      assert.match(
        errText(err),
        /courier_messages_ai_reply_unique|duplicate key/i,
        `harus pelanggaran unique dedup, dapat: ${errText(err)}`
      );
      return true;
    }
  );
});

test('dedup: kombinasi ai_courier + demo_courier untuk pemicu sama juga DITOLAK', async () => {
  const triggerId = await insertMessage({ orderId: ORDER_A, kind: 'user', senderUserId: BUYER });

  await insertMessage({ orderId: ORDER_A, kind: 'demo_courier', replyTo: triggerId, body: 'Kurir demo.' });

  await assert.rejects(
    () => insertMessage({ orderId: ORDER_A, kind: 'ai_courier', replyTo: triggerId, body: 'Kurir AI belakangan.' }),
    (err) => {
      assert.match(errText(err), /courier_messages_ai_reply_unique|duplicate key/i);
      return true;
    }
  );
});

test('dedup: ZAT pemicu BERBEDA tetap boleh dibalas masing-masing', async () => {
  const t1 = await insertMessage({ orderId: ORDER_A, kind: 'user', senderUserId: BUYER, body: 'pesan 1' });
  const t2 = await insertMessage({ orderId: ORDER_A, kind: 'user', senderUserId: BUYER, body: 'pesan 2' });

  await insertMessage({ orderId: ORDER_A, kind: 'ai_courier', replyTo: t1, body: 'balasan 1' });
  await insertMessage({ orderId: ORDER_A, kind: 'ai_courier', replyTo: t2, body: 'balasan 2' });

  const res = await query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM public.courier_messages
      WHERE sender_kind = 'ai_courier' AND reply_to_message_id IN ($1, $2)`,
    [t1, t2]
  );
  assert.equal(res[0].n, 2, 'dua pemicu berbeda boleh punya balasan masing-masing');
});

// ---------------------------------------------------------------------------
// 5. ON DELETE SET NULL (kolom) — perilaku khusus PostgreSQL 15+
// ---------------------------------------------------------------------------

test('hapus pesan pemicu: balasan BERTAHAN, reply_to jadi NULL, order_id tetap terisi', async () => {
  const triggerId = await insertMessage({ orderId: ORDER_B, kind: 'user', senderUserId: BUYER, body: 'pesan pemicu' });
  const replyId = await insertMessage({ orderId: ORDER_B, kind: 'ai_courier', replyTo: triggerId, body: 'balasan pemicu' });

  // Hapus pesan pemicu (simulasi verbose; RLS produksi tidak mengizinkan
  // DELETE - ini jalur admin/service).
  await db.exec(`DELETE FROM public.courier_messages WHERE id = '${triggerId}'`);

  const res = await query<{ reply_to: string | null; order_id: string }>(
    `SELECT reply_to_message_id AS reply_to, order_id
       FROM public.courier_messages
      WHERE id = $1`,
    [replyId]
  );
  assert.equal(res.length, 1, 'balasan tidak boleh ikut terhapus');
  assert.equal(res[0].reply_to, null, 'kolom reply_to harus dinolkan (SET NULL kolom)');
  assert.equal(
    res[0].order_id,
    ORDER_B,
    'order_id TIDAK boleh ikut dinolkan (prasyarat NOT NULL tetap terjaga)'
  );
});

// ---------------------------------------------------------------------------
// 6. Idempotensi
// ---------------------------------------------------------------------------

test('migrasi idempoten: dijalankan ulang tanpa error, constraint tetap tunggal', async () => {
  await assert.doesNotReject(() => db.exec(MIG_DEDUP));

  const res = await query<{ conname: string; n: number }>(
    `SELECT conname, count(*)::int AS n
       FROM pg_constraint
      WHERE conrelid = 'public.courier_messages'::regclass
        AND conname IN (
          'courier_messages_reply_same_order_fkey',
          'courier_messages_reply_to_automated_check'
        )
      GROUP BY conname`,
    []
  );
  const names = Object.fromEntries(res.map((r) => [r.conname, r.n]));
  assert.equal(names['courier_messages_reply_same_order_fkey'], 1);
  assert.equal(names['courier_messages_reply_to_automated_check'], 1);
});

// ---------------------------------------------------------------------------
// 7. Pola sumber: file migrasi tidak melonggarkan apa pun
// ---------------------------------------------------------------------------

test('pola sumber: migrasi TIDAK menyentuh RLS, GRANT, atau policy', () => {
  // .replace karena komentar dibaca apa adanya.
  assert.equal(/DROP POLICY|CREATE POLICY|WITH CHECK|BYPASSRLS|GRANT|REVOKE/i.test(MIG_DEDUP), false);
});

test('pola sumber: FK komposit + SET NULL kolom + CHECK ada di file', () => {
  assert.match(MIG_DEDUP, /courier_messages_reply_same_order_fkey/);
  assert.match(MIG_DEDUP, /FOREIGN KEY \(reply_to_message_id, order_id\)/i);
  assert.match(MIG_DEDUP, /REFERENCES public\.courier_messages \(id, order_id\)/i);
  assert.match(MIG_DEDUP, /ON DELETE SET NULL \(reply_to_message_id\)/i);
  assert.match(MIG_DEDUP, /courier_messages_reply_to_automated_check/);
  assert.match(MIG_DEDUP, /sender_kind IN \('ai_courier', 'demo_courier'\)/i);
});

test('pola sumber: guard versi PostgreSQL 15+ ada', () => {
  assert.match(MIG_DEDUP, /server_version_num/);
  assert.match(MIG_DEDUP, /150000/);
});
