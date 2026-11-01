-- ============================================================================
-- TES INTEGRASI pgTAP — TC-04: transisi terminal webhook/verify × pelepasan
-- stok oleh trigger guard_orders_update (P0-B), dengan klasifikasi bukti
-- L1–L4 yang telah direvisi.
--
-- STATUS: BELUM DIJALANKAN. Jalankan manual terhadap DATABASE LOKAL yang
-- sudah menerapkan SEMUA migration (0001 s/d terakhir). Contoh:
--   psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" \
--     -f supabase/tests/stock_release_guard_ext.sql
-- JANGAN dijalankan pada database produksi/hosted (fixture menulis ke tabel
-- aplikasi; seluruh tulisan dibungkus BEGIN…ROLLBACK, tidak ada commit).
--
-- Yang diuji (statement nyata pada kode aplikasi):
--   W1-webhook : UPDATE orders SET payment_status='failed',
--                order_status='cancelled', invoice_state='failed',
--                xendit_invoice_id=<invoiceId>
--                WHERE order_code=<code> AND payment_status='unpaid'
--                RETURNING order_code          (app/api/webhooks/xendit/route.ts:164-174)
--   W1-verify  : UPDATE orders SET payment_status='failed',
--                order_status='cancelled', invoice_state='failed'
--                WHERE order_code=<code> AND payment_status='unpaid'
--                RETURNING order_code          (app/api/checkout/xendit/verify/route.ts:143-148)
--   Kedua statement dijalankan via CTE `WITH ... UPDATE ... RETURNING
--   order_code` dan jumlah baris ditangkap dengan count(*) — RETURNING list
--   berbeda dari kode (order_code tetap ada), efek trigger identik.
--
-- Klasifikasi bukti (L1–L4):
--   L1: nilai balik/rowcount statement BUKAN bukti pelepasan. `rowcount=1`
--       dapat terjadi tanpa stok kembali (cabang slug NULL guard :244-247;
--       fail-open WARNING :250-254). Wrapper release_order_stock true ⇔ baris
--       wrapper ter-update DAN RETURNING marker non-NULL (:288-296) — wrapper
--       tidak membedakan jalur slug-NULL dari rilis sungguhan.
--   L2: marker stock_released_at = flag state, bukan counter. Marker NULL =
--       "stok belum terkonfirmasi dilepas" (termasuk jalur fail-open) —
--       sinyal resmi untuk retry.
--   L3: perubahan kuantitatif stok (dan sold_count/status) adalah satu-satunya
--       bukti bahwa stok benar-benar kembali; diukur sebelum vs sesudah.
--   L4: hasil tak-pasti (statement timeout / koneksi putus) = INCONCLUSIVE.
--       File pgTAP ini deterministik (satu sesi); L4 relevan di harness
--       konkurensi scripts/stock-release-race (mode tc03/tc04).
--
-- Prasyarat & asumsi:
--   - Sesi berjalan sebagai superuser (session_user 'postgres'): guard
--     memperlakukannya privileged sehingga whitelist kolom dilewati; blok
--     pelepasan stok tetap berjalan untuk semua caller.
--   - guard_orders_insert_client_defaults menimpa kolom stok untuk caller
--     non-admin (auth.jwt() NULL pada sesi psql), jadi stock_reserved_at /
--     payment_status diatur lewat UPDATE terpisah privileged setelah insert.
--   - Trigger handle_new_user (0001) otomatis membuat baris profiles dari
--     auth.users; fixture tidak memasukkan profiles secara eksplisit.
--   - Trigger lain (koin P1-A, invoice_state 2D-E, activity log) aman karena
--     coin_used = 0, tanpa promo, dan idempoten per order_code.
--   - Kolom invoice_state ada (migration 2D-E diterapkan); fallback tanpa
--     kolom tersebut TIDAK diuji di sini (lihat "sengaja tidak tercakup").
--
-- Fixture (semua di dalam transaksi, di-ROLLBACK di akhir):
--   RB-TC04-W1-WH : pending/unpaid, reserved, slug 'test-tc04-ayam' (S0=0)
--   RB-TC04-W1-VF : pending/unpaid, reserved, slug 'test-tc04-bakso' (S0=0)
--   RB-TC04-W3    : paid/paid, reserved, slug 'test-tc04-kopi' (S0=5)
--   RB-TC04-NU    : pending/unpaid, reserved, product_slug NULL (S0=0)
--   RB-TC04-FO    : pending/unpaid, reserved, slug 'test-tc04-fo'
--                   (produknya di-rename 'test-tc04-fo-renamed' → release gagal)
-- ============================================================================

