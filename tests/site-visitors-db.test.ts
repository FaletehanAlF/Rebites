import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const MIGRATION = readFileSync(new URL('../supabase/migrations/20261107000001_site_visitors.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ADMIN = '00000000-0000-4000-8000-00000000000a';
const BUYER = '22222222-2222-4222-8222-222222222222';
const FIXTURE_DDL = `
CREATE SCHEMA auth;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  role text NOT NULL DEFAULT 'buyer',
  full_name text
);

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

INSERT INTO public.profiles (id, role, full_name) VALUES
  ('${ADMIN}', 'admin', 'Admin Uji'),
  ('${BUYER}', 'buyer', 'Pembeli Uji');
`;
async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(FIXTURE_DDL);
    await db.exec(MIGRATION);
    return db;
}
async function asRole<T = Record<string, unknown>>(db: PGlite, role: 'anon' | 'authenticated', sub: string | null, sql: string): Promise<T[]> {
    await db.exec(`SET ROLE ${role};`);
    if (sub) {
        await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [sub]);
    }
    else {
        await db.query(`SELECT set_config('request.jwt.claim.sub', '', false)`);
    }
    try {
        const res = await db.query<T>(sql);
        return res.rows;
    }
    finally {
        await db.exec('RESET ROLE;');
    }
}
async function catat(db: PGlite, key: string, userId: string | null): Promise<void> {
    await db.query('SELECT public.record_site_visit($1, $2)', [key, userId]);
}
test('A. tabel rekap ada, hanya policy SELECT, anon tanpa akses', async () => {
    const db = await setup();
    const tabel = await db.query<{
        tablename: string;
    }>(`SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename LIKE 'site_visitor%'
      ORDER BY tablename`);
    assert.deepEqual(tabel.rows.map((r) => r.tablename), ['site_visitor_days', 'site_visitors']);
    const policy = await db.query<{
        cmd: string;
        policyname: string;
    }>(`SELECT cmd, policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename LIKE 'site_visitor%'
      ORDER BY policyname`);
    assert.equal(policy.rows.length, 2, 'hanya dua policy (masing-masing satu SELECT)');
    for (const row of policy.rows) {
        assert.equal(row.cmd, 'SELECT', `policy ${row.policyname} harus SELECT saja`);
    }
    const hak = await db.query<{
        anon_select: boolean;
        auth_select: boolean;
    }>(`SELECT
       has_table_privilege('anon', 'public.site_visitors', 'SELECT') AS anon_select,
       has_table_privilege('authenticated', 'public.site_visitors', 'SELECT') AS auth_select`);
    assert.equal(hak.rows[0].anon_select, false, 'anon tidak boleh membaca data pengunjung');
    assert.equal(hak.rows[0].auth_select, true, 'authenticated boleh membaca (dibatasi RLS admin)');
    await db.close();
});
test('B. dedup: visitor_key sama menambah kunjungan, bukan baris', async () => {
    const db = await setup();
    await catat(db, 'a:peramban-1', null);
    await catat(db, 'a:peramban-1', null);
    await catat(db, 'a:peramban-2', null);
    const total = await db.query<{
        total: number;
    }>(`SELECT count(*)::int AS total FROM public.site_visitors`);
    assert.equal(total.rows[0].total, 2, 'dua orang berbeda = dua baris');
    const v1 = await db.query<{
        visit_count: number;
        user_id: string | null;
    }>(`SELECT visit_count, user_id FROM public.site_visitors WHERE visitor_key = 'a:peramban-1'`);
    assert.equal(v1.rows[0].visit_count, 2, 'kunjungan berulang menambah hitungan');
    assert.equal(v1.rows[0].user_id, null);
    const hari = await db.query<{
        hari: number;
        total_kunjungan: number;
    }>(`SELECT count(DISTINCT day)::int AS hari, COALESCE(sum(visits), 0)::int AS total_kunjungan
       FROM public.site_visitor_days`);
    assert.equal(hari.rows[0].hari, 1, 'semua kunjungan uji jatuh pada hari yang sama');
    assert.equal(hari.rows[0].total_kunjungan, 3);
    await db.close();
});
test('C. id akun mengisi user_id dan kunjungan anonim tidak menghapusnya', async () => {
    const db = await setup();
    await catat(db, 'a:peramban-3', null);
    await catat(db, 'a:peramban-3', BUYER);
    let row = await db.query<{
        user_id: string | null;
    }>(`SELECT user_id FROM public.site_visitors WHERE visitor_key = 'a:peramban-3'`);
    assert.equal(row.rows[0].user_id, BUYER, 'id akun mengisi user_id saat tersedia');
    await catat(db, 'a:peramban-3', null);
    row = await db.query<{
        user_id: string | null;
    }>(`SELECT user_id FROM public.site_visitors WHERE visitor_key = 'a:peramban-3'`);
    assert.equal(row.rows[0].user_id, BUYER, 'kunjungan anonim tidak boleh mengosongkan user_id');
    await assert.rejects(() => catat(db, '   ', null), /visitor key wajib diisi/);
    await db.close();
});
test('D. authenticated tidak dapat memanggil pencatat', async () => {
    const db = await setup();
    await assert.rejects(() => asRole(db, 'authenticated', BUYER, `SELECT public.record_site_visit('a:palsu', NULL)`), /permission denied/);
    const total = await db.query<{
        total: number;
    }>(`SELECT count(*)::int AS total FROM public.site_visitors`);
    assert.equal(total.rows[0].total, 0, 'tidak ada baris yang tertulis dari percobaan di atas');
    await db.close();
});
test('E. rekap menolak non-admin dan menghitung untuk admin', async () => {
    const db = await setup();
    await catat(db, 'a:peramban-1', null);
    await catat(db, 'a:peramban-1', null);
    await catat(db, 'a:peramban-2', BUYER);
    await assert.rejects(() => asRole(db, 'authenticated', BUYER, `SELECT public.get_visitor_stats(14)`), /Akses ditolak\. Hanya admin\./);
    const res = await asRole<{
        stats: Record<string, unknown>;
    }>(db, 'authenticated', ADMIN, `SELECT public.get_visitor_stats(14) AS stats`);
    const stats = res[0].stats;
    assert.equal(stats.total_visitors, 2);
    assert.equal(stats.total_visits, 3);
    assert.equal(stats.anonymous_visitors, 1);
    assert.equal(stats.registered_visitors, 1);
    assert.equal(stats.today, 2, 'dua orang berbeda hari ini');
    assert.equal(stats.yesterday, 0);
    assert.equal(stats.range_days, 14);
    assert.equal(stats.range_visitors, 2);
    const daily = stats.daily as {
        day: string;
        visitors: number;
        visits: number;
    }[];
    assert.ok(Array.isArray(daily) && daily.length === 1, 'satu hari dalam rekap');
    assert.equal(daily[0].visitors, 2);
    assert.equal(daily[0].visits, 3);
    await db.close();
});
test('F. idempoten: migrasi dijalankan dua kali tetap berfungsi', async () => {
    const db = await setup();
    await db.exec(MIGRATION);
    await catat(db, 'a:peramban-9', null);
    await catat(db, 'a:peramban-9', null);
    const res = await asRole<{
        stats: Record<string, unknown>;
    }>(db, 'authenticated', ADMIN, `SELECT public.get_visitor_stats(7) AS stats`);
    assert.equal(res[0].stats.total_visitors, 1);
    assert.equal(res[0].stats.total_visits, 2);
    await db.close();
});
