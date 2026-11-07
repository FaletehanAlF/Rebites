import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const MIGRATION = readFileSync(new URL('../supabase/migrations/20261029000000_fix_activity_log_array_concat.sql', import.meta.url), 'utf8');
const OWNER = '11111111-1111-4111-8111-111111111111';
const STORE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PRODUCT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
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

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

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

-- Kolom yang dibaca log_product_activity(); sengaja memuat SEMUA kolom yang
-- dipakai blok UPDATE agar kegagalan karena kolom hilang tidak menyamar
-- sebagai kegagalan array.
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  umkm_id uuid NOT NULL REFERENCES public.umkm_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'Lainnya',
  original_price integer NOT NULL DEFAULT 0,
  surplus_price integer NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'available',
  image_url text,
  verification_status text NOT NULL DEFAULT 'approved',
  rejection_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  is_delivery boolean NOT NULL DEFAULT true,
  is_pickup boolean NOT NULL DEFAULT true,
  weight_gram integer,
  length_cm integer,
  width_cm integer,
  height_cm integer,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  activity_type text NOT NULL CHECK (activity_type IN (
    'login','register','product_created','product_updated','product_deleted',
    'order_created','order_cancelled','store_updated','subscription_changed',
    'report_received','warning_received'
  )),
  description text NOT NULL,
  target_type text,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;
