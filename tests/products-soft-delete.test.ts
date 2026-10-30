/**
 * Regresi soft delete produk (BUG.md: admin tidak bisa membuka detail produk
 * yang sudah dihapus penjual).
 *
 * GEJALA di BUG.md:
 *   - Admin membuka detail produk yang sudah dihapus -> 404
 *     "Gagal Memuat detail produk".
 *
 * AKAR MASALAH:
 *   `deleteSellerProduct` menjalankan DELETE fisik. Begitu baris hilang, tidak
 *   ada yang bisa dibuka admin dan riwayat moderasinya ikut terputus.
 *
 * PERBAIKAN:
 *   migration 20261029000100 menambah `products.deleted_at` dan mengatur RLS:
 *     - publik  : approved DAN deleted_at IS NULL
 *     - penjual : produk miliknya DAN deleted_at IS NULL
 *     - admin   : semua baris (policy tidak diubah)
 *
 * TES INI menjalankan migrasi tersebut pada PGlite dan memeriksa matriks
 * visibilitas per peran. Jalankan: node --test tests/products-soft-delete.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const MIGRATION = readFileSync(
  new URL('../supabase/migrations/20261029000100_products_soft_delete.sql', import.meta.url),
  'utf8'
);

const ADMIN = '00000000-0000-4000-8000-00000000000a';
const OWNER = '11111111-1111-4111-8111-111111111111';
const STRANGER = '22222222-2222-4222-8222-222222222222';
const STORE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LIVE = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1';
const DELETED = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2';
const PENDING = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3';

const FIXTURE_DDL = `
CREATE SCHEMA auth;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text
);

-- Meniru implementasi Supabase: claim dibaca dari GUC.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  role text NOT NULL DEFAULT 'buyer'
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

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  umkm_id uuid NOT NULL REFERENCES public.umkm_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  verification_status text NOT NULL DEFAULT 'approved'
);

-- Kebijakan yang berlaku SEBELUM migrasi soft delete (hasil 20261011000000).
-- Tanpa policy admin, migrasi hanya akan menguji dua dari tiga peran.
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- GRANT setara Supabase: RLS yang membatasi baris, GRANT yang memberi akses
-- tabel. Tanpa ini query sebagai anon/authenticated ditolak sebelum RLS
-- sempat dinilai, dan yang teruji bukan lagi policy.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT SELECT ON public.products TO anon, authenticated;
GRANT SELECT ON public.umkm_profiles TO anon, authenticated;
GRANT SELECT ON public.profiles TO anon, authenticated;

CREATE POLICY "products_select_public" ON public.products FOR SELECT
  TO anon, authenticated USING (verification_status = 'approved');

CREATE POLICY "products_select_admin" ON public.products FOR SELECT
  TO authenticated USING (public.is_admin());

CREATE POLICY "products_select_own" ON public.products FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.umkm_profiles u
      WHERE u.id = products.umkm_id AND u.user_id = auth.uid()
    )
  );
`;

type Ids = { id: string };

async function setup(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(FIXTURE_DDL);
  await db.exec(`INSERT INTO auth.users (id, email) VALUES
    ('${ADMIN}', 'admin@tok.test'),
    ('${OWNER}', 'owner@tok.test'),
    ('${STRANGER}', 'stranger@tok.test');
  INSERT INTO public.profiles (id, role) VALUES
    ('${ADMIN}', 'admin'),
    ('${OWNER}', 'umkm'),
    ('${STRANGER}', 'buyer');
  INSERT INTO public.umkm_profiles (id, user_id, business_name)
    VALUES ('${STORE}', '${OWNER}', 'Dapur Uji');
  INSERT INTO public.products (id, umkm_id, name, verification_status) VALUES
    ('${LIVE}', '${STORE}', 'Nasi Masih Tayang', 'approved'),
    ('${DELETED}', '${STORE}', 'Nasi Sudah Dihapus', 'approved'),
    ('${PENDING}', '${STORE}', 'Nasi Menunggu', 'pending');`);
  return db;
}

/** Jalankan query sebagai peran tertentu; RLS aktif karena bukan superuser. */
async function asRole(
  db: PGlite,
  role: 'anon' | 'authenticated' | 'admin',
  sub: string | null
): Promise<Id[]> {
  await db.exec(`SET ROLE ${role === 'admin' ? 'authenticated' : role};`);
  if (sub) {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [sub]);
  } else {
    await db.query(`SELECT set_config('request.jwt.claim.sub', '', false)`);
  }
  const res = await db.query<Id>('SELECT id FROM public.products ORDER BY name');
  await db.exec('RESET ROLE;');
  return res.rows;
}

