/**
 * Regresi: admin dapat menonaktifkan toko UMKM.
 *
 * MASALAH: tidak ada penanda "toko dinonaktifkan admin". Kolom `is_open` milik
 * penjual (buka/tutup harian), jadi admin yang memakainya akan ditimpa penjual
 * pada aksi berikutnya.
 *
 * PERBAIKAN: `umkm_profiles.is_active` + RLS SELECT publik yang mensyaratkannya,
 * ditambah trigger yang mengembalikan nilai lama untuk UPDATE non-admin.
 *
 * TES INI menjalankan migrasi 20261030000000 pada PGlite dan memeriksa:
 *   A. Toko nonaktif tidak terbaca anon/pembeli, tetap terbaca admin.
 *   B. Toko aktif tetap terbaca semua peran (tidak ada regresi).
 *   C. Penjual TIDAK bisa mengaktifkan kembali tokonya sendiri.
 *   D. Admin BISA mengubahnya.
 *
 * Jalankan: node --test tests/umkm-admin-deactivate.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const MIGRATION = readFileSync(
  new URL('../supabase/migrations/20261030000000_umkm_admin_deactivate.sql', import.meta.url),
  'utf8'
).replace(/\r\n/g, '\n');

const ADMIN = '00000000-0000-4000-8000-00000000000a';
const OWNER = '11111111-1111-4111-8111-111111111111';
const BUYER = '22222222-2222-4222-8222-222222222222';
const STORE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const FIXTURE_DDL = `
CREATE SCHEMA auth;

CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text);

-- Meniru implementasi Supabase: claim dibaca dari GUC.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- Dipakai trigger untuk mengenali jalur service_role. Klaim JWT tidak tersedia
-- di PGlite, jadi fungsi mengembalikan objek kosong: auth.jwt() ->> 'role'
-- bernilai NULL dan tidak pernah menyamai 'service_role'.
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  )
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

-- Salinan kolom sebelum migrasi, termasuk yang sudah ada di produksi.
CREATE TABLE public.umkm_profiles (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  business_name text,
  is_open boolean NOT NULL DEFAULT true,
  is_verified boolean NOT NULL DEFAULT false
);

ALTER TABLE public.umkm_profiles ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT SELECT, UPDATE ON public.umkm_profiles TO authenticated;
GRANT SELECT ON public.umkm_profiles TO anon;
GRANT SELECT ON public.profiles TO authenticated;

-- Policy yang berlaku SEBELUM migrasi: publik membaca semua baris.
CREATE POLICY "umkm_select_public" ON public.umkm_profiles FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "umkm_update_own_or_admin" ON public.umkm_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

INSERT INTO auth.users (id, email) VALUES
  ('${ADMIN}', 'admin@tok.test'),
  ('${OWNER}', 'owner@tok.test'),
  ('${BUYER}', 'buyer@tok.test');

INSERT INTO public.profiles (id, role) VALUES
  ('${ADMIN}', 'admin'),
  ('${OWNER}', 'umkm'),
  ('${BUYER}', 'buyer');

INSERT INTO public.umkm_profiles (id, user_id, business_name)
  VALUES ('${STORE}', '${OWNER}', 'Dapur Uji');
`;

async function setup(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(FIXTURE_DDL);
  await db.exec(MIGRATION);
  return db;
}

/** Jalankan query sebagai peran tertentu; RLS aktif karena bukan superuser. */
async function asRole<T>(
  db: PGlite,
  role: 'anon' | 'authenticated',
  sub: string | null,
  sql: string
): Promise<T[]> {
  await db.exec(`SET ROLE ${role};`);
  if (sub) {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [sub]);
  } else {
    await db.query(`SELECT set_config('request.jwt.claim.sub', '', false)`);
  }
  try {
    const res = await db.query<T>(sql);
    return res.rows;
  } finally {
    await db.exec('RESET ROLE;');
  }
}

const SELECT_ACTIVE = `SELECT id, is_active FROM public.umkm_profiles`;

test('toko aktif terlihat oleh anon, pembeli, dan admin (tanpa regresi)', async () => {
  const db = await setup();
  try {
    const anon = await asRole<{ id: string }>(db, 'anon', null, SELECT_ACTIVE);
    assert.equal(anon.length, 1, 'toko aktif harus terlihat anon');

    const buyer = await asRole<{ id: string }>(db, 'authenticated', BUYER, SELECT_ACTIVE);
    assert.equal(buyer.length, 1, 'toko aktif harus terlihat pembeli');

    const admin = await asRole<{ id: string }>(db, 'authenticated', ADMIN, SELECT_ACTIVE);
    assert.equal(admin.length, 1, 'admin tetap melihat toko aktif');
  } finally {
    await db.close();
  }
});

