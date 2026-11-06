-- ============================================================================
-- TC-04 W4 (harness) — Setup fixture SATU iterasi (COMMIT).
--
-- Variabel psql (diisi harness):
--   :user_id :email :business :slug :order_code :qty
--
-- Bentuk fixture akhir: order pending/unpaid dengan marker reservasi
-- (stock_reserved_at) terisi; produk ada dan stok penuh (S0=25, sold_count=5).
-- Balapan A (statement webhook) × B (statement verify) kemudian memperebutkan
-- transisi terminal yang sama — tepat satu boleh menang dan melepas stok.
--
-- Status: BELUM DIJALANKAN. Pengaman sama dengan setup-tc03.sql.
-- ============================================================================

\set ON_ERROR_STOP on

DO $guard$
BEGIN
  IF current_setting('rebitess.race.harness', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'DITOLAK: skrip setup race hanya boleh dijalankan oleh harness scripts/stock-release-race/run-race.mjs (GUC rebitess.race.harness tidak aktif).';
  END IF;
END $guard$;

SET lock_timeout = '5s';
SET statement_timeout = '30s';

BEGIN;

INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
VALUES (:'user_id'::uuid, :'email', 'no-password-just-fixture', now(), now());

INSERT INTO public.umkm_profiles (user_id, business_name, city)
VALUES (:'user_id'::uuid, :'business', 'Jakarta')
RETURNING id::text AS umkm_id \gset

INSERT INTO public.products (umkm_id, name, slug, surplus_price, stock, sold_count, status)
VALUES (:'umkm_id'::uuid, :'business', :'slug', 10000, 25, 5, 'available');

INSERT INTO public.orders (
  buyer_id, umkm_id, product_id, quantity, total_price,
  delivery_option, payment_status, order_status, lifecycle_status, progress_status,
  order_code, product_slug, created_at
)
SELECT :'user_id'::uuid, :'umkm_id'::uuid, p.id, :'qty'::integer, (:'qty'::integer * 10000),
       'pickup', 'unpaid', 'pending', 'ongoing', 'disiapkan',
       :'order_code', :'slug', now()
  FROM public.products p
 WHERE p.slug = :'slug';

-- Klaim marker reservasi saat order masih pending/unpaid (blok rilis trigger
-- tidak aktif untuk non-terminal) → siap diperebutkan A/B.
UPDATE public.orders
   SET stock_reserved_at = created_at
 WHERE order_code = :'order_code'
   AND order_status = 'pending'
   AND payment_status = 'unpaid'
   AND stock_reserved_at IS NULL
   AND stock_released_at IS NULL;

COMMIT;

\echo setup_committed=tc04