async function applyMigration(db: PGlite): Promise<void> {
  await db.exec(MIGRATION);
}

test('migrasi menambah kolom deleted_at dan menandainya untuk produk "terhapus"', async () => {
  const db = await setup();
  try {
    await applyMigration(db);
    await db.query(`UPDATE public.products SET deleted_at = now() WHERE id = '${DELETED}'`);
    const res = await db.query<{ total: number; deleted: number }>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS deleted
         FROM public.products`
    );
    // Soft delete TIDAK boleh menghapus baris: inilah yang membuat admin
    // masih bisa membuka detail beserta riwayatnya.
    assert.equal(res.rows[0].total, 3);
    assert.equal(res.rows[0].deleted, 1);
  } finally {
    await db.close();
  }
});

test('pembeli tidak melihat produk yang sudah dihapus penjual', async () => {
  const db = await setup();
  try {
    await applyMigration(db);
    await db.query(`UPDATE public.products SET deleted_at = now() WHERE id = '${DELETED}'`);

    const anon = await asRole(db, 'anon', null);
    const ids = anon.map((r) => r.id);
    assert.ok(ids.includes(LIVE), 'produk tayang harus terlihat pembeli');
    assert.ok(!ids.includes(DELETED), 'produk terhapus tidak boleh terlihat pembeli');
    assert.ok(!ids.includes(PENDING), 'produk pending tidak boleh terlihat pembeli');

    const buyer = await asRole(db, 'authenticated', STRANGER);
    const buyerIds = buyer.map((r) => r.id);
    assert.ok(buyerIds.includes(LIVE));
    assert.ok(!buyerIds.includes(DELETED));
  } finally {
    await db.close();
  }
});

test('penjual tetap melihat produk rejected, tetapi tidak yang sudah ia hapus', async () => {
  const db = await setup();
  try {
    await applyMigration(db);
    await db.query(
      `UPDATE public.products
          SET deleted_at = now(), verification_status = 'rejected'
        WHERE id = '${DELETED}'`
    );

    const own = await asRole(db, 'authenticated', OWNER);
    const ids = own.map((r) => r.id);
    assert.ok(ids.includes(LIVE), 'produk aktif pemilik tetap terlihat');
    assert.ok(ids.includes(PENDING), 'produk pending pemilik tetap terlihat');
    assert.ok(
      !ids.includes(DELETED),
      'produk yang ditarik penjual tidak tampil lagi di Menu Saya'
    );
  } finally {
    await db.close();
  }
});

test('admin tetap melihat produk yang sudah dihapus penjual (BUG.md utama)', async () => {
  const db = await setup();
  try {
    await applyMigration(db);
    await db.query(`UPDATE public.products SET deleted_at = now() WHERE id = '${DELETED}'`);

    const admin = await asRole(db, 'admin', ADMIN);
    const ids = admin.map((r) => r.id);
    assert.ok(ids.includes(DELETED), 'admin harus bisa membuka produk terhapus');
    assert.ok(ids.includes(PENDING), 'admin harus melihat produk pending');
    assert.ok(ids.includes(LIVE));
  } finally {
    await db.close();
  }
});

test('migrasi idempoten: dijalankan dua kali tetap berfungsi', async () => {
  const db = await setup();
  try {
    await applyMigration(db);
    await applyMigration(db);
    await db.query(`UPDATE public.products SET deleted_at = now() WHERE id = '${DELETED}'`);

    const admin = await asRole(db, 'admin', ADMIN);
    assert.ok(admin.map((r) => r.id).includes(DELETED));

    const anon = await asRole(db, 'anon', null);
    assert.ok(!anon.map((r) => r.id).includes(DELETED));
  } finally {
    await db.close();
  }
});