\set ON_ERROR_STOP on
-- ON_ERROR_STOP: error SQL menghentikan psql seketika → koneksi ditutup →
-- transaksi BEGIN…ROLLBACK yang belum selesai otomatis di-ROLLBACK oleh
-- server (tidak ada tulisan yang tersisa). Assertion pgTAP yang gagal TIDAK
-- memicu error SQL (hanya tercatat sebagai hasil tes), jadi laporan hasil
-- tidak berubah.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(24);

-- ---------------------------------------------------------------------------
-- Fixture
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_wh_user uuid := gen_random_uuid();
  v_wh_umkm uuid;
  v_wh_product uuid;
  v_vf_user uuid := gen_random_uuid();
  v_vf_umkm uuid;
  v_vf_product uuid;
  v_w3_user uuid := gen_random_uuid();
  v_w3_umkm uuid;
  v_w3_product uuid;
  v_nu_user uuid := gen_random_uuid();
  v_nu_umkm uuid;
  v_nu_product uuid;
  v_fo_user uuid := gen_random_uuid();
  v_fo_umkm uuid;
  v_fo_product uuid;
BEGIN
  -- Fixture W1-webhook ------------------------------------------------------
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES (v_wh_user, 'stockrelease-guard-ext-wh@example.com', 'no-password-just-fixture', now(), now());

  INSERT INTO public.umkm_profiles (user_id, business_name, city)
  VALUES (v_wh_user, 'UMKM Tes TC04 WH', 'Jakarta')
  RETURNING id INTO v_wh_umkm;

  INSERT INTO public.products (umkm_id, name, slug, surplus_price, stock, status)
  VALUES (v_wh_umkm, 'Ayam TC04 WH', 'test-tc04-ayam', 10000, 0, 'sold_out')
  RETURNING id INTO v_wh_product;

  INSERT INTO public.orders (
    buyer_id, umkm_id, product_id, quantity, total_price,
    delivery_option, payment_status, order_status, lifecycle_status, progress_status,
    order_code, product_slug, created_at
  ) VALUES (
    v_wh_user, v_wh_umkm, v_wh_product, 2, 20000,
    'pickup', 'unpaid', 'pending', 'ongoing', 'disiapkan',
    'RB-TC04-W1-WH', 'test-tc04-ayam', now()
  );

  UPDATE public.orders SET stock_reserved_at = created_at WHERE order_code = 'RB-TC04-W1-WH';

  -- Fixture W1-verify --------------------------------------------------------
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES (v_vf_user, 'stockrelease-guard-ext-vf@example.com', 'no-password-just-fixture', now(), now());

  INSERT INTO public.umkm_profiles (user_id, business_name, city)
  VALUES (v_vf_user, 'UMKM Tes TC04 VF', 'Bandung')
  RETURNING id INTO v_vf_umkm;

  INSERT INTO public.products (umkm_id, name, slug, surplus_price, stock, status)
  VALUES (v_vf_umkm, 'Bakso TC04 VF', 'test-tc04-bakso', 10000, 0, 'sold_out')
  RETURNING id INTO v_vf_product;

  INSERT INTO public.orders (
    buyer_id, umkm_id, product_id, quantity, total_price,
    delivery_option, payment_status, order_status, lifecycle_status, progress_status,
    order_code, product_slug, created_at
  ) VALUES (
    v_vf_user, v_vf_umkm, v_vf_product, 2, 20000,
    'pickup', 'unpaid', 'pending', 'ongoing', 'disiapkan',
    'RB-TC04-W1-VF', 'test-tc04-bakso', now()
  );

  UPDATE public.orders SET stock_reserved_at = created_at WHERE order_code = 'RB-TC04-W1-VF';

  -- Fixture W3 (order sudah paid; webhook EXPIRED terlambat) ------------------
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES (v_w3_user, 'stockrelease-guard-ext-w3@example.com', 'no-password-just-fixture', now(), now());

  INSERT INTO public.umkm_profiles (user_id, business_name, city)
  VALUES (v_w3_user, 'UMKM Tes TC04 W3', 'Surabaya')
  RETURNING id INTO v_w3_umkm;

  INSERT INTO public.products (umkm_id, name, slug, surplus_price, stock, status)
  VALUES (v_w3_umkm, 'Kopi TC04 W3', 'test-tc04-kopi', 10000, 5, 'available')
  RETURNING id INTO v_w3_product;

  INSERT INTO public.orders (
    buyer_id, umkm_id, product_id, quantity, total_price,
    delivery_option, payment_status, order_status, lifecycle_status, progress_status,
    order_code, product_slug, created_at
  ) VALUES (
    v_w3_user, v_w3_umkm, v_w3_product, 2, 20000,
    'pickup', 'unpaid', 'pending', 'ongoing', 'disiapkan',
    'RB-TC04-W3', 'test-tc04-kopi', now()
  );

  UPDATE public.orders
     SET payment_status = 'paid',
         order_status = 'paid',
         stock_reserved_at = created_at
   WHERE order_code = 'RB-TC04-W3';

  -- Fixture NU (product_slug NULL; transisi terminal → cabang :244-247) ------
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES (v_nu_user, 'stockrelease-guard-ext-nu@example.com', 'no-password-just-fixture', now(), now());

  INSERT INTO public.umkm_profiles (user_id, business_name, city)
  VALUES (v_nu_user, 'UMKM Tes TC04 NU', 'Medan')
  RETURNING id INTO v_nu_umkm;

  INSERT INTO public.products (umkm_id, name, slug, surplus_price, stock, status)
  VALUES (v_nu_umkm, 'Tempe TC04 NU', 'test-tc04-nullslug', 10000, 0, 'sold_out')
  RETURNING id INTO v_nu_product;

  INSERT INTO public.orders (
    buyer_id, umkm_id, product_id, quantity, total_price,
    delivery_option, payment_status, order_status, lifecycle_status, progress_status,
    order_code, product_slug, created_at
  ) VALUES (
    v_nu_user, v_nu_umkm, v_nu_product, 2, 20000,
    'pickup', 'unpaid', 'pending', 'ongoing', 'disiapkan',
    'RB-TC04-NU', NULL, now()
  );

  -- Order tetap pending/unpaid saat marker reservasi diklaim → blok rilis
  -- trigger TIDAK aktif untuk UPDATE ini (order belum terminal).
  UPDATE public.orders SET stock_reserved_at = created_at WHERE order_code = 'RB-TC04-NU';

  -- Fixture FO (slug produk di-rename → release_stock gagal/fail-open) --------
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES (v_fo_user, 'stockrelease-guard-ext-fo@example.com', 'no-password-just-fixture', now(), now());

  INSERT INTO public.umkm_profiles (user_id, business_name, city)
  VALUES (v_fo_user, 'UMKM Tes TC04 FO', 'Semarang')
  RETURNING id INTO v_fo_umkm;

  INSERT INTO public.products (umkm_id, name, slug, surplus_price, stock, status)
  VALUES (v_fo_umkm, 'Tahu TC04 FO', 'test-tc04-fo', 10000, 0, 'sold_out')
  RETURNING id INTO v_fo_product;

  INSERT INTO public.orders (
    buyer_id, umkm_id, product_id, quantity, total_price,
    delivery_option, payment_status, order_status, lifecycle_status, progress_status,
    order_code, product_slug, created_at
  ) VALUES (
    v_fo_user, v_fo_umkm, v_fo_product, 2, 20000,
    'pickup', 'unpaid', 'pending', 'ongoing', 'disiapkan',
    'RB-TC04-FO', 'test-tc04-fo', now()
  );

  UPDATE public.orders SET stock_reserved_at = created_at WHERE order_code = 'RB-TC04-FO';

  -- Simulasi kegagalan release_stock: rename slug produk → UPDATE ... WHERE
  -- slug = 'test-tc04-fo' cocok 0 baris → false, tanpa menyentuh baris order.
  UPDATE public.products SET slug = 'test-tc04-fo-renamed' WHERE id = v_fo_product;
