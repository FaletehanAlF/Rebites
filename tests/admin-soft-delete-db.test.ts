import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const MIGRATION = readFileSync(new URL('../supabase/migrations/20261106000000_admin_soft_delete.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
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

-- Karena auth.jwt() dibaca trigger sebagai penanda jalur service_role.
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;

-- Salinan kolom sebelum migrasi: TANPA kolom penghapusan, supaya tes benar
-- benar membuktikan migrasi yang menambahkannya.
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
  business_name text,
  is_active boolean NOT NULL DEFAULT true,
  deactivation_reason text,
  deactivated_at timestamptz
);

-- RLS + GRANT setara Supabase. Tanpa keduanya, UPDATE dari role authenticated
-- ditolak di lapisan hak akses tabel SEBELUM trigger sempat dinilai — dan yang
-- teruji bukan lagi aturan yang kita maksud.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.umkm_profiles ENABLE ROW LEVEL SECURITY;

-- Policy produksi (disederhanakan): pemilik boleh update barisnya, admin boleh
-- update baris siapa pun.
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "umkm_update_own_or_admin" ON public.umkm_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Policy SELECT WAJIB ada di samping policy UPDATE. Dengan RLS menyala,
-- PostgreSQL memakai policy SELECT saat mencari baris yang akan di-UPDATE;
-- tanpa policy SELECT, UPDATE mengembalikan 0 baris TANPA error — kegagalan
-- senyap yang membuat tes mengukur hal yang salah. Dibuktikan dengan probe:
-- bahkan policy USING (true) tidak menyentuh satu baris pun saat policy
-- SELECT-nya tidak ada.
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "umkm_select_own_or_admin" ON public.umkm_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- Schema auth juga perlu USAGE. Policy memanggil auth.uid() sebagai PEMANGGIL
-- (SECURITY INVOKER); tanpa USAGE, evaluasi policy gagal sehingga UPDATE tidak
-- menyentuh satu baris pun, dan tes mengukur hal yang salah.
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, UPDATE ON public.umkm_profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.umkm_profiles TO anon;

INSERT INTO auth.users (id, email) VALUES
  ('${ADMIN}', 'admin@tok.test'),
  ('${OWNER}', 'owner@tok.test'),
  ('${BUYER}', 'buyer@tok.test');

INSERT INTO public.profiles (id, role, full_name) VALUES
  ('${ADMIN}', 'admin', 'Admin Uji'),
  ('${OWNER}', 'umkm', 'Pemilik Toko'),
  ('${BUYER}', 'buyer', 'Pembeli Uji');

INSERT INTO public.umkm_profiles (id, user_id, business_name)
  VALUES ('${STORE}', '${OWNER}', 'Dapur Uji');
`;
async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(FIXTURE_DDL);
    await db.exec(MIGRATION);
    return db;
}
async function asRole(db: PGlite, role: 'anon' | 'authenticated', sub: string | null, sql: string): Promise<void> {
    await db.exec(`SET ROLE ${role};`);
    if (sub) {
        await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [sub]);
    }
    else {
        await db.query(`SELECT set_config('request.jwt.claim.sub', '', false)`);
    }
    try {
        await db.exec(sql);
    }
    finally {
        await db.exec('RESET ROLE;');
    }
}
async function asService(db: PGlite, sql: string): Promise<void> {
    await db.query(`SELECT set_config('request.jwt.claim.sub', '', false)`);
    await db.query(`SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false)`);
    try {
        await db.exec(sql);
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
test('migrasi menambah kolom jejak penghapusan di profiles dan umkm_profiles', async () => {
    const db = await setup();
    try {
        const profil = await kolom(db, 'profiles');
        for (const c of ['deleted_at', 'deleted_by', 'deletion_reason']) {
            assert.ok(profil.includes(c), `profiles harus punya kolom ${c}`);
        }
        const toko = await kolom(db, 'umkm_profiles');
        for (const c of ['deleted_at', 'deleted_by', 'deletion_reason']) {
            assert.ok(toko.includes(c), `umkm_profiles harus punya kolom ${c}`);
        }
    }
    finally {
        await db.close();
    }
});
test('migrasi memasang trigger pengunci di dua tabel', async () => {
    const db = await setup();
    try {
        assert.ok((await trigger(db, 'profiles')).includes('trg_profiles_lock_deletion'));
        const t = await trigger(db, 'umkm_profiles');
        assert.ok(t.includes('trg_umkm_lock_deletion'), 'pengunci jejak penghapusan toko');
        assert.ok(t.includes('trg_umkm_deleted_store_inactive'), 'penjaga toko terhapus tetap nonaktif');
    }
    finally {
        await db.close();
    }
});
test('pengguna biasa TIDAK dapat mengubah jejak penghapusan akunnya sendiri', async () => {
    const db = await setup();
    try {
        await asService(db, `UPDATE public.profiles SET deleted_at = now() WHERE id = '${BUYER}'`);
        await asRole(db, 'authenticated', BUYER, `UPDATE public.profiles
          SET deleted_at = NULL, deleted_by = NULL, deletion_reason = NULL,
              full_name = 'Nama Baru'
        WHERE id = '${BUYER}'`);
        const res = await db.query<{
            deleted_at: unknown;
            full_name: string;
        }>(`SELECT deleted_at, full_name FROM public.profiles WHERE id = '${BUYER}'`);
        assert.notEqual(res.rows[0].deleted_at, null, 'pengguna biasa tidak boleh memulihkan akunnya sendiri');
        assert.equal(res.rows[0].full_name, 'Nama Baru');
    }
    finally {
        await db.close();
    }
});
test('admin dapat menulis dan mengosongkan jejak penghapusan', async () => {
    const db = await setup();
    try {
        await asRole(db, 'authenticated', ADMIN, `UPDATE public.profiles
          SET deleted_at = now(), deleted_by = '${ADMIN}', deletion_reason = 'Penipuan berulang'
        WHERE id = '${BUYER}'`);
        let res = await db.query<{
            deleted_at: unknown;
            deletion_reason: string;
        }>(`SELECT deleted_at, deletion_reason FROM public.profiles WHERE id = '${BUYER}'`);
        assert.notEqual(res.rows[0].deleted_at, null, 'admin harus dapat menandai akun terhapus');
        assert.equal(res.rows[0].deletion_reason, 'Penipuan berulang');
        await asRole(db, 'authenticated', ADMIN, `UPDATE public.profiles SET deleted_at = NULL, deleted_by = NULL, deletion_reason = NULL
        WHERE id = '${BUYER}'`);
        res = await db.query(`SELECT deleted_at FROM public.profiles WHERE id = '${BUYER}'`);
        assert.equal(res.rows[0].deleted_at, null, 'pemulihan admin harus benar-benar mengosongkan');
    }
    finally {
        await db.close();
    }
});
test('jalur service_role dikecualikan dari pengunci', async () => {
    const db = await setup();
    try {
        await db.exec(`SELECT set_config('request.jwt.claims', '{"role":"service_role"}', false)`);
        await db.exec(`SELECT set_config('request.jwt.claim.sub', '', false)`);
        await db.exec(`UPDATE public.profiles SET deleted_at = now() WHERE id = '${BUYER}'`);
        const res = await db.query<{
            deleted_at: unknown;
        }>(`SELECT deleted_at FROM public.profiles WHERE id = '${BUYER}'`);
        assert.notEqual(res.rows[0].deleted_at, null, 'server aplikasi (service_role) harus dapat menulis jejak penghapusan');
    }
    finally {
        await db.close();
    }
});
test('toko yang dihapus tidak dapat diaktifkan kembali lewat UPDATE biasa', async () => {
    const db = await setup();
    try {
        await asRole(db, 'authenticated', ADMIN, `UPDATE public.umkm_profiles
          SET deleted_at = now(), deleted_by = '${ADMIN}',
              deletion_reason = 'Pelanggaran berulang', is_active = false
        WHERE id = '${STORE}'`);
        await asRole(db, 'authenticated', ADMIN, `UPDATE public.umkm_profiles SET is_active = true WHERE id = '${STORE}'`);
        const res = await db.query<{
            is_active: boolean;
            deleted_at: unknown;
        }>(`SELECT is_active, deleted_at FROM public.umkm_profiles WHERE id = '${STORE}'`);
        assert.equal(res.rows[0].is_active, false, 'toko terhapus harus tetap nonaktif selama deleted_at terisi');
        assert.notEqual(res.rows[0].deleted_at, null, 'jejak penghapusan tetap utuh');
    }
    finally {
        await db.close();
    }
});
test('pemulihan mengembalikan toko ke katalog (deleted_at kosong + aktif)', async () => {
    const db = await setup();
    try {
        await asService(db, `UPDATE public.umkm_profiles
          SET deleted_at = now(), is_active = false
        WHERE id = '${STORE}'`);
        await asRole(db, 'authenticated', ADMIN, `UPDATE public.umkm_profiles
          SET deleted_at = NULL, deleted_by = NULL, deletion_reason = NULL, is_active = true
        WHERE id = '${STORE}'`);
        const res = await db.query<{
            is_active: boolean;
            deleted_at: unknown;
        }>(`SELECT is_active, deleted_at FROM public.umkm_profiles WHERE id = '${STORE}'`);
        assert.equal(res.rows[0].deleted_at, null);
        assert.equal(res.rows[0].is_active, true, 'setelah dipulihkan, toko harus dapat aktif kembali');
    }
    finally {
        await db.close();
    }
});
test('migrasi idempoten: dijalankan dua kali tetap berfungsi', async () => {
    const db = await setup();
    try {
        await db.exec(MIGRATION);
        const profil = await kolom(db, 'profiles');
        assert.equal(profil.filter((c) => c === 'deleted_at').length, 1);
        await asService(db, `UPDATE public.profiles SET deleted_at = now() WHERE id = '${BUYER}'`);
        await asRole(db, 'authenticated', BUYER, `UPDATE public.profiles SET deleted_at = NULL WHERE id = '${BUYER}'`);
        const res = await db.query<{
            deleted_at: unknown;
        }>(`SELECT deleted_at FROM public.profiles WHERE id = '${BUYER}'`);
        assert.notEqual(res.rows[0].deleted_at, null, 'pengunci harus tetap berlaku setelah migrasi dijalankan dua kali');
    }
    finally {
        await db.close();
    }
});