async function setup(): Promise<PGlite> {
    const db = new PGlite();
    await db.exec(FIXTURE_DDL);
    await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${OWNER}', 'owner@tok.test');
    INSERT INTO public.profiles (id, role) VALUES ('${OWNER}', 'umkm');
    INSERT INTO public.umkm_profiles (id, user_id, business_name)
      VALUES ('${STORE}', '${OWNER}', 'Dapur Uji');
    INSERT INTO public.products (id, umkm_id, name, stock, surplus_price, original_price)
      VALUES ('${PRODUCT}', '${STORE}', 'Nasi Uji', 10, 9000, 15000);
  `);
    return db;
}
async function installTrigger(db: PGlite): Promise<void> {
    await db.exec(`
    DROP TRIGGER IF EXISTS trg_products_activity_update ON public.products;
    CREATE TRIGGER trg_products_activity_update
      AFTER UPDATE ON public.products
      FOR EACH ROW EXECUTE FUNCTION public.log_product_activity();
  `);
}
async function readLogs(db: PGlite): Promise<Array<{
    activity_type: string;
    metadata: Record<string, unknown>;
}>> {
    const res = await db.query<{
        activity_type: string;
        metadata: Record<string, unknown>;
    }>(`SELECT activity_type, metadata FROM public.activity_logs
      WHERE target_id = '${PRODUCT}'::uuid ORDER BY created_at`);
    return res.rows;
}
test('kontrol: konkatenasi literal tanpa ARRAY gagal dengan malformed array literal', async () => {
    const db = new PGlite();
    try {
        await assert.rejects(() => db.exec(`DO $$
          DECLARE v_changed text[] := '{}';
          BEGIN
            v_changed := v_changed || 'stock';
          END $$;`), (err: unknown) => {
            const msg = String((err as {
                message?: string;
            })?.message ?? err);
            assert.match(msg, /malformed array literal/, `harus "malformed array literal", dapat: ${msg}`);
            return true;
        });
    }
    finally {
        await db.close();
    }
});
test('kontrol: konkatenasi memakai ARRAY berhasil', async () => {
    const db = new PGlite();
    try {
        await db.exec(`DO $$
      DECLARE v_changed text[] := '{}';
      BEGIN
        v_changed := v_changed || ARRAY['stock'];
        IF array_to_string(v_changed, ',') <> 'stock' THEN
          RAISE EXCEPTION 'hasil tak terduga: %', v_changed;
        END IF;
      END $$;`);
    }
    finally {
        await db.close();
    }
});
test('migrasi: dijalankan pada fixture tanpa error', async () => {
    const db = await setup();
    try {
        await db.exec(MIGRATION);
        await installTrigger(db);
    }
    finally {
        await db.close();
    }
});
test('migrasi: UPDATE stok TIDAK lagi melempar (jalur reserve_stock)', async () => {
    const db = await setup();
    try {
        await db.exec(MIGRATION);
        await installTrigger(db);
        await db.exec(`UPDATE public.products SET stock = stock - 1 WHERE id = '${PRODUCT}'`);
        const res = await db.query<{
            stock: number;
        }>(`SELECT stock FROM public.products WHERE id = '${PRODUCT}'`);
        assert.equal(res.rows[0].stock, 9, 'stok harus benar-benar berkurang');
    }
    finally {
        await db.close();
    }
});
test('migrasi: metadata changed_fields terisi nama kolom (bukan pecah per karakter)', async () => {
    const db = await setup();
    try {
        await db.exec(MIGRATION);
        await installTrigger(db);
        await db.exec(`UPDATE public.products SET stock = 7, status = 'available' WHERE id = '${PRODUCT}'`);
        const logs = await readLogs(db);
        const updated = logs.filter((l) => l.activity_type === 'product_updated');
        assert.equal(updated.length, 1, 'tepat satu log product_updated');
        const fields = updated[0].metadata.changed_fields;
        assert.ok(Array.isArray(fields), 'changed_fields harus array JSON');
        assert.deepEqual(fields, ['stock'], 'hanya kolom yang berubah yang dicatat');
        assert.ok(!(fields as string[]).includes('s'), 'tidak boleh ada pecahan karakter');
    }
    finally {
        await db.close();
    }
});
test('migrasi: mengubah verification_status (tunda penayangan) berhasil', async () => {
    const db = await setup();
    try {
        await db.exec(MIGRATION);
        await installTrigger(db);
        await db.exec(`
      UPDATE public.products
         SET verification_status = 'rejected',
             rejection_reason = 'Foto tidak sesuai produk',
             reviewed_at = now()
       WHERE id = '${PRODUCT}'
    `);
        const logs = await readLogs(db);
        const updated = logs.filter((l) => l.activity_type === 'product_updated');
        assert.equal(updated.length, 1);
        assert.deepEqual(updated[0].metadata.changed_fields, ['verification_status'], 'perubahan moderasi tercatat sebagai satu kolom');
        assert.equal(updated[0].metadata.old_verification_status, 'approved');
        assert.equal(updated[0].metadata.new_verification_status, 'rejected');
        assert.equal(updated[0].metadata.rejection_reason, 'Foto tidak sesuai produk');
    }
    finally {
        await db.close();
    }
});
test('migrasi: UPDATE yang hanya menyentuh reviewed_at tidak menulis log', async () => {
    const db = await setup();
    try {
        await db.exec(MIGRATION);
        await installTrigger(db);
        await db.exec(`UPDATE public.products SET reviewed_at = now() WHERE id = '${PRODUCT}'`);
        const logs = await readLogs(db);
        assert.equal(logs.filter((l) => l.activity_type === 'product_updated').length, 0, 'perubahan tanpa makna tidak boleh membanjiri log');
    }
    finally {
        await db.close();
    }
});
test('migrasi idempoten: dijalankan dua kali tetap satu fungsi & tetap berfungsi', async () => {
    const db = await setup();
    try {
        await db.exec(MIGRATION);
        await db.exec(MIGRATION);
        await installTrigger(db);
        await db.exec(`UPDATE public.products SET stock = 3 WHERE id = '${PRODUCT}'`);
        const res = await db.query<{
            n: number;
        }>(`SELECT count(*)::int AS n FROM pg_proc WHERE proname = 'log_product_activity'`);
        assert.equal(res.rows[0].n, 1, 'CREATE OR REPLACE tidak boleh menggandakan fungsi');
    }
    finally {
        await db.close();
    }
});
function stripLineComments(sql: string): string {
    return sql
        .split('\n')
        .map((line) => {
        const idx = line.indexOf('--');
        return idx >= 0 ? line.slice(0, idx) : line;
    })
        .join('\n');
}
test('sumber migrasi: tidak ada lagi konkatenasi literal tanpa ARRAY[...]', () => {
    const raw = readFileSync(new URL('../supabase/migrations/20261029000000_fix_activity_log_array_concat.sql', import.meta.url), 'utf8');
    const sql = stripLineComments(raw);
    const offenders = [...sql.matchAll(/v_changed\s*:=\s*v_changed\s*\|\|\s*'(?!')/g)];
    assert.equal(offenders.length, 0, `masih ada ${offenders.length} konkatenasi literal tanpa ARRAY[...] di SQL migrasi perbaikan`);
    const wrapped = [...sql.matchAll(/v_changed\s*:=\s*v_changed\s*\|\|\s*ARRAY\['/g)];
    assert.ok(wrapped.length >= 15, `harus ada >=15 konkatenasi ARRAY[...], dapat ${wrapped.length}`);
});
