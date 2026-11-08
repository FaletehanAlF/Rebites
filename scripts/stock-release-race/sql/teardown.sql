












































\set ON_ERROR_STOP on

DO $guard$
BEGIN
  IF current_setting('rebitess.race.harness', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'DITOLAK: skrip teardown race hanya boleh dijalankan oleh harness scripts/stock-release-race/run-race.mjs (GUC rebitess.race.harness tidak aktif).';
  END IF;
END $guard$;

SET lock_timeout = '5s';
SET statement_timeout = '30s';







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






SELECT CASE WHEN NULLIF(:'order_id', '')   IS NOT NULL THEN '1' ELSE '0' END AS present_order,
       CASE WHEN NULLIF(:'product_id', '') IS NOT NULL THEN '1' ELSE '0' END AS present_product,
       CASE WHEN NULLIF(:'umkm_id', '')    IS NOT NULL THEN '1' ELSE '0' END AS present_umkm,
       CASE WHEN NULLIF(:'buyer_id', '')   IS NOT NULL THEN '1' ELSE '0' END AS present_buyer,
       CASE WHEN NULLIF(:'owner_id', '')   IS NOT NULL THEN '1' ELSE '0' END AS present_owner
\gset
\echo teardown_present_order=:present_order teardown_present_product=:present_product teardown_present_umkm=:present_umkm teardown_present_buyer=:present_buyer teardown_present_owner=:present_owner


WITH del AS (
  DELETE FROM public.orders
   WHERE order_code = :'order_code'
     AND order_code LIKE :'code_prefix' || upper(:'run_tag') || '-%'
  RETURNING 1
)
SELECT count(*)::text AS n FROM del \gset
\echo teardown_orders=:n


WITH del AS (
  DELETE FROM public.products
   WHERE slug = :'slug'
     AND slug LIKE :'slug_prefix' || :'run_tag' || '-%'
  RETURNING 1
)
SELECT count(*)::text AS n FROM del \gset
\echo teardown_products=:n








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


WITH del AS (
  DELETE FROM public.umkm_profiles
   WHERE id = NULLIF(:'umkm_id', '')::uuid
  RETURNING 1
)
SELECT count(*)::text AS n FROM del \gset
\echo teardown_umkm=:n


WITH del AS (
  DELETE FROM auth.users
   WHERE id IN (NULLIF(:'buyer_id', '')::uuid, NULLIF(:'owner_id', '')::uuid)
  RETURNING 1
)
SELECT count(*)::text AS n FROM del \gset
\echo teardown_users=:n


SELECT count(*)::text AS n
  FROM public.orders
 WHERE order_code LIKE :'code_prefix' || upper(:'run_tag') || '-%' \gset
\echo teardown_leftover_orders=:n


SELECT count(*)::text AS n
  FROM public.products
 WHERE slug LIKE :'slug_prefix' || :'run_tag' || '-%' \gset
\echo teardown_leftover_products=:n



SELECT count(*)::text AS n
  FROM auth.users
 WHERE id IN (NULLIF(:'buyer_id', '')::uuid, NULLIF(:'owner_id', '')::uuid)
    OR email LIKE 'race-' || :'run_tag' || '-%@example.test' \gset
\echo teardown_leftover_users=:n



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
