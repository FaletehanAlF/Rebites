import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const MIGRATION = readFileSync(new URL('../supabase/migrations/20261109000000_support_inbox.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ADMIN = '00000000-0000-4000-8000-00000000000a';
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const FIXTURE = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid; $$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE
AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb); $$;
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  full_name text,
  role text NOT NULL DEFAULT 'buyer' CHECK (role IN ('admin','umkm','buyer'))
);
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'); $$;
CREATE PUBLICATION supabase_realtime;
INSERT INTO auth.users (id, email) VALUES
  ('${ADMIN}', 'admin@x.id'),
  ('${USER}', 'user@x.id'),
  ('${OTHER}', 'lain@x.id');
INSERT INTO public.profiles (id, email, full_name, role) VALUES
  ('${ADMIN}', 'admin@x.id', 'Admin', 'admin'),
  ('${USER}', 'user@x.id', 'Pengguna', 'buyer'),
  ('${OTHER}', 'lain@x.id', 'Orang Lain', 'buyer');
`;
const db = new PGlite();
const ready = (async () => {
    await db.exec(FIXTURE);
    await db.exec(MIGRATION);
})();
async function asService(): Promise<void> {
    await db.exec(`SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false);`);
}
async function asUser(id: string): Promise<void> {
    await db.exec(`SELECT set_config('request.jwt.claims', '{}', false);`);
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${id}', false);`);
}
test('migrasi terpasang bersih di Postgres asli', async () => {
    await ready;
    const tables = await db.query(`SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('support_threads','support_messages','support_appeals')
      ORDER BY table_name`);
    assert.deepEqual(tables.rows.map((row) => (row as Record<string, unknown>).table_name), ['support_appeals', 'support_messages', 'support_threads']);
});
test('satu percakapan per akun, dan banding kedua memakai percakapan yang sama', async () => {
    await ready;
    await asService();
    const first = await db.query(`SELECT public.create_support_appeal($1, $2, $3) AS r`, [
        'User@X.id',
        'Mohon buka blokir saya.',
        USER,
    ]);
    const second = await db.query(`SELECT public.create_support_appeal($1, $2, $3) AS r`, [
        'user@x.id',
        'Tambahan keterangan.',
        USER,
    ]);
    const firstRow = first.rows[0] as {
        r: Record<string, unknown>;
    };
    const secondRow = second.rows[0] as {
        r: Record<string, unknown>;
    };
    assert.equal(firstRow.r.result, 'created');
    assert.equal(secondRow.r.result, 'created');
    assert.notEqual(firstRow.r.code, secondRow.r.code);
    assert.equal(firstRow.r.thread_id, secondRow.r.thread_id);
    const threads = await db.query(`SELECT count(*)::int AS n FROM public.support_threads WHERE profile_id = $1`, [USER]);
    assert.equal((threads.rows[0] as {
        n: number;
    }).n, 1);
});
test('penghitung belum dibaca dijaga trigger dan dikosongkan per sisi', async () => {
    await ready;
    await asService();
    await db.query(`SELECT public.create_support_appeal($1, $2, $3) AS r`, [
        'hitung@x.id',
        'pesan pertama',
        null,
    ]);
    await db.query(`SELECT public.create_support_appeal($1, $2, $3) AS r`, [
        'hitung@x.id',
        'pesan kedua',
        null,
    ]);
    const afterUser = await db.query(`SELECT admin_unread_count, user_unread_count FROM public.support_threads WHERE email = 'hitung@x.id'`);
    const userCounts = afterUser.rows[0] as {
        admin_unread_count: number;
        user_unread_count: number;
    };
    assert.equal(userCounts.admin_unread_count, 2);
    assert.equal(userCounts.user_unread_count, 0);
    await db.query(`INSERT INTO public.support_messages (thread_id, sender_kind, channel, body)
     SELECT id, 'admin', 'admin', 'Kami tinjau ya.' FROM public.support_threads WHERE email = 'hitung@x.id'`);
    const afterAdmin = await db.query(`SELECT admin_unread_count, user_unread_count FROM public.support_threads WHERE email = 'hitung@x.id'`);
    const adminCounts = afterAdmin.rows[0] as {
        admin_unread_count: number;
        user_unread_count: number;
    };
    assert.equal(adminCounts.admin_unread_count, 2);
    assert.equal(adminCounts.user_unread_count, 1);
    await asUser(ADMIN);
    await db.query(`SELECT public.mark_support_thread_read(
       (SELECT id FROM public.support_threads WHERE email = 'hitung@x.id'), 'admin')`);
    const afterRead = await db.query(`SELECT admin_unread_count, user_unread_count FROM public.support_threads WHERE email = 'hitung@x.id'`);
    const readCounts = afterRead.rows[0] as {
        admin_unread_count: number;
        user_unread_count: number;
    };
    assert.equal(readCounts.admin_unread_count, 0);
    assert.equal(readCounts.user_unread_count, 1);
});
test('penandaan baca menolak pemilik lain dan sisi yang bukan haknya', async () => {
    await ready;
    await asService();
    await db.query(`SELECT public.create_support_appeal($1, $2, $3) AS r`, [
        'user@x.id',
        'tambahan',
        USER,
    ]);
    await asUser(OTHER);
    await assert.rejects(() => db.query(`SELECT public.mark_support_thread_read(
           (SELECT id FROM public.support_threads WHERE profile_id = '${USER}'), 'user')`), /Percakapan tidak ditemukan/);
    await assert.rejects(() => db.query(`SELECT public.mark_support_thread_read(
           (SELECT id FROM public.support_threads WHERE profile_id = '${USER}'), 'admin')`), /hanya admin/);
    await assert.rejects(() => db.query(`SELECT public.mark_support_thread_read(
           (SELECT id FROM public.support_threads WHERE profile_id = '${USER}'), 'entah')`), /Sisi tidak dikenal/);
});
test('batas laju: tiga banding per email per jam, banding keempat ditolak', async () => {
    await ready;
    await asService();
    const hasil: string[] = [];
    for (const pesan of ['satu', 'dua', 'tiga', 'empat']) {
        const row = await db.query(`SELECT public.create_support_appeal($1, $2, $3) AS r`, [
            'batas@x.id',
            pesan,
            null,
        ]);
        hasil.push(String((row.rows[0] as {
            r: Record<string, unknown>;
        }).r.result));
    }
    assert.deepEqual(hasil, ['created', 'created', 'created', 'rate_limited']);
});
test('pesan lanjutan lewat kode: kode benar diterima, kode ngawur ditolak', async () => {
    await ready;
    await asService();
    const created = await db.query(`SELECT public.create_support_appeal($1, $2, $3) AS r`, [
        'lanjut@x.id',
        'banding awal',
        null,
    ]);
    const code = String((created.rows[0] as {
        r: Record<string, unknown>;
    }).r.code);
    const ok = await db.query(`SELECT public.append_appeal_followup($1, $2) AS r`, [
        code.toLowerCase(),
        'keterangan tambahan',
    ]);
    assert.equal((ok.rows[0] as {
        r: string;
    }).r, 'ok');
    const missing = await db.query(`SELECT public.append_appeal_followup($1, $2) AS r`, [
        'NGAWUR123456',
        'x',
    ]);
    assert.equal((missing.rows[0] as {
        r: string;
    }).r, 'not_found');
    const messages = await db.query(`SELECT count(*)::int AS n FROM public.support_messages m
       JOIN public.support_threads t ON t.id = m.thread_id
      WHERE lower(t.email) = 'lanjut@x.id' AND m.body = 'keterangan tambahan'`);
    assert.equal((messages.rows[0] as {
        n: number;
    }).n, 1);
});
test('klien hanya memegang SELECT pada ketiga tabel', async () => {
    await ready;
    const grants = await db.query(`SELECT table_name, string_agg(DISTINCT privilege_type, ',' ORDER BY privilege_type) AS privs
       FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND table_name IN ('support_threads','support_messages','support_appeals')
        AND grantee = 'authenticated'
      GROUP BY table_name ORDER BY table_name`);
    const rows = grants.rows as Array<{
        table_name: string;
        privs: string;
    }>;
    assert.equal(rows.length, 3);
    for (const row of rows) {
        assert.equal(row.privs, 'SELECT', `${row.table_name} memberi hak lebih dari SELECT`);
    }
});
test.after(async () => {
    await db.close();
});
