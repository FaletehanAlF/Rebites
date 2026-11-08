import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const MIGRATION = readFileSync(new URL('../supabase/migrations/20261107000000_admin_product_soft_delete.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ADMIN = '00000000-0000-4000-8000-00000000000a';
const OWNER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const STORE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PRODUCT_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PRODUCT_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const FIXTURE_DDL = `
CREATE SCHEMA auth;

CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text);

-- Meniru implementasi Supabase: claim dibaca dari GUC.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Karena auth.jwt() dibaca trigger sebagai penanda jalur service_role.
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  role text NOT NULL DEFAULT 'buyer',
  full_name text
);

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
$$;

CREATE TABLE public.umkm_profiles (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  business_name text
);

-- Salinan sebelum migrasi baru: deleted_at SUDAH ada (migrasi 20261029000100),
-- kolom jejak admin BELUM ada. Dengan begitu tes benar-benar membuktikan
-- migrasi inilah yang menambahkannya.
CREATE TABLE public.products (
  id uuid PRIMARY KEY,
  umkm_id uuid REFERENCES public.umkm_profiles(id),
  name text,
  status text NOT NULL DEFAULT 'available',
  verification_status text NOT NULL DEFAULT 'approved',
  deleted_at timestamptz
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select_own_or_admin" ON public.products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.umkm_profiles u
      WHERE u.id = products.umkm_id AND u.user_id = auth.uid()
    )
    OR public.is_admin()
  );

CREATE POLICY "products_update_own_or_admin" ON public.products FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.umkm_profiles u
      WHERE u.id = products.umkm_id AND u.user_id = auth.uid()
    )
    OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.umkm_profiles u
      WHERE u.id = products.umkm_id AND u.user_id = auth.uid()
    )
    OR public.is_admin()
  );

-- Schema auth juga perlu USAGE: policy memanggil auth.uid() sebagai PEMANGGIL.
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT SELECT, UPDATE ON public.products TO authenticated;
GRANT SELECT ON public.umkm_profiles TO authenticated;

INSERT INTO auth.users (id, email) VALUES
  ('${ADMIN}', 'admin@tok.test'),
  ('${OWNER}', 'owner@tok.test'),
  ('${OTHER}', 'other@tok.test');

INSERT INTO public.profiles (id, role, full_name) VALUES
  ('${ADMIN}', 'admin', 'Admin Uji'),
  ('${OWNER}', 'umkm', 'Pemilik Toko'),
  ('${OTHER}', 'umkm', 'Pemilik Lain');

INSERT INTO public.umkm_profiles (id, user_id, business_name)
  VALUES ('${STORE}', '${OWNER}', 'Dapur Uji');

INSERT INTO public.products (id, umkm_id, name) VALUES
  ('${PRODUCT_A}', '${STORE}', 'Produk A'),
  ('${PRODUCT_B}', '${STORE}', 'Produk B');
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
async function asService<T = Record<string, unknown>>(db: PGlite, sql: string): Promise<T[]> {
    await db.query(`SELECT set_config('request.jwt.claim.sub', '', false)`);
    await db.query(`SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false)`);
    try {
        const res = await db.query<T>(sql);
        return res.rows;
    }
    finally {
        await db.query(`SELECT set_config('request.jwt.claims', '{}', false)`);
    }
}
async function kolom(db: PGlite, tabel: string): Promise<string[]> {
    const res = await db.query<{
        column_name: string;
    }>(`SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY column_name`, [tabel]);
    return res.rows.map((r) => r.column_name);
}
async function trigger(db: PGlite, tabel: string): Promise<string[]> {
    const res = await db.query<{
        tgname: string;
    }>(`SELECT t.tgname
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1 AND NOT t.tgisinternal
      ORDER BY t.tgname`, [tabel]);
    return res.rows.map((r) => r.tgname);
}
interface ProductRow {
    deleted_at: string | null;
    deleted_by: string | null;
    deletion_reason: string | null;
}
async function bacaProduk(db: PGlite, id: string): Promise<ProductRow> {
    const res = await db.query<ProductRow>(`SELECT deleted_at, deleted_by, deletion_reason FROM public.products WHERE id = '${id}'`);
    assert.ok(res.rows[0], 'produk harus ada');
    return res.rows[0];
}
test('A. migrasi menambah kolom jejak penghapusan di products', async () => {
    const db = await setup();
    const cols = await kolom(db, 'products');
    for (const c of ['deleted_at', 'deleted_by', 'deletion_reason']) {
        assert.ok(cols.includes(c), `kolom ${c} harus ada`);
    }
    await db.close();
});
test('B. trigger pengunci terpasang di products', async () => {
    const db = await setup();
    const triggers = await trigger(db, 'products');
    assert.ok(triggers.includes('trg_products_lock_deletion'), `trigger: ${triggers.join(', ')}`);
    await db.close();
});
test('C. penjual menarik produknya sendiri, tetapi tidak menulis jejak admin', async () => {
    const db = await setup();
    await asRole(db, 'authenticated', OWNER, `UPDATE public.products SET deleted_at = now() WHERE id = '${PRODUCT_A}'`);
    const afterPull = await bacaProduk(db, PRODUCT_A);
    assert.ok(afterPull.deleted_at, 'penjual berhak menarik produknya sendiri');
    assert.equal(afterPull.deleted_by, null, 'penjual tidak boleh mengisi deleted_by');
    await asRole(db, 'authenticated', OWNER, `UPDATE public.products
        SET deleted_by = '${ADMIN}', deletion_reason = 'palsu'
      WHERE id = '${PRODUCT_A}'`);
    const afterForge = await bacaProduk(db, PRODUCT_A);
    assert.equal(afterForge.deleted_by, null, 'deleted_by harus dikembalikan ke OLD');
    assert.equal(afterForge.deletion_reason, null, 'deletion_reason harus dikembalikan ke OLD');
    await db.close();
});
test('D. penjual tidak dapat menghidupkan produk yang dihapus admin', async () => {
    const db = await setup();
    await asRole(db, 'authenticated', ADMIN, `UPDATE public.products
        SET deleted_at = now(), deleted_by = '${ADMIN}', deletion_reason = 'melanggar aturan'
      WHERE id = '${PRODUCT_B}'`);
    const afterAdmin = await bacaProduk(db, PRODUCT_B);
    assert.ok(afterAdmin.deleted_at);
    assert.equal(afterAdmin.deleted_by, ADMIN);
    await asRole(db, 'authenticated', OWNER, `UPDATE public.products SET deleted_at = NULL WHERE id = '${PRODUCT_B}'`);
    const afterAttempt = await bacaProduk(db, PRODUCT_B);
    assert.ok(afterAttempt.deleted_at, 'penjual tidak boleh memulihkan produk yang dihapus admin');
    await db.close();
});
test('E. admin menghapus dan memulihkan lengkap dengan jejaknya', async () => {
    const db = await setup();
    await asRole(db, 'authenticated', ADMIN, `UPDATE public.products
        SET deleted_at = now(), deleted_by = '${ADMIN}', deletion_reason = 'alasan uji'
      WHERE id = '${PRODUCT_A}'`);
    const deleted = await bacaProduk(db, PRODUCT_A);
    assert.equal(deleted.deleted_by, ADMIN);
    assert.equal(deleted.deletion_reason, 'alasan uji');
    await asRole(db, 'authenticated', ADMIN, `UPDATE public.products
        SET deleted_at = NULL, deleted_by = NULL, deletion_reason = NULL
      WHERE id = '${PRODUCT_A}'`);
    const restored = await bacaProduk(db, PRODUCT_A);
    assert.equal(restored.deleted_at, null);
    assert.equal(restored.deleted_by, null);
    assert.equal(restored.deletion_reason, null);
    await db.close();
});
test('F. jalur service_role (server aplikasi) dikecualikan', async () => {
    const db = await setup();
    await asService(db, `UPDATE public.products
        SET deleted_at = now(), deleted_by = '${ADMIN}', deletion_reason = 'lewat server'
      WHERE id = '${PRODUCT_A}'`);
    const row = await bacaProduk(db, PRODUCT_A);
    assert.ok(row.deleted_at, 'jalur service_role harus menulis apa adanya');
    assert.equal(row.deletion_reason, 'lewat server');
    await db.close();
});
test('G. idempoten: migrasi dijalankan dua kali tetap berfungsi', async () => {
    const db = await setup();
    await db.exec(MIGRATION);
    const cols = await kolom(db, 'products');
    assert.ok(cols.includes('deleted_by'));
    const triggers = await trigger(db, 'products');
    assert.equal(triggers.filter((t) => t === 'trg_products_lock_deletion').length, 1);
    await asRole(db, 'authenticated', OWNER, `UPDATE public.products
        SET deleted_by = '${ADMIN}'
      WHERE id = '${PRODUCT_A}'`);
    const row = await bacaProduk(db, PRODUCT_A);
    assert.equal(row.deleted_by, null, 'pengunci harus tetap berlaku setelah rerun');
    await db.close();
});
