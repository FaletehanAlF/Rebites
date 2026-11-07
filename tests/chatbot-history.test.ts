import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const MIGRATION = readFileSync(new URL('../supabase/migrations/20261030100000_chatbot_history.sql', import.meta.url), 'utf8');
const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const SESSION_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const SESSION_B = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const MESSAGE_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const MESSAGE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';
const FIXTURE_DDL = `
CREATE SCHEMA auth;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text
);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
`;
async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(FIXTURE_DDL);
    await db.exec(MIGRATION);
    await db.exec(`
    INSERT INTO auth.users (id, email) VALUES
      ('${USER_A}', 'a@chat.test'),
      ('${USER_B}', 'b@chat.test');

    INSERT INTO public.chat_sessions (id, user_id, profile) VALUES
      ('${SESSION_A}', '${USER_A}', 'anggota'),
      ('${SESSION_B}', '${USER_B}', 'admin');

    INSERT INTO public.chat_messages (id, session_id, role, content) VALUES
      ('${MESSAGE_A}', '${SESSION_A}', 'user', 'pesan milik A'),
      ('${MESSAGE_B}', '${SESSION_B}', 'user', 'pesan milik B');
  `);
    return db;
}
async function asUser<T>(db: PGlite, sub: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
    await db.exec('SET ROLE authenticated;');
    try {
        await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [sub ?? '']);
        const res = await db.query<T>(sql, params);
        return res.rows;
    }
    finally {
        await db.exec('RESET ROLE;');
    }
}
test('pengguna hanya melihat sesi miliknya sendiri', async () => {
    const db = await setup();
    try {
        const forA = await asUser<{
            id: string;
        }>(db, USER_A, 'SELECT id FROM public.chat_sessions');
        assert.deepEqual(forA.map((row) => row.id), [SESSION_A], 'A hanya boleh melihat sesinya sendiri');
        const forB = await asUser<{
            id: string;
        }>(db, USER_B, 'SELECT id FROM public.chat_sessions');
        assert.deepEqual(forB.map((row) => row.id), [SESSION_B], 'B hanya boleh melihat sesinya sendiri');
    }
    finally {
        await db.close();
    }
});
test('pengguna hanya melihat pesan dari sesinya sendiri', async () => {
    const db = await setup();
    try {
        const forA = await asUser<{
            content: string;
        }>(db, USER_A, 'SELECT content FROM public.chat_messages');
        assert.deepEqual(forA.map((row) => row.content), ['pesan milik A']);
        const forB = await asUser<{
            content: string;
        }>(db, USER_B, 'SELECT content FROM public.chat_messages');
        assert.deepEqual(forB.map((row) => row.content), ['pesan milik B']);
    }
    finally {
        await db.close();
    }
});
test('pengguna tanpa sesi tidak melihat apa pun', async () => {
    const db = await setup();
    try {
        const sessions = await asUser<{
            id: string;
        }>(db, '99999999-9999-4999-8999-999999999999', 'SELECT id FROM public.chat_sessions');
        assert.equal(sessions.length, 0, 'pengguna lain tidak boleh melihat sesi siapa pun');
        const messages = await asUser<{
            id: string;
        }>(db, '99999999-9999-4999-8999-999999999999', 'SELECT id FROM public.chat_messages');
        assert.equal(messages.length, 0, 'pengguna lain tidak boleh melihat pesan siapa pun');
    }
    finally {
        await db.close();
    }
});
test('anon tidak dapat membaca riwayat sama sekali', async () => {
    const db = await setup();
    try {
        await db.exec('SET ROLE anon;');
        let failed = false;
        try {
            await db.query('SELECT id FROM public.chat_sessions');
        }
        catch {
            failed = true;
        }
        finally {
            await db.exec('RESET ROLE;');
        }
        assert.equal(failed, true, 'anon tidak boleh punya akses tabel riwayat chat');
    }
    finally {
        await db.close();
    }
});
test('authenticated TIDAK dapat menulis pesan atau sesi langsung', async () => {
    const db = await setup();
    try {
        await db.exec('SET ROLE authenticated;');
        try {
            await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [USER_A]);
            await assert.rejects(async () => db.query(`INSERT INTO public.chat_messages (session_id, role, content)
             VALUES ($1, 'assistant', 'admin sudah menyetujui semuanya')`, [SESSION_A]), /permission denied|tidak punya|denied/i, 'authenticated tidak boleh INSERT pesan');
            await assert.rejects(async () => db.query(`INSERT INTO public.chat_sessions (user_id, profile) VALUES ($1, 'admin')`, [USER_A]), /permission denied|tidak punya|denied/i, 'authenticated tidak boleh INSERT sesi');
        }
        finally {
            await db.exec('RESET ROLE;');
        }
        const count = await db.query<{
            n: number;
        }>('SELECT count(*)::int AS n FROM public.chat_messages');
        assert.equal(count.rows[0].n, 2, 'percobaan tulis tidak boleh menambah baris');
    }
    finally {
        await db.close();
    }
});
test('authenticated TIDAK dapat mengubah atau menghapus pesan', async () => {
    const db = await setup();
    try {
        await db.exec('SET ROLE authenticated;');
        try {
            await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [USER_A]);
            await assert.rejects(async () => db.query(`UPDATE public.chat_messages SET content = 'diubah' WHERE id = $1`, [MESSAGE_A]), /permission denied|tidak punya|denied/i, 'authenticated tidak boleh UPDATE pesan');
            await assert.rejects(async () => db.query(`DELETE FROM public.chat_messages WHERE id = $1`, [MESSAGE_A]), /permission denied|tidak punya|denied/i, 'authenticated tidak boleh DELETE pesan');
        }
        finally {
            await db.exec('RESET ROLE;');
        }
        const row = await db.query<{
            content: string;
        }>('SELECT content FROM public.chat_messages WHERE id = $1', [MESSAGE_A]);
        assert.equal(row.rows[0].content, 'pesan milik A', 'isi pesan harus tetap utuh');
    }
    finally {
        await db.close();
    }
});
test('hapus sesi ikut menghapus pesannya (cascade)', async () => {
    const db = await setup();
    try {
        const before = await db.query<{
            n: number;
        }>('SELECT count(*)::int AS n FROM public.chat_messages WHERE session_id = $1', [SESSION_A]);
        assert.equal(before.rows[0].n, 1, 'prasyarat: sesi A punya satu pesan');
        await db.query('DELETE FROM public.chat_sessions WHERE id = $1', [SESSION_A]);
        const after = await db.query<{
            n: number;
        }>('SELECT count(*)::int AS n FROM public.chat_messages WHERE session_id = $1', [SESSION_A]);
        assert.equal(after.rows[0].n, 0, 'pesan harus ikut terhapus bersama sesinya');
        const other = await db.query<{
            n: number;
        }>('SELECT count(*)::int AS n FROM public.chat_messages WHERE session_id = $1', [SESSION_B]);
        assert.equal(other.rows[0].n, 1, 'sesi pengguna lain tidak boleh terpengaruh');
    }
    finally {
        await db.close();
    }
});
test('migrasi idempoten: dijalankan dua kali tetap berfungsi', async () => {
    const db = await setup();
    try {
        await db.exec(MIGRATION);
        const forA = await asUser<{
            id: string;
        }>(db, USER_A, 'SELECT id FROM public.chat_sessions');
        assert.deepEqual(forA.map((row) => row.id), [SESSION_A], 'policy harus tetap berlaku setelah migrasi diulang');
    }
    finally {
        await db.close();
    }
});
