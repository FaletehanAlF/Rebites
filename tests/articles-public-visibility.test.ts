import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const MIGRATION = readFileSync(new URL('../supabase/migrations/20260930120007_articles.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ADMIN = '00000000-0000-4000-8000-00000000000a';
const AUTHOR = '11111111-1111-4111-8111-111111111111';
const STORE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FIXTURE = `
CREATE SCHEMA auth;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid; $$;
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  full_name text,
  role text NOT NULL DEFAULT 'buyer'
);
CREATE TABLE public.umkm_profiles (id uuid PRIMARY KEY);
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'); $$;
INSERT INTO auth.users (id, email) VALUES ('${ADMIN}', 'admin@x.id'), ('${AUTHOR}', 'penulis@x.id');
INSERT INTO public.profiles (id, email, full_name, role) VALUES
  ('${ADMIN}', 'admin@x.id', 'Admin', 'admin'),
  ('${AUTHOR}', 'penulis@x.id', 'Penulis', 'umkm');
INSERT INTO public.umkm_profiles (id) VALUES ('${STORE}');
`;
const db = new PGlite();
const ready = (async () => {
    await db.exec(FIXTURE);
    await db.exec(MIGRATION);
    await db.exec('GRANT ALL ON public.articles TO anon, authenticated;');
    await db.exec(`INSERT INTO public.articles (id, title, slug, content, status, published_at, author_id) VALUES
    ('12121212-1212-4212-8212-121212121212', 'Terbit', 'terbit', 'isi', 'published', now() - interval '1 day', '${AUTHOR}'),
    ('13131313-1313-4313-8313-131313131313', 'Draf', 'draf', 'isi', 'draft', null, '${AUTHOR}'),
    ('14141414-1414-4414-8414-141414141414', 'Terbit nanti', 'terbit-nanti', 'isi', 'published', now() + interval '1 day', '${AUTHOR}'),
    ('15151515-1515-4515-8515-151515151515', 'Arsip', 'arsip', 'isi', 'archived', now() - interval '1 day', '${AUTHOR}'),
    ('16161616-1616-4616-8616-161616161616', 'Tanpa jadwal', 'tanpa-jadwal', 'isi', 'published', null, '${AUTHOR}')`);
})();
async function asAnon(): Promise<void> {
    await db.exec(`SELECT set_config('request.jwt.claims', '{}', false);`);
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '', false);`);
    await db.exec('SET ROLE anon;');
}
async function asAdmin(): Promise<void> {
    await db.exec(`SELECT set_config('request.jwt.claims', '{}', false);`);
    await db.exec(`SELECT set_config('request.jwt.claim.sub', '${ADMIN}', false);`);
    await db.exec('SET ROLE authenticated;');
}
async function resetRole(): Promise<void> {
    await db.exec('RESET ROLE;');
}
async function visibleSlugs(): Promise<string[]> {
    await asAnon();
    try {
        const rows = await db.query(`SELECT slug FROM public.articles ORDER BY slug`);
        return rows.rows.map((row) => (row as {
            slug: string;
        }).slug);
    }
    finally {
        await resetRole();
    }
}
test('artikel published terbaca publik, draf dan jadwal mendatang tidak', async () => {
    await ready;
    assert.deepEqual(await visibleSlugs(), ['terbit']);
});
test('anon tidak dapat menulis artikel', async () => {
    await ready;
    await asAnon();
    try {
        await assert.rejects(() => db.query(`INSERT INTO public.articles (title, slug, content, author_id) VALUES ('Selundupan', 'selundupan', 'isi', '${AUTHOR}')`));
        const updated = await db.query(`UPDATE public.articles SET title = 'Diubah anon' WHERE slug = 'terbit' RETURNING id`);
        assert.equal(updated.rows.length, 0);
        const deleted = await db.query(`DELETE FROM public.articles WHERE slug = 'terbit' RETURNING id`);
        assert.equal(deleted.rows.length, 0);
    }
    finally {
        await resetRole();
    }
    const after = await db.query(`SELECT title FROM public.articles WHERE slug = 'terbit'`);
    assert.equal((after.rows[0] as {
        title: string;
    }).title, 'Terbit');
});
test('artikel yang dipublish admin langsung terbaca publik di blog', async () => {
    await ready;
    await asAdmin();
    try {
        const updated = await db.query(`UPDATE public.articles SET status = 'published', published_at = now() WHERE slug = 'draf' RETURNING id`);
        assert.equal(updated.rows.length, 1);
    }
    finally {
        await resetRole();
    }
    assert.deepEqual(await visibleSlugs(), ['draf', 'terbit']);
});
test('artikel yang dikembalikan ke draf hilang dari blog', async () => {
    await ready;
    await asAdmin();
    try {
        const updated = await db.query(`UPDATE public.articles SET status = 'draft', published_at = null WHERE slug = 'draf' RETURNING id`);
        assert.equal(updated.rows.length, 1);
    }
    finally {
        await resetRole();
    }
    assert.deepEqual(await visibleSlugs(), ['terbit']);
});