END $$;

-- Validasi fixture (prasyarat blok rilis trigger untuk kelima order) ---------
SELECT ok(
  (SELECT count(*) FROM public.orders
    WHERE order_code LIKE 'RB-TC04-%'
      AND stock_reserved_at IS NOT NULL) = 5,
  'validasi fixture: 5 order TC-04 memiliki stock_reserved_at (prasyarat blok rilis trigger)'
);

-- ---------------------------------------------------------------------------
-- W1-webhook: transisi terminal pertama → rilis stok tepat-1x
-- ---------------------------------------------------------------------------
WITH w1wh AS (
  UPDATE public.orders
     SET payment_status = 'failed',
         order_status = 'cancelled',
         invoice_state = 'failed',
         xendit_invoice_id = 'tc04-w1-wh-invoice'
   WHERE order_code = 'RB-TC04-W1-WH'
     AND payment_status = 'unpaid'
  RETURNING order_code
)
SELECT is(
  (SELECT count(*) FROM w1wh),
  1::bigint,
  'W1-webhook (route.ts:164-174): transisi terminal mengenai tepat 1 baris (rowcount=1)'
);

SELECT isnt(
  (SELECT stock_released_at FROM public.orders WHERE order_code = 'RB-TC04-W1-WH'),
  NULL,
  'W1-webhook (L2): marker stock_released_at terisi'
);

