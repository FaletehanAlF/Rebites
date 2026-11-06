-- ============================================================================
-- TC-03 (harness) — Setup fixture SATU iterasi (COMMIT; dibutuhkan karena
-- sesi A/B harus melihat baris yang sudah ter-commit).
--
-- Variabel psql (diisi harness):
--   :user_id :email :business :slug :order_code :qty
--
-- Bentuk fixture akhir yang diinginkan — persis kandidat retry lapisan ops:
--   order cancelled/unpaid, stock_reserved_at terisi, stock_released_at NULL,
--   product_slug ada dan produknya ada di tabung → wrapper release_order_stock
--   AKAN benar-benar melepas stok saat dipanggil.
--
-- Cara mencapai status itu TANPA memicu rilis lebih awal (penting):
--   1. Klaim marker reservasi saat order masih pending/unpaid — blok rilis
--      trigger tidak aktif (bukan terminal), jadi tidak ada pelepasan.
--   2. Simulasikan produk hilang saat transisi terminal (slug di-rename
--      sementara) → release_stock gagal → fail-open :250-254: transisi tetap
--      commit, marker DIBIARKAN NULL (inilah yang mustahil dicapai lewat
--      jalur normal seandainya rilis pertama sukses).
--   3. Pulihkan slug produk (UPDATE tabel products saja; tidak menyentuh
--      order, tidak memicu guard orders). Kini order = kandidat retry siap
--      direntengkan pada balapan TC-03.
--
-- Status: BELUM DIJALANKAN. Dijalankan HANYA oleh harness run-race.mjs
-- (guard GUC + penolakan nonlokal + validasi + cleanup ada di harness).
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

-- Langkah 1: klaim marker reservasi saat order masih pending/unpaid.
UPDATE public.orders
   SET stock_reserved_at = created_at
 WHERE order_code = :'order_code'
   AND order_status = 'pending'
   AND payment_status = 'unpaid'
   AND stock_reserved_at IS NULL
   AND stock_released_at IS NULL;

-- Langkah 2: produk "hilang" saat transisi terminal → rilis gagal (fail-open).
UPDATE public.products
   SET slug = :'slug' || '-hidden'
 WHERE slug = :'slug';

UPDATE public.orders
   SET order_status = 'cancelled'
 WHERE order_code = :'order_code'
   AND order_status = 'pending'
   AND payment_status = 'unpaid'
   AND stock_released_at IS NULL;
-- (RAISE WARNING 'pelepasan stok GAGAL ...' dari guard :251-253 di sini
--  memang diharapkan; marker dibiarkan NULL.)

-- Langkah 3: pulihkan slug produk (tanpa menyentuh baris order).
UPDATE public.products
   SET slug = :'slug'
 WHERE slug = :'slug' || '-hidden';

COMMIT;

\echo setup_committed=tc03
