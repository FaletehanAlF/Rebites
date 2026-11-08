import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
function readMigration(name: string): string {
    return readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}
const ADMIN = '00000000-0000-4000-8000-00000000000a';
const TARGET = '11111111-1111-4111-8111-111111111111';
const STORE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PRODUCT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORDER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const REVIEW = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const COIN = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const AUDIT = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const SANCTION = '99999999-9999-4999-8999-999999999999';
const ARTICLE = '12121212-1212-4212-8212-121212121212';
const DDL = `
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  full_name text,
  role text NOT NULL DEFAULT 'buyer',
  deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE public.umkm_profiles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY,
  umkm_id uuid NOT NULL REFERENCES public.umkm_profiles(id) ON DELETE CASCADE,
  name text,
  deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY,
  order_code text,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  umkm_id uuid NOT NULL REFERENCES public.umkm_profiles(id) ON DELETE CASCADE,
  order_status text NOT NULL DEFAULT 'pending'
);

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  umkm_id uuid REFERENCES public.umkm_profiles(id) ON DELETE CASCADE
);

CREATE TABLE public.coin_transactions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL DEFAULT 0
);

CREATE TABLE public.sanctions (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sanction_type text NOT NULL,
  reason text NOT NULL DEFAULT ''
);

CREATE TABLE public.warnings (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason text NOT NULL DEFAULT ''
);

CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY,
  admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  reason text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE public.articles (
  id uuid PRIMARY KEY,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title text NOT NULL
);
`;
interface Fixture {
    db: PGlite;
}
async function seed(): Promise<Fixture> {
    const db = new PGlite();
    await db.exec(DDL);
    await db.exec(`
    INSERT INTO auth.users (id, email) VALUES
      ('${ADMIN}', 'admin@rebytes.test'),
      ('${TARGET}', 'target@rebytes.test');

    INSERT INTO public.profiles (id, email, full_name, role) VALUES
      ('${ADMIN}', 'admin@rebytes.test', 'Admin Uji', 'admin'),
      ('${TARGET}', 'target@rebytes.test', 'Penjual Uji', 'umkm');

    INSERT INTO public.umkm_profiles (id, user_id, business_name)
      VALUES ('${STORE}', '${TARGET}', 'Toko Uji');

    INSERT INTO public.products (id, umkm_id, name)
      VALUES ('${PRODUCT}', '${STORE}', 'Produk Uji');

    INSERT INTO public.orders (id, order_code, buyer_id, umkm_id, order_status) VALUES
      ('${ORDER}', 'RB-001', '${TARGET}', '${STORE}', 'completed');

    INSERT INTO public.reviews (id, user_id, umkm_id)
      VALUES ('${REVIEW}', '${TARGET}', '${STORE}');

    INSERT INTO public.coin_transactions (id, user_id, amount)
      VALUES ('${COIN}', '${TARGET}', 150);

    INSERT INTO public.sanctions (id, user_id, sanction_type, reason)
      VALUES ('${SANCTION}', '${TARGET}', 'suspend', 'Uji');

    INSERT INTO public.admin_audit_logs (id, admin_id, action, target_type, target_id, reason, metadata)
      VALUES ('${AUDIT}', '${ADMIN}', 'hard_delete_user', 'user', '${TARGET}', 'Uji hapus', '{"auto": true}'::jsonb);
  `);
    return { db };
}
async function count(db: PGlite, table: string): Promise<number> {
    const res = await db.query<{
        n: number;
    }>(`SELECT count(*)::int AS n FROM public.${table}`);
    return res.rows[0]?.n ?? -1;
}
async function deleteAuthUser(db: PGlite, id: string): Promise<void> {
    await db.exec(`DELETE FROM auth.users WHERE id = '${id}'`);
}
test('cascade: profil, toko, produk, pesanan, ulasan, koin ikut terhapus', async () => {
    const { db } = await seed();
    await deleteAuthUser(db, TARGET);
    assert.equal(await count(db, 'profiles'), 1, 'hanya profil admin yang tersisa');
    assert.equal(await count(db, 'umkm_profiles'), 0, 'toko pemilik ikut terhapus');
    assert.equal(await count(db, 'products'), 0, 'produk toko ikut terhapus');
    assert.equal(await count(db, 'orders'), 0, 'pesanan pembeli/pemilik ikut terhapus');
    assert.equal(await count(db, 'reviews'), 0, 'ulasan ikut terhapus');
    assert.equal(await count(db, 'coin_transactions'), 0, 'transaksi koin ikut terhapus');
});
test('jejak moderasi selamat: sanksi & audit tetap ada setelah akun hilang', async () => {
    const { db } = await seed();
    await deleteAuthUser(db, TARGET);
    const sanction = await db.query<{
        user_id: string | null;
        sanction_type: string;
    }>(`SELECT user_id, sanction_type FROM public.sanctions WHERE id = '${SANCTION}'`);
    assert.equal(sanction.rows.length, 1, 'baris sanksi tidak ikut terhapus');
    assert.equal(sanction.rows[0].user_id, null, 'tautan ke pengguna di-NULL-kan');
    assert.equal(sanction.rows[0].sanction_type, 'suspend');
    const audit = await db.query<{
        target_id: string | null;
        admin_id: string | null;
    }>(`SELECT target_id, admin_id FROM public.admin_audit_logs WHERE id = '${AUDIT}'`);
    assert.equal(audit.rows.length, 1, 'baris audit tidak ikut terhapus');
    assert.equal(audit.rows[0].target_id, TARGET, 'UUID target tetap tercatat');
    assert.equal(audit.rows[0].admin_id, ADMIN, 'pelaku masih tertaut selama akunnya ada');
});
test('menghapus akun admin men-NULL-kan pelakunya, jejak audit tetap ada', async () => {
    const { db } = await seed();
    await deleteAuthUser(db, ADMIN);
    const audit = await db.query<{
        admin_id: string | null;
        target_id: string | null;
    }>(`SELECT admin_id, target_id FROM public.admin_audit_logs WHERE id = '${AUDIT}'`);
    assert.equal(audit.rows.length, 1, 'baris audit tidak ikut terhapus');
    assert.equal(audit.rows[0].admin_id, null, 'tautan pelaku di-NULL-kan');
    assert.equal(audit.rows[0].target_id, TARGET);
});
test('artikel RESTRICT menahan penghapusan penulisnya', async () => {
    const { db } = await seed();
    await db.exec(`INSERT INTO public.articles (id, author_id, title) VALUES ('${ARTICLE}', '${TARGET}', 'Artikel Uji')`);
    await assert.rejects(() => deleteAuthUser(db, TARGET), (err: unknown) => {
        assert.match(String(err), /foreign key constraint/i);
        assert.match(String(err), /articles_author_id_fkey/);
        return true;
    });
    assert.equal(await count(db, 'profiles'), 2);
    await db.exec(`UPDATE public.articles SET author_id = '${ADMIN}' WHERE id = '${ARTICLE}'`);
    await deleteAuthUser(db, TARGET);
    assert.equal(await count(db, 'profiles'), 1);
    assert.equal(await count(db, 'articles'), 1, 'artikel tetap ada dengan penulis baru');
});
test('migrasi nyata memang memuat aturan FK yang ditirukan fixture', () => {
    const base = readMigration('20260806050337_0001_rebites_schema.sql');
    assert.match(base, /id uuid PRIMARY KEY REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
    assert.match(base, /user_id uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
    assert.match(base, /buyer_id uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
    assert.match(base, /umkm_id uuid NOT NULL REFERENCES public\.umkm_profiles\(id\) ON DELETE CASCADE/);
    const align = readMigration('20260824120000_0003_align_frontend_schema.sql');
    assert.match(align, /user_id uuid REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
    assert.match(align, /umkm_id uuid REFERENCES public\.umkm_profiles\(id\) ON DELETE CASCADE/);
    const monitoring = readMigration('20261001000000_admin_monitoring_foundation.sql');
    assert.match(monitoring, /user_id uuid REFERENCES public\.profiles\(id\) ON DELETE SET NULL/);
    assert.match(monitoring, /target_id uuid,/);
    const articles = readMigration('20260930120007_articles.sql');
    assert.match(articles, /author_id uuid NOT NULL REFERENCES public\.profiles\(id\) ON DELETE RESTRICT/);
});