SELECT is(
  (SELECT stock FROM public.products WHERE slug = 'test-tc04-ayam'),
  2::integer,
  'W1-webhook (L3): stok berubah 0 → 2 (S0+q) — bukti kuantitatif rilis'
);

SELECT is(
  (SELECT sold_count FROM public.products WHERE slug = 'test-tc04-ayam'),
  0::integer,
  'W1-webhook: sold_count dijepit GREATEST(0, sold_count-q) (release_stock 0013:96)'
);

SELECT is(
  (SELECT status FROM public.products WHERE slug = 'test-tc04-ayam'),
  'available',
  'W1-webhook: status produk sold_out → available (release_stock 0013:97-100)'
);

-- ---------------------------------------------------------------------------
-- W1-verify: varian statement verify (tanpa xendit_invoice_id)
-- ---------------------------------------------------------------------------
WITH w1vf AS (
  UPDATE public.orders
     SET payment_status = 'failed',
         order_status = 'cancelled',
         invoice_state = 'failed'
   WHERE order_code = 'RB-TC04-W1-VF'
     AND payment_status = 'unpaid'
  RETURNING order_code
)
SELECT is(
  (SELECT count(*) FROM w1vf),
  1::bigint,
  'W1-verify (verify/route.ts:143-148): transisi terminal mengenai tepat 1 baris (rowcount=1)'
);

SELECT isnt(
  (SELECT stock_released_at FROM public.orders WHERE order_code = 'RB-TC04-W1-VF'),
  NULL,
  'W1-verify (L2): marker stock_released_at terisi'
);

SELECT is(
  (SELECT stock FROM public.products WHERE slug = 'test-tc04-bakso'),
  2::integer,
  'W1-verify (L3): stok berubah 0 → 2 (S0+q)'
);

-- Snapshot marker setelah W1 (dipakai W2; dibandingkan NULL-safe) -------------
CREATE TEMP TABLE tc04_marker_snap AS
SELECT order_code, stock_released_at
  FROM public.orders
 WHERE order_code IN ('RB-TC04-W1-WH', 'RB-TC04-W1-VF');

