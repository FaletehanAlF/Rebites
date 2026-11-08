































































\set ON_ERROR_STOP on






BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(24);




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

  
  
  UPDATE public.orders SET stock_reserved_at = created_at WHERE order_code = 'RB-TC04-NU';

  
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

  
  
  UPDATE public.products SET slug = 'test-tc04-fo-renamed' WHERE id = v_fo_product;
END $$;


SELECT ok(
  (SELECT count(*) FROM public.orders
    WHERE order_code LIKE 'RB-TC04-%'
      AND stock_reserved_at IS NOT NULL) = 5,
  'validasi fixture: 5 order TC-04 memiliki stock_reserved_at (prasyarat blok rilis trigger)'
);




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


CREATE TEMP TABLE tc04_marker_snap AS
SELECT order_code, stock_released_at
  FROM public.orders
 WHERE order_code IN ('RB-TC04-W1-WH', 'RB-TC04-W1-VF');





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





SELECT is(
  (SELECT payment_status FROM public.orders WHERE order_code = 'RB-TC04-W3'),
  'paid',
  'prasyarat W3: cabang kode membaca paid → short-circuit route.ts:148-150 (statement terminal tidak dijalankan)'
);



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




















SELECT * FROM finish();
ROLLBACK;
