import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const NOTIF_1G_MIGRATION = readFileSync(new URL('../supabase/migrations/20261021090000_report_notification_seller.sql', import.meta.url), 'utf8');
const NOTIF_1H_MIGRATION = readFileSync(new URL('../supabase/migrations/20261021091000_reports_insert_relation_guard.sql', import.meta.url), 'utf8');
function stripSqlComments(sql: string): string {
    let out = '';
    let i = 0;
    let inString = false;
    while (i < sql.length) {
        const ch = sql[i];
        if (inString) {
            out += ch;
            if (ch === "'") {
                if (sql[i + 1] === "'") {
                    out += sql[i + 1];
                    i += 2;
                    continue;
                }
                inString = false;
            }
            i += 1;
            continue;
        }
        if (ch === "'") {
            inString = true;
            out += ch;
            i += 1;
            continue;
        }
        if (ch === '-' && sql[i + 1] === '-') {
            while (i < sql.length && sql[i] !== '\n')
                i += 1;
            continue;
        }
        if (ch === '/' && sql[i + 1] === '*') {
            i += 2;
            while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/'))
                i += 1;
            i += 2;
            continue;
        }
        out += ch;
        i += 1;
    }
    return out;
}
const NOTIF_1H_SQL = stripSqlComments(NOTIF_1H_MIGRATION);
const MIGRATIONS_DIR = new URL('../supabase/migrations/', import.meta.url);
const MIGRATION_FILES: ReadonlyArray<{
    name: string;
    sql: string;
}> = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(new URL(name, MIGRATIONS_DIR), 'utf8') }));
function splitSqlStatements(sql: string): string[] {
    const out: string[] = [];
    let cur = '';
    let i = 0;
    let inLineComment = false;
    let inBlockComment = false;
    let inString = false;
    let dollarTag: string | null = null;
    const flush = (): void => {
        const t = cur.trim();
        if (t)
            out.push(t);
        cur = '';
    };
    while (i < sql.length) {
        const ch = sql[i];
        const next = sql[i + 1];
        if (inLineComment) {
            if (ch === '\n') {
                inLineComment = false;
                cur += ch;
            }
            i += 1;
            continue;
        }
        if (inBlockComment) {
            if (ch === '*' && next === '/') {
                inBlockComment = false;
                i += 2;
                continue;
            }
            i += 1;
            continue;
        }
        if (inString) {
            cur += ch;
            if (ch === "'") {
                if (next === "'") {
                    cur += next;
                    i += 2;
                    continue;
                }
                inString = false;
            }
            i += 1;
            continue;
        }
        if (dollarTag) {
            if (sql.startsWith(dollarTag, i)) {
                cur += dollarTag;
                i += dollarTag.length;
                dollarTag = null;
                continue;
            }
            cur += ch;
            i += 1;
            continue;
        }
        if (ch === '-' && next === '-') {
            inLineComment = true;
            i += 2;
            continue;
        }
        if (ch === '/' && next === '*') {
            inBlockComment = true;
            i += 2;
            continue;
        }
        if (ch === "'") {
            inString = true;
            cur += ch;
            i += 1;
            continue;
        }
        if (ch === '$') {
            const m = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i));
            if (m) {
                dollarTag = m[0];
                cur += dollarTag;
                i += dollarTag.length;
                continue;
            }
        }
        if (ch === ';') {
            flush();
            i += 1;
            continue;
        }
        cur += ch;
        i += 1;
    }
    flush();
    return out;
}
function findPolicyDefinitions(policyname: string, table: string): Array<{
    file: string;
    statement: string;
}> {
    const out: Array<{
        file: string;
        statement: string;
    }> = [];
    const re = new RegExp(`^CREATE\\s+POLICY\\s+"${policyname}"\\s+ON\\s+public\\.${table}\\b`, 'i');
    for (const { name, sql } of MIGRATION_FILES) {
        for (const statement of splitSqlStatements(sql)) {
            if (re.test(statement))
                out.push({ file: name, statement });
        }
    }
    return out;
}
function effectivePolicyDefinition(policyname: string, table: string): {
    file: string;
    statement: string;
} | null {
    const defs = findPolicyDefinitions(policyname, table);
    return defs.length > 0 ? defs[defs.length - 1] : null;
}
const BUYER = '11111111-1111-4111-8111-111111111111';
const OTHER_BUYER = '22222222-2222-4222-8222-222222222222';
const OWNER_A = '33333333-3333-4333-8333-333333333333';
const OWNER_B = '44444444-4444-4444-8444-444444444444';
const OWNER_C = '55555555-5555-4555-8555-555555555555';
const OWNER_D = '88888888-8888-4888-8888-888888888888';
const ADMIN = '66666666-6666-4666-8666-666666666666';
const STRANGER = '77777777-7777-4777-8777-777777777777';
const STORE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STORE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const STORE_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const STORE_D = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const PRODUCT = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const FIXTURE_DDL = `
-- ---------------------------------------------------------------------------
-- auth (disimulasikan; Supabase menyediakan ini di sisi platform)
-- ---------------------------------------------------------------------------
CREATE SCHEMA auth;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text
);

-- Meniru implementasi Supabase: claim dibaca dari GUC request.jwt.claims.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb
$$;

-- ---------------------------------------------------------------------------
-- Peran (20260825090000_0008 + default Supabase: service_role bypass RLS)
-- ---------------------------------------------------------------------------
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;

-- ---------------------------------------------------------------------------
-- public.profiles (20260806050337_0001:1-14 + 20261001000000 account_status)
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  role text NOT NULL DEFAULT 'buyer' CHECK (role IN ('admin','umkm','buyer')),
  phone text,
  avatar_url text,
  is_verified boolean NOT NULL DEFAULT false,
  account_status text NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active','suspended','banned')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 20260928120000_admin_rls_foundation.sql:19-31
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- 20260928120000_admin_rls_foundation.sql:40-44
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_admin());

-- ---------------------------------------------------------------------------
-- public.activity_logs (20261001000000_admin_monitoring_foundation.sql:142-168)
-- ---------------------------------------------------------------------------
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
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
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- public.umkm_profiles (20260806050337_0001:66-82 + 0003 slug + 0011 NOT NULL)
-- ---------------------------------------------------------------------------
CREATE TABLE public.umkm_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  description text,
  category text,
  address text,
  city text,
  latitude double precision,
  longitude double precision,
  logo_url text,
  is_verified boolean NOT NULL DEFAULT false,
  rating numeric(2,1) NOT NULL DEFAULT 5.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- 20261030000000_umkm_admin_deactivate.sql:29 menambah kolom ini; policy
  -- umkm_select_public sesudahnya bergantung padanya.
  is_active boolean NOT NULL DEFAULT true,
  slug text NOT NULL
);
ALTER TABLE public.umkm_profiles ENABLE ROW LEVEL SECURITY;

-- 20260824120000_0003_align_frontend_schema.sql:30
-- NOTIF-1J-A: index UNIQUE pada slug sempat hilang dari fixture. Policy guard
-- jalur vendor_slug bergantung pada join u.slug = o.vendor_slug; di produksi slug
-- dijamin unik oleh index ini, jadi fixture harus memodelkannya.
CREATE UNIQUE INDEX IF NOT EXISTS umkm_slug_key ON public.umkm_profiles(slug);

-- 20260806050337_0001:84-88, lalu digantikan
-- 20261030000000_umkm_admin_deactivate.sql:44-47
CREATE POLICY "umkm_select_public"
ON public.umkm_profiles FOR SELECT
TO anon, authenticated USING (umkm_profiles.is_active);

-- ---------------------------------------------------------------------------
-- public.products (disederhanakan: hanya FK + RLS; di luar jalur NOTIF-1H)
-- ---------------------------------------------------------------------------
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  umkm_id uuid NOT NULL REFERENCES public.umkm_profiles(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price integer NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  sold_count integer NOT NULL DEFAULT 0,
  slug text,
  status text NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select_public"
ON public.products FOR SELECT
TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- public.orders (20260806050337_0001:204-224 + 0003 vendor_slug)
-- ---------------------------------------------------------------------------
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  umkm_id uuid NOT NULL REFERENCES public.umkm_profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  total_price integer NOT NULL DEFAULT 0,
  delivery_option text NOT NULL DEFAULT 'pickup' CHECK (delivery_option IN ('delivery','pickup')),
  delivery_address text,
  note text,
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','failed','refunded')),
  order_status text NOT NULL DEFAULT 'pending' CHECK (order_status IN ('pending','paid','preparing','ready','completed','cancelled','refunded')),
  midtrans_order_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  vendor_slug text
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX idx_orders_umkm ON public.orders(umkm_id);
CREATE INDEX idx_orders_product ON public.orders(product_id);
-- 20260824120000_0003_align_frontend_schema.sql:85
CREATE INDEX idx_orders_vendor_slug ON public.orders(vendor_slug);

-- 20260928120000_admin_rls_foundation.sql:127-138  (definisi EFEKTIF)
--
-- NOTIF-1J-A: bentuk ini yang berlaku di produksi, bukan bentuk lama dari
-- 20260806050337_0001:225-232. Bentuk lama memakai subquery mentah
--   OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
-- yang tunduk pada RLS profiles. Bentuk efektif memakai
--   OR public.is_admin()
-- yaitu helper SECURITY DEFINER yang melewati RLS profiles (pola anti
-- rekursi yang sama dipakai 0018 -> admin_rls_foundation).
--
-- Riwayat definisi (urutan file = urutan penerapan):
--   20260806050337_0001_rebites_schema.sql:225-232            (bentuk lama)
--   20260830000002_0018_fix_rls_admin_recursion.sql:153-163   (is_admin())
--   20260831000001_fix_profiles_recursion_no_admin.sql:63-69   (tanpa admin)
--   20260928120000_admin_rls_foundation.sql:128-138            (EFEKTIF)
DROP POLICY IF EXISTS "orders_select_participants" ON public.orders;
CREATE POLICY "orders_select_participants"
ON public.orders FOR SELECT
TO authenticated
USING (
  auth.uid() = buyer_id
  OR EXISTS (
    SELECT 1 FROM public.umkm_profiles u
    WHERE u.id = orders.umkm_id AND u.user_id = auth.uid()
  )
  OR public.is_admin()
);

-- ---------------------------------------------------------------------------
-- public.notifications (20260824120000_0003:6-25)
-- Constraint inline pada kolom "type" otomatis bernama notifications_type_check
-- (pola PostgreSQL <tabel>_<kolom>_check) — inilah yang dibaca DO-block NOTIF-1G.
-- ---------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('buyer','seller')),
  type text NOT NULL CHECK (type IN (
    'order_created','payment_success','order_delivering','order_completed',
    'promo','incoming_order','new_review','subscription_active','subscription_renewed',
    'subscription_expiring','subscription_changed','subscription_expired'
  )),
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  reference_id text,
  href text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 20260824120000_0003:173-177
CREATE POLICY "notifications_select_own"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 20261007000006_p1b_review_notification_security.sql:148-151
CREATE POLICY "notifications_insert_self"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- public.reports (20261001000000_admin_monitoring_foundation.sql:197-292)
-- ---------------------------------------------------------------------------
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  activity_id uuid REFERENCES public.activity_logs(id) ON DELETE SET NULL,
  category text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- 20261006000000_stage3a_monitoring_enhancements.sql:17-40
  -- (kedua kolom nullable; tidak mengubah perilaku INSERT)
  severity text CHECK (severity IS NULL OR severity IN ('low','medium','high','critical')),
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_reports_reported_user_id ON public.reports(reported_user_id);
CREATE INDEX idx_reports_reported_by ON public.reports(reported_by);
CREATE INDEX idx_reports_status ON public.reports(status);
CREATE INDEX idx_reports_activity_id ON public.reports(activity_id);

-- 20261001000000:227-235
CREATE POLICY "reports_select_involved_or_admin"
ON public.reports FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR auth.uid() = reported_by
  OR auth.uid() = reported_user_id
);

-- 20261001000000:238-242  (policy PERMISSIVE yang TIDAK boleh diubah NOTIF-1H)
CREATE POLICY "reports_insert_own_or_admin"
ON public.reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reported_by OR public.is_admin());

-- 20261001000000:247-252
CREATE POLICY "reports_update_admin"
ON public.reports FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 20261001000000:268-291
CREATE OR REPLACE FUNCTION public.enforce_report_insert_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_admin() THEN
    NEW.reported_by := auth.uid();
  END IF;
  NEW.status := 'open';
  NEW.resolved_by := NULL;
  NEW.resolved_at := NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reports_insert_defaults
BEFORE INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.enforce_report_insert_defaults();

-- ---------------------------------------------------------------------------
-- Grants
--
-- 20260825090000_0008:18-22 — berlaku untuk tabel yang ADA pada saat itu
-- (profiles, umkm_profiles, products, orders, notifications, ...).
-- Role authenticated SELALU punya SELECT pada orders + umkm_profiles, dan itu
-- prasyarat policy guard: policy dievaluasi dengan hak pemanggil, jadi tanpa
-- grant SELECT tersebut subquery pesanan akan gagal dengan permission denied.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- 20261001000000_admin_monitoring_foundation.sql:222-223 — tabel reports
-- dibuat SETELAH 0008, jadi diberi grant eksplisit. Role anon sengaja TIDAK
-- diberi INSERT di sini.
--
-- NOTIF-1J-A — CATATAN DIVERGENSI yang diketahui:
--   Di produksi, role anon tidak memiliki grant tabel apa pun pada reports
--   (tabel ini belum ada saat 0008:20 berjalan, dan 20261001000000:222
--   tidak menyebut anon). Di fixture, anon tetap mendapat SELECT karena
--   seluruh tabel dibuat sebelum blok grant. Selisih ini TIDAK observable:
--   tabel reports tidak punya policy SELECT maupun INSERT untuk anon, jadi
--   RLS default-deny menolak anon apa pun hasilnya. Bukti: tes
--   "peran anon tidak dapat MEMBACA reports" di bawah.
--   (Status privilege anon pada reports di produksi juga bergantung pada
--   ALTER DEFAULT PRIVILEGES di 0008:26-27, yang tidak dapat diverifikasi
--   tanpa database nyata — karena itu yang diuji adalah HASIL default-deny.)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated, service_role;
`;
const SEED_SQL = `
INSERT INTO auth.users (id, email) VALUES
  ('${BUYER}',        'buyer@tok.test'),
  ('${OTHER_BUYER}',  'other-buyer@tok.test'),
  ('${OWNER_A}',      'owner-a@tok.test'),
  ('${OWNER_B}',      'owner-b@tok.test'),
  ('${STRANGER}',     'stranger@tok.test'),
  ('${ADMIN}',        'admin@tok.test'),
  ('${OWNER_C}',      'owner-c@tok.test'),
  ('${OWNER_D}',      'owner-d@tok.test');

INSERT INTO public.profiles (id, email, full_name, role) VALUES
  ('${BUYER}',        'buyer@tok.test',    'Buyer',        'buyer'),
  ('${OTHER_BUYER}',  'other@tok.test',    'Other Buyer',  'buyer'),
  ('${OWNER_A}',      'owner-a@tok.test',  'Owner A',      'umkm'),
  ('${OWNER_B}',      'owner-b@tok.test',  'Owner B',      'umkm'),
  ('${OWNER_C}',      'owner-c@tok.test',  'Owner C',      'umkm'),
  ('${OWNER_D}',      'owner-d@tok.test',  'Owner D',      'umkm'),
  ('${STRANGER}',     'stranger@tok.test', 'Stranger',     'buyer'),
  ('${ADMIN}',        'admin@tok.test',    'Admin',        'admin');

INSERT INTO public.umkm_profiles (id, user_id, business_name, slug) VALUES
  ('${STORE_A}', '${OWNER_A}', 'Toko A', 'toko-a'),
  ('${STORE_B}', '${OWNER_B}', 'Toko B', 'toko-b'),
  ('${STORE_C}', '${OWNER_C}', 'Toko C', 'toko-c'),
  ('${STORE_D}', '${OWNER_D}', 'Toko D', 'toko-d');

INSERT INTO public.products (id, umkm_id, seller_id, name, slug) VALUES
  ('${PRODUCT}', '${STORE_A}', '${OWNER_A}', 'Makanan A', 'makanan-a');

-- BUYER punya pesanan di toko-a (umkm_id DAN vendor_slug konsisten).
INSERT INTO public.orders (buyer_id, umkm_id, product_id, vendor_slug, order_status)
VALUES ('${BUYER}', '${STORE_A}', '${PRODUCT}', 'toko-a', 'completed');

-- Hanya OTHER_BUYER yang punya pesanan di toko-b.
INSERT INTO public.orders (buyer_id, umkm_id, product_id, vendor_slug, order_status)
VALUES ('${OTHER_BUYER}', '${STORE_B}', '${PRODUCT}', 'toko-b', 'completed');

-- BUYER punya pesanan yang vendor_slug-nya menunjuk toko-c, sementara
-- umkm_id-nya menunjuk toko-d. Sengaja dibuat tidak konsisten agar jalur A
-- (umkm_id) dan jalur B (vendor_slug) benar-benar terpisah: hanya jalur B
-- yang boleh mengizinkan laporan ke pemilik toko-c, dan tidak boleh ada jalur
-- apa pun ke pemilik toko-b.
INSERT INTO public.orders (buyer_id, umkm_id, product_id, vendor_slug, order_status)
VALUES ('${BUYER}', '${STORE_D}', '${PRODUCT}', 'toko-c', 'completed');
`;
const db = new PGlite();
async function query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<{
    rows: T[];
}> {
    const res = await db.query(sql, params as never[]);
    return { rows: res.rows as T[] };
}
async function asRole(role: string, claims: Record<string, unknown> | null, fn: () => Promise<unknown>): Promise<unknown> {
    await db.exec(`SET ROLE ${role}`);
    await query(`SELECT set_config('request.jwt.claims', $1, false)`, [
        claims ? JSON.stringify(claims) : '',
    ]);
    try {
        return await fn();
    }
    finally {
        await db.exec(`RESET ROLE`);
        await query(`SELECT set_config('request.jwt.claims', '', false)`);
    }
}
function asUser(userId: string, fn: () => Promise<unknown>): Promise<unknown> {
    return asRole('authenticated', { sub: userId, role: 'authenticated' }, fn);
}
function errText(err: unknown): string {
    const e = err as {
        message?: string;
        cause?: {
            message?: string;
        };
    };
    return String(e?.message ?? e?.cause?.message ?? err);
}
function isRlsViolation(err: unknown): boolean {
    return /row-level security/i.test(errText(err));
}
async function countReports(reportedUserId: string): Promise<number> {
    const res = await query(`SELECT count(*)::int AS n FROM public.reports WHERE reported_user_id = $1`, [reportedUserId]);
    return res.rows[0].n as number;
}
async function insertReport(reportedUserId: string, category = 'spam', description = 'Deskripsi laporan yang cukup panjang untuk lolos validasi.'): Promise<unknown> {
    return db.exec(`INSERT INTO public.reports (reported_user_id, reported_by, category, description)
     VALUES ('${reportedUserId}', '${BUYER}', '${category}', '${description}')`);
}
async function asUserRows<T extends Record<string, unknown>>(userId: string, sql: string, params: unknown[] = []): Promise<T[]> {
    const res = (await asUser(userId, () => query<T>(sql, params))) as {
        rows: T[];
    };
    return res.rows;
}
type PolicyCatalogRow = {
    policyname: string;
    permissive: string;
    cmd: string;
    roles: string[];
    qual: string | null;
    with_check: string | null;
};
async function readPolicy(policyname: string, table: string): Promise<PolicyCatalogRow | null> {
    const res = await query<PolicyCatalogRow>(`SELECT policyname, permissive, cmd, roles, qual, with_check
       FROM pg_policies
      WHERE schemaname = 'public' AND tablename = $1 AND policyname = $2`, [table, policyname]);
    return res.rows[0] ?? null;
}
async function installPolicyStatement(policyname: string, table: string, statement: string): Promise<void> {
    await db.exec(`DROP POLICY IF EXISTS "${policyname}" ON public.${table}`);
    await db.exec(`${statement};`);
}
const POLICY_SOURCES: ReadonlyArray<{
    label: string;
    sql: string;
}> = [
    { label: 'FIXTURE_DDL', sql: FIXTURE_DDL },
    { label: 'NOTIF-1G', sql: NOTIF_1G_MIGRATION },
    { label: 'NOTIF-1H', sql: NOTIF_1H_MIGRATION },
];
function policyStatementIn(sql: string, policyname: string, table: string): string | null {
    const re = new RegExp(`^CREATE\\s+POLICY\\s+"${policyname}"\\s+ON\\s+public\\.${table}\\b`, 'i');
    for (const statement of splitSqlStatements(sql)) {
        if (re.test(statement))
            return statement;
    }
    return null;
}
function policyOrigin(policyname: string, table: string): {
    label: string;
    statement: string;
} | null {
    for (const { label, sql } of POLICY_SOURCES) {
        const statement = policyStatementIn(sql, policyname, table);
        if (statement)
            return { label, statement };
    }
    return null;
}
let ready = false;
async function setup(): Promise<void> {
    if (ready)
        return;
    ready = true;
    await db.exec(FIXTURE_DDL);
    await db.exec(SEED_SQL);
    await db.exec(NOTIF_1G_MIGRATION);
    await db.exec(NOTIF_1H_MIGRATION);
}
test.before(async () => {
    await setup();
});
test.after(async () => {
    await db.close();
});
test('NOTIF-1H: laporan sah (ada pesanan di toko yang dilaporkan) DITERIMA', async () => {
    await asUser(BUYER, () => insertReport(OWNER_A));
    assert.equal(await countReports(OWNER_A), 1);
    const res = await query(`SELECT reported_by, reported_user_id, status FROM public.reports WHERE reported_user_id = $1`, [OWNER_A]);
    assert.equal(res.rows[0].reported_by, BUYER, 'reported_by harus pelapor');
    assert.equal(res.rows[0].status, 'open');
});
test('NOTIF-1H: laporan ke pengguna SENGAJA tanpa relasi pesanan DITOLAK', async () => {
    await assert.rejects(() => asUser(BUYER, () => insertReport(OWNER_B)), (err) => {
        assert.ok(isRlsViolation(err), `harus pelanggaran RLS, dapat: ${errText(err)}`);
        return true;
    });
    assert.equal(await countReports(OWNER_B), 0, 'tidak boleh ada baris tersimpan');
});
test('NOTIF-1H: laporan ke pengguna tanpa toko sama sekali DITOLAK', async () => {
    await assert.rejects(() => asUser(BUYER, () => insertReport(STRANGER)), (err) => {
        assert.ok(isRlsViolation(err), `harus pelanggaran RLS, dapat: ${errText(err)}`);
        return true;
    });
    assert.equal(await countReports(STRANGER), 0);
});
test('NOTIF-1H: laporan atas diri sendiri DITOLAK', async () => {
    await assert.rejects(() => asUser(BUYER, () => insertReport(BUYER)), (err) => {
        assert.ok(isRlsViolation(err), `harus pelanggaran RLS, dapat: ${errText(err)}`);
        return true;
    });
    assert.equal(await countReports(BUYER), 0);
});
test('NOTIF-1H: pesanan orang lain tidak memberi hak lapor', async () => {
    await assert.rejects(() => asUser(OTHER_BUYER, () => insertReport(OWNER_A)), (err) => {
        assert.ok(isRlsViolation(err), `harus pelanggaran RLS, dapat: ${errText(err)}`);
        return true;
    });
    assert.equal(await countReports(OWNER_A), 1, 'hanya 1 laporan sah yang boleh ada');
});
test('NOTIF-1H: jalur vendor_slug tetap DITERIMA (paritas dengan route API)', async () => {
    await asUser(BUYER, () => insertReport(OWNER_C));
    assert.equal(await countReports(OWNER_C), 1);
});
test('NOTIF-1H: admin tetap dapat membuat laporan ke user sembarang', async () => {
    await asUser(ADMIN, () => insertReport(STRANGER));
    assert.equal(await countReports(STRANGER), 1);
});
test('NOTIF-1H: reported_by dipaksa jadi pelapor (spoofing dinetralkan)', async () => {
    await asUser(BUYER, () => db.exec(`INSERT INTO public.reports (reported_user_id, reported_by, category, description)
       VALUES ('${OWNER_A}', '${OTHER_BUYER}', 'fraud', 'Mencoba memalsukan identitas pelapor.')`));
    const res = await query(`SELECT reported_by FROM public.reports WHERE reported_user_id = $1 ORDER BY created_at DESC LIMIT 1`, [OWNER_A]);
    assert.equal(res.rows[0].reported_by, BUYER, 'trigger enforce_report_insert_defaults harus memaksa reported_by = auth.uid()');
});
test('NOTIF-1H: reported_user_id NULL DITOLAK', async () => {
    await assert.rejects(() => asUser(BUYER, () => db.exec(`INSERT INTO public.reports (reported_user_id, reported_by, category, description)
           VALUES (NULL, '${BUYER}', 'spam', 'Laporan tanpa target yang sah.')`)), (err) => {
        assert.ok(isRlsViolation(err), `harus pelanggaran RLS, dapat: ${errText(err)}`);
        return true;
    });
});
test('NOTIF-1H: peran anon tidak dapat membuat laporan', async () => {
    await assert.rejects(() => asRole('anon', null, () => insertReport(OWNER_A)), (err) => {
        assert.ok(/row-level security|permission denied/i.test(errText(err)), `harus ditolak, dapat: ${errText(err)}`);
        return true;
    });
});
test('NOTIF-1H: peran anon tidak dapat MEMBACA reports (default deny)', async () => {
    const rows = (await asRole('anon', null, () => query<{
        n: number;
    }>(`SELECT count(*)::int AS n FROM public.reports`))) as {
        rows: Array<{
            n: number;
        }>;
    };
    assert.equal(rows.rows[0].n, 0, 'anon tidak punya policy SELECT pada reports -> default deny, harus 0 baris');
});
test('NOTIF-1H: service_role (BYPASSRLS) tetap dapat INSERT tanpa relasi pesanan', async () => {
    await asRole('service_role', { role: 'service_role' }, () => insertReport(OWNER_D));
    const rows = await asUserRows<{
        reported_by: string | null;
    }>(ADMIN, `SELECT reported_by FROM public.reports WHERE reported_user_id = $1
      ORDER BY created_at DESC LIMIT 1`, [OWNER_D]);
    assert.ok(rows.length >= 1, 'service_role harus bisa menyimpan laporan');
    assert.equal(rows[0].reported_by, BUYER, 'trigger enforce_report_insert_defaults harus meloloskan service_role tanpa menimpa reported_by');
});
test('NOTIF-1H: policy SELECT orders EFEKTIF — pelapor hanya melihat pesanannya sendiri', async () => {
    const buyerRows = await asUserRows<{
        n: number;
    }>(BUYER, `SELECT count(*)::int AS n FROM public.orders`);
    assert.equal(buyerRows[0].n, 2, 'BUYER hanya boleh melihat 2 pesanannya sendiri');
    const otherRows = await asUserRows<{
        n: number;
    }>(OTHER_BUYER, `SELECT count(*)::int AS n FROM public.orders`);
    assert.equal(otherRows[0].n, 1, 'OTHER_BUYER hanya boleh melihat 1 pesanannya sendiri');
    const adminRows = await asUserRows<{
        n: number;
    }>(ADMIN, `SELECT count(*)::int AS n FROM public.orders`);
    assert.equal(adminRows[0].n, 3, 'admin melihat semua pesanan lewat public.is_admin()');
});
test('NOTIF-1H: TANPA policy guard eksploitasi BERHASIL (kontrol sensitivitas)', async () => {
    await db.exec(`DROP POLICY IF EXISTS "reports_insert_requires_order_relation" ON public.reports`);
    await asUser(BUYER, () => insertReport(OWNER_B));
    assert.equal(await countReports(OWNER_B), 1, 'tanpa guard, INSERT ke /rest/v1/reports harus berhasil (celah terbukti ada)');
});
test('NOTIF-1H: dengan policy guard eksploitasi GAGAL (guard efektif)', async () => {
    await db.exec(NOTIF_1H_MIGRATION);
    await assert.rejects(() => asUser(BUYER, () => insertReport(OWNER_B)), (err) => {
        assert.ok(isRlsViolation(err), `harus pelanggaran RLS, dapat: ${errText(err)}`);
        return true;
    });
    assert.equal(await countReports(OWNER_B), 1, 'tidak boleh ada baris tambahan');
});
test('NOTIF-1H: notifikasi NOTIF-1G tetap terkirim untuk laporan yang sah', async () => {
    const res = await query(`SELECT user_id, type FROM public.notifications
      WHERE type = 'report_received' AND reference_id IN (
        SELECT id::text FROM public.reports WHERE reported_user_id = $1
      )`, [OWNER_A]);
    assert.ok(res.rows.length >= 1, 'notifikasi report_received harus tetap terbit');
    assert.equal(res.rows[0].user_id, OWNER_A);
});
test('NOTIF-1H: laporan yang DITOLAK tidak menambah notifikasi', async () => {
    const res = await query(`SELECT
       (SELECT count(*)::int FROM public.reports WHERE reported_user_id = $1) AS reports,
       (SELECT count(*)::int FROM public.notifications
         WHERE type = 'report_received' AND user_id = $1) AS notifs`, [OWNER_B]);
    assert.equal(res.rows[0].reports, 1, 'hanya satu laporan OWNER_B yang benar-benar tersimpan');
    assert.equal(res.rows[0].notifs, res.rows[0].reports, 'notifikasi harus persis autant dengan laporan tersimpan (percobaan yang ditolak tidak menambah apa pun)');
});
test('NOTIF-1H: constraint notifications_type_check memuat report_received', async () => {
    const res = await query<{
        def: string;
    }>(`SELECT pg_get_constraintdef(c.oid) AS def
       FROM pg_constraint c
      WHERE c.conrelid = 'public.notifications'::regclass
        AND c.conname = 'notifications_type_check'`);
    assert.match(res.rows[0].def, /report_received/);
});
function permValue(raw: unknown): 'P' | 'R' {
    const v = String(raw).trim().toUpperCase();
    if (v === 'R' || v === 'RESTRICTIVE')
        return 'R';
    if (v === 'P' || v === 'PERMISSIVE')
        return 'P';
    throw new Error(`nilai pg_policies.permissive tidak dikenal: ${raw}`);
}
test('NOTIF-1H: policy baru RESTRICTIVE, policy lama tetap PERMISSIVE', async () => {
    const res = await query(`SELECT policyname, permissive FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'reports'`);
    const map = new Map(res.rows.map((r) => [r.policyname, permValue(r.permissive)]));
    assert.equal(map.get('reports_insert_requires_order_relation'), 'R', 'policy baru harus RESTRICTIVE agar di-AND dengan policy permissive');
    assert.equal(map.get('reports_insert_own_or_admin'), 'P', 'policy lama harus tetap PERMISSIVE (tidak diubah/dihapus)');
    assert.equal(map.get('reports_select_involved_or_admin'), 'P');
    assert.equal(map.get('reports_update_admin'), 'P');
});
test('NOTIF-1H: himpunan policy pada reports PERSIS 4 (tidak ada policy tak terduga)', async () => {
    const res = await query<{
        policyname: string;
        cmd: string;
        permissive: string;
        roles: string[];
    }>(`SELECT policyname, cmd, permissive, roles FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'reports'
      ORDER BY policyname`);
    assert.deepEqual(res.rows.map((r) => r.policyname), [
        'reports_insert_own_or_admin',
        'reports_insert_requires_order_relation',
        'reports_select_involved_or_admin',
        'reports_update_admin',
    ], `himpunan policy reports harus persis 4, ditemukan: ${res.rows
        .map((r) => r.policyname)
        .join(', ')}`);
    const byName = new Map(res.rows.map((r) => [r.policyname, r]));
    assert.equal(byName.get('reports_insert_own_or_admin')?.cmd, 'INSERT');
    assert.equal(byName.get('reports_insert_requires_order_relation')?.cmd, 'INSERT');
    assert.equal(byName.get('reports_select_involved_or_admin')?.cmd, 'SELECT');
    assert.equal(byName.get('reports_update_admin')?.cmd, 'UPDATE');
    for (const name of res.rows.map((r) => r.policyname)) {
        assert.deepEqual(byName.get(name)?.roles, ['authenticated'], `policy ${name} harus hanya berlaku untuk role authenticated`);
    }
});
test('NOTIF-1H: policy INSERT lama tidak berubah (with_check utuh)', async () => {
    const res = await query<{
        with_check: string;
    }>(`SELECT with_check FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'reports'
        AND policyname = 'reports_insert_own_or_admin'`);
    assert.ok(res.rows.length === 1, 'policy lama harus masih ada');
    assert.match(res.rows[0].with_check, /auth\.uid\(\)\s*=\s*reported_by/);
    assert.match(res.rows[0].with_check, /is_admin\(\)/);
});
test('NOTIF-1H: RLS reports tetap AKTIF dan policy DELETE tetap tidak ada', async () => {
    const res = await query(`SELECT c.relrowsecurity, c.relforcerowsecurity
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'reports'`);
    assert.equal(res.rows[0].relrowsecurity, true, 'RLS harus tetap aktif');
    const del = await query(`SELECT count(*)::int AS n FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'reports' AND cmd = 'DELETE'`);
    assert.equal(del.rows[0].n, 0, 'tidak boleh ada policy DELETE pada reports');
});
test('NOTIF-1H: migrasi idempoten (dapat dijalankan dua kali)', async () => {
    await db.exec(NOTIF_1H_MIGRATION);
    const res = await query(`SELECT count(*)::int AS n FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'reports'
        AND policyname = 'reports_insert_requires_order_relation'`);
    assert.equal(res.rows[0].n, 1, 'policy harus tetap tunggal setelah dijalankan ulang');
});
test('NOTIF-1H: file migrasi hanya menambah policy RESTRICTIVE', () => {
    assert.match(NOTIF_1H_MIGRATION, /CREATE POLICY "reports_insert_requires_order_relation"/);
    assert.match(NOTIF_1H_MIGRATION, /AS RESTRICTIVE/);
    assert.match(NOTIF_1H_MIGRATION, /FOR INSERT/);
    assert.match(NOTIF_1H_MIGRATION, /TO authenticated/);
    assert.doesNotMatch(NOTIF_1H_MIGRATION, /DROP POLICY IF EXISTS "reports_insert_own_or_admin"/);
    assert.doesNotMatch(NOTIF_1H_MIGRATION, /DROP POLICY[^;]*reports_select_involved_or_admin/);
});
test('NOTIF-1H: migrasi tidak melemahkan RLS atau menambah hak akses', () => {
    assert.doesNotMatch(NOTIF_1H_SQL, /GRANT\b/i);
    assert.doesNotMatch(NOTIF_1H_SQL, /REVOKE\b/i);
    assert.doesNotMatch(NOTIF_1H_SQL, /DISABLE ROW LEVEL SECURITY/i);
    assert.doesNotMatch(NOTIF_1H_SQL, /ENABLE ROW LEVEL SECURITY/i);
    assert.doesNotMatch(NOTIF_1H_SQL, /BYPASSRLS/i);
    assert.doesNotMatch(NOTIF_1H_SQL, /ALTER\s+TABLE/i);
    assert.doesNotMatch(NOTIF_1H_SQL, /CREATE\s+ROLE|DROP\s+ROLE|ALTER\s+ROLE/i);
});
test('NOTIF-1H: satu-satunya objek yang dibuat adalah policy INSERT di reports', () => {
    const targets = [
        ...NOTIF_1H_SQL.matchAll(/(?:CREATE|DROP)\s+(?:POLICY|TRIGGER)\b[^;]*?\bON\s+([a-z_.]+)/gi),
    ].map((m) => m[1].toLowerCase());
    assert.deepEqual([...new Set(targets)], ['public.reports'], `hanya public.reports boleh tersentuh, ditemukan: ${targets.join(', ')}`);
    const dml = [
        ...NOTIF_1H_SQL.matchAll(/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+([a-z_.]+)/gi),
    ].map((m) => m[1].toLowerCase());
    assert.deepEqual(dml, [], `tidak boleh ada DML, ditemukan: ${dml.join(', ')}`);
});
test('NOTIF-1H: migrasi tidak mengubah file NOTIF-1G (tahap sebelumnya)', () => {
    assert.match(NOTIF_1G_MIGRATION, /CREATE OR REPLACE FUNCTION public\.notify_on_report_created\(\)/);
    assert.match(NOTIF_1G_MIGRATION, /CREATE TRIGGER trg_reports_notify_store\s+AFTER INSERT ON public\.reports/);
    assert.doesNotMatch(NOTIF_1H_SQL, /notify_on_report_created/);
    assert.doesNotMatch(NOTIF_1H_SQL, /notifications_type_check/);
    assert.doesNotMatch(NOTIF_1H_SQL, /enforce_report_insert_defaults/);
    assert.doesNotMatch(NOTIF_1H_SQL, /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION/i);
    assert.doesNotMatch(NOTIF_1H_SQL, /CREATE\s+TRIGGER/i);
});
test('NOTIF-1H: migrasi punya komentar policy yang menjelaskan aturan', () => {
    assert.match(NOTIF_1H_MIGRATION, /COMMENT ON POLICY "reports_insert_requires_order_relation"/);
});
const M0001 = readFileSync(new URL('../supabase/migrations/20260806050337_0001_rebites_schema.sql', import.meta.url), 'utf8');
const M0003 = readFileSync(new URL('../supabase/migrations/20260824120000_0003_align_frontend_schema.sql', import.meta.url), 'utf8');
const M0008 = readFileSync(new URL('../supabase/migrations/20260825090000_0008_restore_grants_and_fix_reserve_stock.sql', import.meta.url), 'utf8');
const M_ADMIN = readFileSync(new URL('../supabase/migrations/20260928120000_admin_rls_foundation.sql', import.meta.url), 'utf8');
const M_MONITOR = readFileSync(new URL('../supabase/migrations/20261001000000_admin_monitoring_foundation.sql', import.meta.url), 'utf8');
const M_STAGE3A = readFileSync(new URL('../supabase/migrations/20261006000000_stage3a_monitoring_enhancements.sql', import.meta.url), 'utf8');
test('NOTIF-1H: paritas fixture — definisi EFEKTIF tiap policy diambil dari file migrasi yang benar', () => {
    assert.deepEqual(findPolicyDefinitions('orders_select_participants', 'orders').map((d) => d.file), [
        '20260806050337_0001_rebites_schema.sql',
        '20260830000002_0018_fix_rls_admin_recursion.sql',
        '20260831000001_fix_profiles_recursion_no_admin.sql',
        '20260928120000_admin_rls_foundation.sql',
    ], 'daftar file yang mendefinisikan orders_select_participants harus tepat; yang TERAKHIR yang berlaku');
    assert.equal(effectivePolicyDefinition('orders_select_participants', 'orders')?.file, '20260928120000_admin_rls_foundation.sql', 'definisi EFFECTIF orders_select_participants ada di admin_rls_foundation');
    assert.deepEqual(findPolicyDefinitions('umkm_select_public', 'umkm_profiles').map((d) => d.file), [
        '20260806050337_0001_rebites_schema.sql',
        '20261030000000_umkm_admin_deactivate.sql',
    ], 'umkm_select_public harus didefinisikan 0001 lalu digantikan migrasi penonaktifan toko');
    assert.equal(effectivePolicyDefinition('umkm_select_public', 'umkm_profiles')?.file, '20261030000000_umkm_admin_deactivate.sql', 'definisi EFFECTIF umkm_select_public ada di migrasi penonaktifan toko');
    assert.equal(effectivePolicyDefinition('profiles_select_own_or_admin', 'profiles')?.file, '20260928120000_admin_rls_foundation.sql', 'definisi EFFECTIF profiles_select_own_or_admin ada di admin_rls_foundation');
    for (const name of [
        'reports_select_involved_or_admin',
        'reports_insert_own_or_admin',
        'reports_update_admin',
    ]) {
        assert.deepEqual(findPolicyDefinitions(name, 'reports').map((d) => d.file), ['20261001000000_admin_monitoring_foundation.sql'], `policy ${name} harus berasal dari admin_monitoring_foundation`);
    }
    assert.deepEqual(findPolicyDefinitions('reports_insert_requires_order_relation', 'reports').map((d) => d.file), ['20261021091000_reports_insert_relation_guard.sql'], 'policy guard hanya boleh berasal dari file migrasi NOTIF-1H');
});
test('NOTIF-1H: paritas fixture — policy fixture IDENTIK dengan definisi efektif migrasi sumber', async () => {
    const modeled: Array<{
        policyname: string;
        table: string;
    }> = [
        { policyname: 'profiles_select_own_or_admin', table: 'profiles' },
        { policyname: 'umkm_select_public', table: 'umkm_profiles' },
        { policyname: 'orders_select_participants', table: 'orders' },
        { policyname: 'reports_select_involved_or_admin', table: 'reports' },
        { policyname: 'reports_insert_own_or_admin', table: 'reports' },
        { policyname: 'reports_update_admin', table: 'reports' },
        { policyname: 'reports_insert_requires_order_relation', table: 'reports' },
    ];
    const restoreFixture = async (): Promise<void> => {
        for (const { policyname, table } of modeled) {
            const origin = policyOrigin(policyname, table);
            if (origin)
                await installPolicyStatement(policyname, table, origin.statement);
        }
    };
    const before = new Map<string, PolicyCatalogRow | null>();
    for (const { policyname, table } of modeled) {
        before.set(policyname, await readPolicy(policyname, table));
    }
    try {
        for (const { policyname, table } of modeled) {
            const effective = effectivePolicyDefinition(policyname, table);
            assert.ok(effective, `harus ada definisi CREATE POLICY "${policyname}" ON public.${table} di migrasi sumber`);
            const origin = policyOrigin(policyname, table);
            assert.ok(origin, `policy "${policyname}" harus dipasang oleh FIXTURE_DDL, NOTIF-1G, atau NOTIF-1H`);
            await installPolicyStatement(policyname, table, origin.statement);
            const fromOrigin = await readPolicy(policyname, table);
            assert.ok(fromOrigin, `policy "${policyname}" harus ada setelah dipasang ulang`);
            await installPolicyStatement(policyname, table, effective.statement);
            const fromSource = await readPolicy(policyname, table);
            const fromFixture = before.get(policyname) ?? null;
            assert.ok(fromSource && fromFixture, `policy "${policyname}" harus ada sebelum & sesudah`);
            assert.equal(fromSource.qual, fromFixture.qual, `qual policy "${policyname}" (sumber: ${origin.label}) harus identik dengan definisi efektif di ${effective.file}`);
            assert.equal(fromSource.with_check, fromFixture.with_check, `with_check policy "${policyname}" (sumber: ${origin.label}) harus identik dengan definisi efektif di ${effective.file}`);
            assert.equal(fromSource.permissive, fromFixture.permissive, `permissive "${policyname}"`);
            assert.equal(fromSource.cmd, fromFixture.cmd, `cmd "${policyname}"`);
            assert.deepEqual(fromSource.roles, fromFixture.roles, `roles "${policyname}"`);
        }
    }
    finally {
        await restoreFixture();
    }
    for (const { policyname, table } of modeled) {
        const restored = await readPolicy(policyname, table);
        const original = before.get(policyname) ?? null;
        assert.ok(restored && original, `policy "${policyname}" harus ada setelah dipulihkan`);
        assert.equal(restored.qual, original.qual, `qual "${policyname}" setelah pemulihan`);
        assert.equal(restored.with_check, original.with_check, `with_check "${policyname}" setelah pemulihan`);
    }
});
test('NOTIF-1H: paritas fixture — prasyarat constraint & grant policy terpenuhi', async () => {
    const M0011 = readFileSync(new URL('../supabase/migrations/20260826090000_0011_backfill_umkm_slug.sql', import.meta.url), 'utf8');
    const M0016 = readFileSync(new URL('../supabase/migrations/20260830000000_0016_umkm_user_unique.sql', import.meta.url), 'utf8');
    assert.match(M0001, /umkm_id uuid NOT NULL REFERENCES public\.umkm_profiles\(id\) ON DELETE CASCADE/);
    assert.match(M0003, /ADD COLUMN IF NOT EXISTS vendor_slug text/);
    assert.match(M0003, /CREATE INDEX IF NOT EXISTS idx_orders_vendor_slug ON public\.orders\(vendor_slug\)/);
    assert.match(M0001, /user_id uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
    assert.match(M0016, /ADD CONSTRAINT umkm_profiles_user_id_key UNIQUE \(user_id\)/);
    assert.match(M0011, /ALTER COLUMN slug SET NOT NULL/);
    assert.match(M0003, /CREATE UNIQUE INDEX IF NOT EXISTS umkm_slug_key ON public\.umkm_profiles\(slug\)/);
    assert.match(M_MONITOR, /ADD CONSTRAINT profiles_account_status_check/);
    assert.match(M0008, /GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated/);
    assert.match(M_MONITOR, /GRANT SELECT, INSERT, UPDATE, DELETE\s+ON public\.reports TO authenticated, service_role;/);
    assert.match(M_ADMIN, /GRANT EXECUTE ON FUNCTION public\.is_admin\(\)\s+TO anon, authenticated, service_role;/);
    assert.match(M_ADMIN, /SECURITY DEFINER/);
    assert.match(M_MONITOR, /NEW\.reported_by := auth\.uid\(\)/);
    assert.match(M_STAGE3A, /ADD COLUMN IF NOT EXISTS severity text/);
    assert.match(M_STAGE3A, /ADD COLUMN IF NOT EXISTS assigned_to uuid/);
    const priv = await query<{
        grantee: string;
        tbl: string;
        priv: string;
        ok: boolean;
    }>(`SELECT r.rolname AS grantee, p.tbl AS tbl, p.priv AS priv,
            has_table_privilege(r.rolname, p.tbl, p.priv) AS ok
       FROM (VALUES
               ('authenticated', 'public.orders',        'SELECT'),
               ('authenticated', 'public.umkm_profiles', 'SELECT'),
               ('authenticated', 'public.reports',       'INSERT'),
               ('authenticated', 'public.profiles',      'SELECT')
            ) AS p(grantee, tbl, priv)
       JOIN pg_roles r ON r.rolname = p.grantee`);
    assert.equal(priv.rows.length, 4, 'semua privilege prasyarat harus bisa diuji');
    for (const row of priv.rows) {
        assert.equal(row.ok, true, `role ${row.grantee} harus punya ${row.priv} pada ${row.tbl}`);
    }
    const fnPriv = await query<{
        ok: boolean;
    }>(`SELECT has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE') AS ok`);
    assert.equal(fnPriv.rows[0].ok, true, 'authenticated harus bisa mengeksekusi public.is_admin()');
    const notNull = await query<{
        column_name: string;
        is_nullable: string;
    }>(`SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'umkm_id'`);
    assert.equal(notNull.rows[0]?.is_nullable, 'NO', 'orders.umkm_id harus NOT NULL');
    const uniq = await query<{
        conname: string;
    }>(`SELECT conname FROM pg_constraint
      WHERE conrelid = 'public.umkm_profiles'::regclass AND contype = 'u'`);
    assert.ok(uniq.rows.some((r) => r.conname === 'umkm_profiles_user_id_key'), 'umkm_profiles harus punya UNIQUE pada user_id');
    const slugIdx = await query<{
        indexdef: string;
    }>(`SELECT indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'umkm_profiles' AND indexdef LIKE '%UNIQUE%'`);
    assert.ok(slugIdx.rows.some((r) => /\(slug\)/.test(r.indexdef)), 'umkm_profiles harus punya index UNIQUE pada slug');
});
test('NOTIF-1H: paritas fixture — policy baru menulis ke kolom yang memang ada', async () => {
    const cols = await query(`SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reports'`);
    const names = cols.rows.map((r) => r.column_name);
    for (const required of ['reported_user_id', 'reported_by', 'category', 'description', 'status']) {
        assert.ok(names.includes(required), `kolom ${required} harus ada di reports`);
    }
    const orderCols = await query(`SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders'`);
    const orderNames = orderCols.rows.map((r) => r.column_name);
    for (const required of ['buyer_id', 'umkm_id', 'vendor_slug']) {
        assert.ok(orderNames.includes(required), `kolom ${required} harus ada di orders`);
    }
    assert.match(M_MONITOR, /reported_user_id uuid REFERENCES public\.profiles\(id\) ON DELETE SET NULL/);
    assert.match(M_MONITOR, /reported_by uuid REFERENCES public\.profiles\(id\) ON DELETE SET NULL/);
    assert.match(M_MONITOR, /category text NOT NULL/);
    assert.match(M_MONITOR, /description text NOT NULL/);
    assert.match(M0001, /buyer_id uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
    assert.match(M0001, /umkm_id uuid NOT NULL REFERENCES public\.umkm_profiles\(id\) ON DELETE CASCADE/);
    assert.match(M0003, /ADD COLUMN IF NOT EXISTS vendor_slug text/);
});