-- ---------------------------------------------------------------------------
-- W2: duplikat statement setelah transisi terminal pertama → 0 baris,
--     marker & stok tidak berubah
-- ---------------------------------------------------------------------------
WITH w2wh AS (
  UPDATE public.orders
     SET payment_status = 'failed',
         order_status = 'cancelled',
         invoice_state = 'failed',
         xendit_invoice_id = 'tc04-w2-wh-invoice'
   WHERE order_code = 'RB-TC04-W1-WH'
     AND payment_status = 'unpaid'
  RETURNING order_code
)
SELECT is(
  (SELECT count(*) FROM w2wh),
  0::bigint,
  'W2-webhook: panggilan duplikat 0 baris (filter payment_status=''unpaid'' sudah tidak cocok)'
);

WITH w2vf AS (
  UPDATE public.orders
     SET payment_status = 'failed',
         order_status = 'cancelled',
         invoice_state = 'failed'
   WHERE order_code = 'RB-TC04-W1-VF'
     AND payment_status = 'unpaid'
  RETURNING order_code
)
SELECT is(
  (SELECT count(*) FROM w2vf),
  0::bigint,
  'W2-verify: panggilan duplikat 0 baris'
);

SELECT ok(
  (SELECT o.stock_released_at FROM public.orders o WHERE o.order_code = 'RB-TC04-W1-WH')
    IS NOT DISTINCT FROM
  (SELECT s.stock_released_at FROM tc04_marker_snap s WHERE s.order_code = 'RB-TC04-W1-WH')
  AND
  (SELECT o.stock_released_at FROM public.orders o WHERE o.order_code = 'RB-TC04-W1-VF')
    IS NOT DISTINCT FROM
  (SELECT s.stock_released_at FROM tc04_marker_snap s WHERE s.order_code = 'RB-TC04-W1-VF'),
  'W2 (L2): marker kedua fixture tidak berubah oleh panggilan duplikat'
);

SELECT is(
  (SELECT stock FROM public.products WHERE slug = 'test-tc04-ayam'),
  2::integer,
  'W2 (L3): stok WH tetap 2 — tidak ada pelepasan kedua'
);

SELECT is(
  (SELECT stock FROM public.products WHERE slug = 'test-tc04-bakso'),
  2::integer,
  'W2 (L3): stok VF tetap 2 — tidak ada pelepasan kedua'
);

-- ---------------------------------------------------------------------------
-- W3: EXPIRED/FAILED/VOIDED terlambat setelah paid
--     (cabang kode: baca payment_status='paid' → early return, TANPA UPDATE)
-- ---------------------------------------------------------------------------
SELECT is(
  (SELECT payment_status FROM public.orders WHERE order_code = 'RB-TC04-W3'),
  'paid',
  'prasyarat W3: cabang kode membaca paid → short-circuit route.ts:148-150 (statement terminal tidak dijalankan)'
);

-- Pertahanan berlapis: seandainya statement terminal tetap dieksekusi
-- (bukan perilaku kode saat ini), WHERE payment_status='unpaid' harus 0 baris.
WITH w3 AS (
  UPDATE public.orders
     SET payment_status = 'failed',
         order_status = 'cancelled',
         invoice_state = 'failed',
         xendit_invoice_id = 'tc04-w3-invoice'
   WHERE order_code = 'RB-TC04-W3'
     AND payment_status = 'unpaid'
  RETURNING order_code
)
SELECT is(
  (SELECT count(*) FROM w3),
  0::bigint,
  'W3 (defensif): statement terminal terlambat menyentuh 0 baris; order paid tidak dapat dibatalkan callback gagal'
);

SELECT is(
  (SELECT stock FROM public.products WHERE slug = 'test-tc04-kopi'),
  5::integer,
  'W3 (L3): stok tetap 5 — tidak ada rilis untuk order paid'
);

SELECT ok(
  (SELECT stock_released_at FROM public.orders WHERE order_code = 'RB-TC04-W3') IS NULL,
  'W3 (L2): marker tetap NULL'
);