test('toko nonaktif hilang dari pembeli tetapi tetap terbaca admin', async () => {
  const db = await setup();
  try {
    // Deaktivasi dilakukan ADMIN, bukan query superuser: trigger
    // trg_umkm_lock_is_active sengaja menolak UPDATE non-admin, jadi menulis
    // langsung sebagai superuser tidak akan pernah mengubah nilainya.
    await asRole(
      db,
      'authenticated',
      ADMIN,
      `UPDATE public.umkm_profiles SET is_active = false WHERE id = '${STORE}'`
    );

    const anon = await asRole<{ id: string }>(db, 'anon', null, SELECT_ACTIVE);
    assert.equal(anon.length, 0, 'toko nonaktif tidak boleh terlihat anon');

    const buyer = await asRole<{ id: string }>(db, 'authenticated', BUYER, SELECT_ACTIVE);
    assert.equal(buyer.length, 0, 'toko nonaktif tidak boleh terlihat pembeli');

    const admin = await asRole<{ id: string; is_active: boolean }>(
      db,
      'authenticated',
      ADMIN,
      SELECT_ACTIVE
    );
    assert.equal(admin.length, 1, 'admin harus tetap bisa mengelola toko nonaktif');
    assert.equal(admin[0].is_active, false);
  } finally {
    await db.close();
  }
});

test('penjual tidak dapat mengaktifkan kembali tokonya sendiri', async () => {
  const db = await setup();
  try {
    await asRole(
      db,
      'authenticated',
      ADMIN,
      `UPDATE public.umkm_profiles SET is_active = false WHERE id = '${STORE}'`
    );

    await asRole(
      db,
      'authenticated',
      OWNER,
      `UPDATE public.umkm_profiles SET is_active = true WHERE id = '${STORE}'`
    );

    // Dibaca sebagai superuser (RLS dilewati) agar yang dinilai murni nilainya.
    const res = await db.query<{ is_active: boolean }>(
      `SELECT is_active FROM public.umkm_profiles WHERE id = '${STORE}'`
    );
    assert.equal(
      res.rows[0].is_active,
      false,
      'trigger harus mengembalikan is_active ke nilai lama untuk non-admin'
    );

    // Invariant penting: penjual tetap dapat mengubah kolom lain miliknya.
    await asRole(
      db,
      'authenticated',
      OWNER,
      `UPDATE public.umkm_profiles SET is_open = false WHERE id = '${STORE}'`
    );
    const after = await db.query<{ is_open: boolean; is_active: boolean }>(
      `SELECT is_open, is_active FROM public.umkm_profiles WHERE id = '${STORE}'`
    );
    assert.equal(after.rows[0].is_open, false, 'penjual tetap boleh menutup tokonya');
    assert.equal(after.rows[0].is_active, false, 'is_active tidak ikut berubah');
  } finally {
    await db.close();
  }
});

test('admin dapat menonaktifkan dan mengaktifkan kembali toko', async () => {
  const db = await setup();
  try {
    await asRole(
      db,
      'authenticated',
      ADMIN,
      `UPDATE public.umkm_profiles SET is_active = false WHERE id = '${STORE}'`
    );
    let res = await db.query<{ is_active: boolean }>(
      `SELECT is_active FROM public.umkm_profiles WHERE id = '${STORE}'`
    );
    assert.equal(res.rows[0].is_active, false, 'admin harus bisa menonaktifkan');

    await asRole(
      db,
      'authenticated',
      ADMIN,
      `UPDATE public.umkm_profiles SET is_active = true WHERE id = '${STORE}'`
    );
    res = await db.query<{ is_active: boolean }>(
      `SELECT is_active FROM public.umkm_profiles WHERE id = '${STORE}'`
    );
    assert.equal(res.rows[0].is_active, true, 'admin harus bisa mengaktifkan kembali');
  } finally {
    await db.close();
  }
});

test('migrasi idempoten: dijalankan dua kali tetap berfungsi', async () => {
  const db = await setup();
  try {
    await db.exec(MIGRATION);
    // Sama seperti dua test di atas: deaktivasi lewat admin, bukan superuser.
    await asRole(
      db,
      'authenticated',
      ADMIN,
      `UPDATE public.umkm_profiles SET is_active = false WHERE id = '${STORE}'`
    );
    const anon = await asRole<{ id: string }>(db, 'anon', null, SELECT_ACTIVE);
    assert.equal(anon.length, 0);
  } finally {
    await db.close();
  }
});
