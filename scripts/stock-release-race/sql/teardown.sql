-- ============================================================================
-- Harness race — Teardown SATU iterasi. MENGHAPUS HANYA baris milik fixture
-- iterasi ini — tiga lapis pengaman:
--   (0) Validasi parameter WAJIB (order_code, slug, run_tag, code_prefix,
--       slug_prefix) SEBELUM DELETE apa pun; parameter kosong/tidak valid
--       atau tidak cocok identitas run → exception (psql exit != 0), tanpa
--       satu pun DELETE dijalankan. Jangan pernah mengandalkan kondisi LIKE
--       sebagai pengaman (M2).
--   (1) Setiap DELETE memakai identitas EKSAK (kode/slug persis + UUID
--       turunan dari baris itu) DAN pola bertag-run sebagai syarat kedua.
--       `code_prefix`/`slug_prefix` adalah prefix MODE (mis. 'RB-TC03-'),
--       BUKAN identitas run — tag run ada DI DALAM kode/slug:
--       'RB-TC03-<TAG>-NN' / 'rb-tc03-<tag>-NN'; wildcard '%' ditulis
--       eksplisit di SQL (L4).
--   (2) Penolakan GUC harness (blok di bawah) tetap berlaku untuk jalur manual.
--
-- Variabel psql (diisi harness):
--   :order_code  :slug  :run_tag  :code_prefix (mis. 'RB-TC03-')  :slug_prefix ('rb-tc03-')
--
-- Urutan & cakupan penghapusan:
--   1. orders (kode eksak + pola bertag run) → cascade order_status_history,
--      seller_transactions (FK ON DELETE CASCADE).
--   2. products (slug eksak + pola bertag run) → DELETE ini memicu trigger
--      AFTER DELETE 20261012000000 yang menulis log 'product_deleted'.
--   3. activity_logs milik fixture — target EKSAK (id order/produk) DITAMBAH
--      metadata EKSAK yang terbukti ditulis trigger aktivitas (bukan LIKE):
--        order   : metadata->>'order_code' = :'order_code' (kode unik run+iter)
--        product : metadata->>'umkm_id'    = :'umkm_id'    (umkm unik per iter)
--      Metadata menangkap log yatim bila baris entitasnya hilang lebih dulu;
--      umkm_id kosong → NULL → tidak menghapus apa pun. Tanpa filter user_id.
--      Dijalankan SETELAH produk dihapus agar log 'product_deleted' tercakup.
--   4. umkm_profiles milik fixture (id diambil dari baris order di atas).
--   5. auth.users milik fixture → cascade profiles/umkm sisa/notifications.
--   6. Verifikasi sisa milik RUN INI (semua target 0): orders (pola bertag
--      run), products (pola bertag run), akun fixture (id buyer/owner + pola
--      email bertag run), activity_logs berdasarkan target + metadata EKSAK.
--
-- Penanda keberadaan (teardown_present_*: '1'/'0') membedakan "fixture memang
-- tidak ada" (setup gagal/rollback) dari "fixture hilang sebelum teardown".
-- teardown_products=0 TANPA penanda ini BUKAN bukti bahwa cleanup bersih.
--
-- Status: BELUM DIJALANKAN. Pengaman sesi/proses berada di harness
-- (run-race.mjs); file ini hanya menyentuh baris beridentitas run ini.
-- ============================================================================

\set ON_ERROR_STOP on