-- ---------------------------------------------------------------------------
-- NU: product_slug NULL → cabang guard :244-247 mengisi marker TANPA rilis.
--     Menunjukkan rowcount=1 + marker terisi BUKAN bukti stok kembali (L1/L2
--     tanpa L3). Catatan: jalur wrapper tidak dapat mencapai kondisi
--     marker-NULL+slug-NULL+terminal (setiap UPDATE yang menjadikan order
--     terminal/slug-NULL memicu cabang ini di statement yang sama), karena
--     itu demonstrasi memakai statement webhook.
-- ---------------------------------------------------------------------------
WITH nu AS (
  UPDATE public.orders
     SET payment_status = 'failed',
         order_status = 'cancelled',
         invoice_state = 'failed',
         xendit_invoice_id = 'tc04-nu-invoice'
   WHERE order_code = 'RB-TC04-NU'
     AND payment_status = 'unpaid'
  RETURNING order_code
)
SELECT is(
  (SELECT count(*) FROM nu),
  1::bigint,
  'NU: transisi terminal sukses (rowcount=1) walau product_slug NULL'
);

SELECT isnt(
  (SELECT stock_released_at FROM public.orders WHERE order_code = 'RB-TC04-NU'),
  NULL,
  'NU (L1/L2): marker terisi lewat cabang slug NULL (guard :244-247) — transisi+marker sukses'
);

SELECT is(
  (SELECT stock FROM public.products
    WHERE id = (SELECT product_id FROM public.orders WHERE order_code = 'RB-TC04-NU')),
  0::integer,
  'NU (L3): stok TIDAK berubah — marker/rowcount bukan bukti pelepasan stok'
);

-- ---------------------------------------------------------------------------
-- FO: release_stock GAGAL (slug produk di-rename) → fail-open:
--     transisi tetap commit (rowcount=1), marker dibiarkan NULL (sinyal
--     resmi untuk retry), stok tidak berubah.
-- ---------------------------------------------------------------------------
WITH fo AS (
  UPDATE public.orders
     SET payment_status = 'failed',
         order_status = 'cancelled',
         invoice_state = 'failed',
         xendit_invoice_id = 'tc04-fo-invoice'
   WHERE order_code = 'RB-TC04-FO'
     AND payment_status = 'unpaid'
  RETURNING order_code
)
SELECT is(
  (SELECT count(*) FROM fo),
  1::bigint,
  'FO: transisi terminal tetap commit (rowcount=1) meski release_stock gagal (fail-open :250-254)'
);

SELECT ok(
  (SELECT stock_released_at FROM public.orders WHERE order_code = 'RB-TC04-FO') IS NULL,
  'FO (L2): marker tetap NULL — sinyal resmi "stok belum terkonfirmasi dilepas" (kandidat retry)'
);

SELECT is(
  (SELECT stock FROM public.products WHERE slug = 'test-tc04-fo-renamed'),
  0::integer,
  'FO (L3): stok produk (slug di-rename) tetap 0'
);

-- ---------------------------------------------------------------------------
-- SENGAJA TIDAK TERCAKUP di file ini (agar tidak diklaim sebagai terbukti):
--   - Jalur PAID: settleOrderPaid (lib/server/order-settlement.ts) dan
--     cabang SUCCEEDED/PAID webhook (route.ts:103-142) — di luar W1–W3.
--   - Fallback invoice_state (route.ts:175-189; verify:149-160): memerlukan
--     kondisi kolom invoice_state hilang (DDL) — tidak disimulasikan.
--   - Pelepasan promo/koin (route.ts:196-225; planTerminalPromoRelease):
--     fixture tanpa promo/koin; efek no-op tidak diassert di sini.
--   - Auth/throttle/panggilan Xendit/format respons HTTP (webhook selalu 200
--     di route.ts:228) — level route, bukan level statement SQL.
--   - W4 balapan webhook-statement × verify-statement (dan varian opsional
--     wrapper pada order unpaid/pending): diuji harness
--     scripts/stock-release-race/run-race.mjs mode tc04 (gate G0/G1 TC-03).
--   - Semantik rowcount PostgREST `.select('order_code')` (TC-13/14) dan
--     observasi WARNING log — di luar scope file ini.
--   - L4 INDETERMINATE: tidak dapat dipicu di uji satu-sesi deterministik;
--     ditangani di harness (gelombang hasil tak-pasti).
-- ============================================================================

SELECT * FROM finish();
ROLLBACK;