DO $guard$
BEGIN
  IF current_setting('rebitess.race.harness', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'DITOLAK: skrip teardown race hanya boleh dijalankan oleh harness scripts/stock-release-race/run-race.mjs (GUC rebitess.race.harness tidak aktif).';
  END IF;
END $guard$;

SET lock_timeout = '5s';
SET statement_timeout = '30s';

-- ---------------------------------------------------------------------------
-- 0. Validasi parameter wajib SEBELUM DELETE apa pun (M2). Psql tidak
--    melakukan substitusi variabel di dalam dollar-quoted body, sehingga
--    pernyataan RAISE dibangun via format() dan dijalankan \gexec HANYA bila
--    ada parameter yang kosong/tidak valid. Tidak ada tabel/temp yang dibuat.
-- ---------------------------------------------------------------------------
SELECT format('DO $g$ BEGIN RAISE EXCEPTION %L; END $g$;', 'DITOLAK teardown race: ' || v_reason)
  FROM (
    SELECT CASE
      WHEN NULLIF(btrim(:'order_code'), '') IS NULL
        THEN 'variabel :order_code kosong/tidak ada'
      WHEN NULLIF(btrim(:'slug'), '') IS NULL
        THEN 'variabel :slug kosong/tidak ada'
      WHEN NULLIF(btrim(:'run_tag'), '') IS NULL
        THEN 'variabel :run_tag kosong/tidak ada'
      WHEN btrim(:'run_tag') !~ '^[a-z0-9]+$'
        THEN 'run_tag tidak valid (harus [a-z0-9]+): ' || btrim(:'run_tag')
      WHEN NULLIF(btrim(:'code_prefix'), '') IS NULL
        THEN 'variabel :code_prefix kosong/tidak ada'
      WHEN right(btrim(:'code_prefix'), 1) <> '-'
        THEN 'code_prefix harus berakhiran - (prefix MODE, mis. RB-TC03-)'
      WHEN NULLIF(btrim(:'slug_prefix'), '') IS NULL
        THEN 'variabel :slug_prefix kosong/tidak ada'
      WHEN right(btrim(:'slug_prefix'), 1) <> '-'
        THEN 'slug_prefix harus berakhiran - (prefix MODE, mis. rb-tc03-)'
      WHEN left(:'order_code', length(:'code_prefix')) IS DISTINCT FROM :'code_prefix'
        THEN 'order_code tidak diawali code_prefix'
      WHEN left(:'slug', length(:'slug_prefix')) IS DISTINCT FROM :'slug_prefix'
        THEN 'slug tidak diawali slug_prefix'
      WHEN upper(split_part(:'order_code', '-', 3)) IS DISTINCT FROM upper(btrim(:'run_tag'))
        THEN 'tag run pada order_code tidak cocok dengan run_tag'
      WHEN lower(split_part(:'slug', '-', 3)) IS DISTINCT FROM lower(btrim(:'run_tag'))
        THEN 'tag run pada slug tidak cocok dengan run_tag'
      WHEN NULLIF(btrim(split_part(:'order_code', '-', 4)), '') IS NULL
        THEN 'sufiks iterasi pada order_code kosong'
      WHEN split_part(:'order_code', '-', 4) IS DISTINCT FROM split_part(:'slug', '-', 4)
        THEN 'sufiks iterasi order_code dan slug tidak sama'
      ELSE NULL
    END AS v_reason
  ) AS t
 WHERE v_reason IS NOT NULL;
\gexec

BEGIN;

-- Konteks fixture (scalar subquery → selalu 1 baris; NULL → '' oleh \gset).
-- Syarat: kode eksak + pola bertag run (tag run ada di dalam kode).
SELECT
  (SELECT o.id::text FROM public.orders o
    WHERE o.order_code = :'order_code'
      AND o.order_code LIKE :'code_prefix' || upper(:'run_tag') || '-%') AS order_id,
  (SELECT o.buyer_id::text FROM public.orders o
    WHERE o.order_code = :'order_code'
      AND o.order_code LIKE :'code_prefix' || upper(:'run_tag') || '-%') AS buyer_id,
  (SELECT o.umkm_id::text FROM public.orders o
    WHERE o.order_code = :'order_code'
      AND o.order_code LIKE :'code_prefix' || upper(:'run_tag') || '-%') AS umkm_id,
  (SELECT p.id::text FROM public.products p
    WHERE p.slug = :'slug'
      AND p.slug LIKE :'slug_prefix' || :'run_tag' || '-%') AS product_id,
  (SELECT u.user_id::text FROM public.umkm_profiles u
    WHERE u.id = (SELECT o.umkm_id FROM public.orders o
                   WHERE o.order_code = :'order_code'
                     AND o.order_code LIKE :'code_prefix' || upper(:'run_tag') || '-%')) AS owner_id
\gset
\echo teardown_ctx_order=:order_id teardown_ctx_buyer=:buyer_id teardown_ctx_umkm=:umkm_id teardown_ctx_product=:product_id teardown_ctx_owner=:owner_id

-- 0b. Marker KEBERADAAN eksplisit (F5): teardown_products=0 saja TIDAK
--     membuktikan produk sudah dibersihkan — bisa berarti produk hilang
--     sebelum teardown (log produk mungkin tertinggal). Marker '1'/'0' selalu
--     terbaca (bukan echo kosong) dan run-scoped karena diturunkan dari
--     konteks bertag run di atas.
SELECT CASE WHEN NULLIF(:'order_id', '')   IS NOT NULL THEN '1' ELSE '0' END AS present_order,
       CASE WHEN NULLIF(:'product_id', '') IS NOT NULL THEN '1' ELSE '0' END AS present_product,
       CASE WHEN NULLIF(:'umkm_id', '')    IS NOT NULL THEN '1' ELSE '0' END AS present_umkm,
       CASE WHEN NULLIF(:'buyer_id', '')   IS NOT NULL THEN '1' ELSE '0' END AS present_buyer,
       CASE WHEN NULLIF(:'owner_id', '')   IS NOT NULL THEN '1' ELSE '0' END AS present_owner
\gset
\echo teardown_present_order=:present_order teardown_present_product=:present_product teardown_present_umkm=:present_umkm teardown_present_buyer=:present_buyer teardown_present_owner=:present_owner

-- 1. orders (kode eksak + pola bertag run) → cascade history/seller_transactions.
WITH del AS (
  DELETE FROM public.orders
   WHERE order_code = :'order_code'
     AND order_code LIKE :'code_prefix' || upper(:'run_tag') || '-%'
  RETURNING 1
)
SELECT count(*)::text AS n FROM del \gset
\echo teardown_orders=:n

-- 2. products (slug eksak + pola bertag run) → memicu log 'product_deleted'.
WITH del AS (
  DELETE FROM public.products
   WHERE slug = :'slug'
     AND slug LIKE :'slug_prefix' || :'run_tag' || '-%'
  RETURNING 1
)
SELECT count(*)::text AS n FROM del \gset
\echo teardown_products=:n

-- 3. activity_logs milik fixture — target EKSAK (id order/produk) DITAMBAH
--    metadata EKSAK yang terbukti ditulis trigger aktivitas (bukan LIKE):
--      order   : metadata->>'order_code' = :'order_code'
--      product : metadata->>'umkm_id'    = :'umkm_id'
--    Metadata menangkap log yatim bila baris entitasnya hilang lebih dulu;
--    umkm_id kosong → NULL → tidak menghapus apa pun. Tanpa filter user_id.
--    Dijalankan setelah produk dihapus agar log 'product_deleted' tertangkap.
WITH del AS (
  DELETE FROM public.activity_logs
   WHERE (target_type = 'order'
          AND (target_id = NULLIF(:'order_id', '')::uuid
               OR metadata->>'order_code' = NULLIF(:'order_code', '')))
      OR (target_type = 'product'
          AND (target_id = NULLIF(:'product_id', '')::uuid
               OR metadata->>'umkm_id' = NULLIF(:'umkm_id', '')))
  RETURNING 1
)
SELECT count(*)::text AS n FROM del \gset
\echo teardown_activity_logs=:n

-- 4. umkm_profiles fixture.
WITH del AS (
  DELETE FROM public.umkm_profiles
   WHERE id = NULLIF(:'umkm_id', '')::uuid
  RETURNING 1
)
SELECT count(*)::text AS n FROM del \gset
\echo teardown_umkm=:n

-- 5. auth.users fixture → cascade profiles/umkm sisa/notifications.
WITH del AS (
  DELETE FROM auth.users
   WHERE id IN (NULLIF(:'buyer_id', '')::uuid, NULLIF(:'owner_id', '')::uuid)
  RETURNING 1
)
SELECT count(*)::text AS n FROM del \gset
\echo teardown_users=:n

-- 6. Verifikasi sisa orders milik RUN INI (pola bertag run; target: 0).
SELECT count(*)::text AS n
  FROM public.orders
 WHERE order_code LIKE :'code_prefix' || upper(:'run_tag') || '-%' \gset
\echo teardown_leftover_orders=:n

-- 7. Verifikasi sisa products milik RUN INI (pola bertag run; target: 0).
SELECT count(*)::text AS n
  FROM public.products
 WHERE slug LIKE :'slug_prefix' || :'run_tag' || '-%' \gset
\echo teardown_leftover_products=:n

-- 8. Verifikasi sisa akun fixture (id buyer/owner + pola email bertag run;
--    email dibuat setup: race-<tag>-NN@example.test; target: 0).
SELECT count(*)::text AS n
  FROM auth.users
 WHERE id IN (NULLIF(:'buyer_id', '')::uuid, NULLIF(:'owner_id', '')::uuid)
    OR email LIKE 'race-' || :'run_tag' || '-%@example.test' \gset
\echo teardown_leftover_users=:n

-- 9. Verifikasi sisa activity_logs bertarget fixture (target: 0) — bukti
--    sweep langkah 3 benar-benar bersih. Predikat SAMA dengan langkah 3.
SELECT count(*)::text AS n
  FROM public.activity_logs
 WHERE (target_type = 'order'
        AND (target_id = NULLIF(:'order_id', '')::uuid
             OR metadata->>'order_code' = NULLIF(:'order_code', '')))
    OR (target_type = 'product'
        AND (target_id = NULLIF(:'product_id', '')::uuid
             OR metadata->>'umkm_id' = NULLIF(:'umkm_id', ''))) \gset
\echo teardown_leftover_logs=:n

COMMIT;

\echo teardown_committed=t
