







































































BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(42);




SET LOCAL request.jwt.claims = '{"role":"service_role"}';




DO $$
DECLARE
  v_u1 uuid := '11111111-1111-4111-8111-111111111111';
  v_u2 uuid := '22222222-2222-4222-8222-222222222222';
  v_u3 uuid := '33333333-3333-4333-8333-333333333333';
  v_u4 uuid := '44444444-4444-4444-8444-444444444444';
  v_u5 uuid := '55555555-5555-4555-8555-555555555555';
  v_u6 uuid := '66666666-6666-4666-8666-666666666666';
  v_u7 uuid := '77777777-7777-4777-8777-777777777777';
  v_u8 uuid := '88888888-8888-4888-8888-888888888888';
  v_u9 uuid := '99999999-9999-4999-8999-999999999999';
  v_um uuid;
  v_pr uuid;
BEGIN
  
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES (v_u1, 'p1c-1@example.com', 'x', now(), now());
  INSERT INTO public.umkm_profiles (user_id, business_name, city)
  VALUES (v_u1, 'P1C UMKM 1', 'Jakarta') RETURNING id INTO v_um;
  INSERT INTO public.products (umkm_id, name, slug, surplus_price, stock, sold_count, status)
  VALUES (v_um, 'P1C Produk 1', 'p1c-spent-1', 10000, 10, 0, 'available') RETURNING id INTO v_pr;
  INSERT INTO public.orders (
    buyer_id, umkm_id, product_id, quantity, total_price, delivery_option,
    payment_status, order_status, lifecycle_status, progress_status,
    order_code, product_slug, coin_used, coin_earned, stock_reserved_at, created_at
  ) VALUES (
    v_u1, v_um, v_pr, 1, 0, 'pickup',
    'paid', 'paid', 'ongoing', 'disiapkan',
    'RB-P1C-1', 'p1c-spent-1', 500, 0, now(), now()
  );
  INSERT INTO public.coin_transactions (user_id, order_code, type, amount, description)
  VALUES (v_u1, 'RB-P1C-1', 'spent', 500, 'Potongan pesanan');

  
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES (v_u2, 'p1c-2@example.com', 'x', now(), now());
  INSERT INTO public.umkm_profiles (user_id, business_name, city)
  VALUES (v_u2, 'P1C UMKM 2', 'Bandung') RETURNING id INTO v_um;
  INSERT INTO public.products (umkm_id, name, slug, surplus_price, stock, sold_count, status)
  VALUES (v_um, 'P1C Produk 2', 'p1c-nospent-2', 10000, 10, 0, 'available') RETURNING id INTO v_pr;
  INSERT INTO public.orders (
    buyer_id, umkm_id, product_id, quantity, total_price, delivery_option,
    payment_status, order_status, lifecycle_status, progress_status,
    order_code, product_slug, coin_used, coin_earned, stock_reserved_at, created_at
  ) VALUES (
    v_u2, v_um, v_pr, 1, 0, 'pickup',
    'paid', 'paid', 'ongoing', 'disiapkan',
    'RB-P1C-2', 'p1c-nospent-2', 500, 0, now(), now()
  );

  
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES (v_u3, 'p1c-3@example.com', 'x', now(), now());
  INSERT INTO public.umkm_profiles (user_id, business_name, city)
  VALUES (v_u3, 'P1C UMKM 3', 'Surabaya') RETURNING id INTO v_um;
  INSERT INTO public.products (umkm_id, name, slug, surplus_price, stock, sold_count, status)
  VALUES (v_um, 'P1C Produk 3', 'p1c-spent-3', 10000, 10, 0, 'available') RETURNING id INTO v_pr;
  INSERT INTO public.orders (
    buyer_id, umkm_id, product_id, quantity, total_price, delivery_option,
    payment_status, order_status, lifecycle_status, progress_status,
    order_code, product_slug, coin_used, coin_earned, stock_reserved_at, created_at
  ) VALUES (
    v_u3, v_um, v_pr, 1, 0, 'pickup',
    'paid', 'paid', 'ongoing', 'disiapkan',
    'RB-P1C-3', 'p1c-spent-3', 300, 0, now(), now()
  );
  INSERT INTO public.coin_transactions (user_id, order_code, type, amount, description)
  VALUES (v_u3, 'RB-P1C-3', 'spent', 300, 'Potongan pesanan');

  
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES (v_u4, 'p1c-4@example.com', 'x', now(), now());
  INSERT INTO public.umkm_profiles (user_id, business_name, city)
  VALUES (v_u4, 'P1C UMKM 4', 'Medan') RETURNING id INTO v_um;
  INSERT INTO public.products (umkm_id, name, slug, surplus_price, stock, sold_count, status)
  VALUES (v_um, 'P1C Produk 4', 'p1c-spent-4', 10000, 10, 0, 'available') RETURNING id INTO v_pr;
  INSERT INTO public.orders (
    buyer_id, umkm_id, product_id, quantity, total_price, delivery_option,
    payment_status, order_status, lifecycle_status, progress_status,
    order_code, product_slug, coin_used, coin_earned, stock_reserved_at, created_at
  ) VALUES (
    v_u4, v_um, v_pr, 1, 0, 'pickup',
    'paid', 'paid', 'ongoing', 'disiapkan',
    'RB-P1C-4', 'p1c-spent-4', 700, 0, now(), now()
  );
  INSERT INTO public.coin_transactions (user_id, order_code, type, amount, description)
  VALUES (v_u4, 'RB-P1C-4', 'spent', 700, 'Potongan pesanan');

  
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES (v_u5, 'p1c-5@example.com', 'x', now(), now());
  INSERT INTO public.umkm_profiles (user_id, business_name, city)
  VALUES (v_u5, 'P1C UMKM 5', 'Semarang') RETURNING id INTO v_um;
  INSERT INTO public.products (umkm_id, name, slug, surplus_price, stock, sold_count, status)
  VALUES (v_um, 'P1C Produk 5', 'p1c-hist-5', 10000, 10, 0, 'available') RETURNING id INTO v_pr;
  INSERT INTO public.orders (
    buyer_id, umkm_id, product_id, quantity, total_price, delivery_option,
    payment_status, order_status, lifecycle_status, progress_status,
    order_code, product_slug, coin_used, coin_earned, stock_reserved_at, created_at
  ) VALUES (
    v_u5, v_um, v_pr, 1, 0, 'pickup',
    'paid', 'paid', 'ongoing', 'disiapkan',
    'RB-P1C-5', 'p1c-hist-5', 900, 0, now(), now()
  );

  
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES (v_u6, 'p1c-6@example.com', 'x', now(), now());
  INSERT INTO public.umkm_profiles (user_id, business_name, city)
  VALUES (v_u6, 'P1C UMKM 6', 'Makassar') RETURNING id INTO v_um;
  INSERT INTO public.products (umkm_id, name, slug, surplus_price, stock, sold_count, status)
  VALUES (v_um, 'P1C Produk 6', 'p1c-term-6', 10000, 10, 0, 'available') RETURNING id INTO v_pr;
  INSERT INTO public.orders (
    buyer_id, umkm_id, product_id, quantity, total_price, delivery_option,
    payment_status, order_status, lifecycle_status, progress_status,
    order_code, product_slug, coin_used, coin_earned, stock_reserved_at, created_at
  ) VALUES (
    v_u6, v_um, v_pr, 1, 0, 'pickup',
    'unpaid', 'pending', 'ongoing', 'disiapkan',
    'RB-P1C-6', 'p1c-term-6', 0, 0, NULL, now()
  );

  
  
  
  
  
  INSERT INTO public.coin_transactions (user_id, order_code, type, amount, description)
  VALUES (v_u6, NULL, 'earned', 1000, 'Saldo awal uji I7 (order terminal)');

  
  
  
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES (v_u7, 'p1c-7@example.com', 'x', now(), now());
  INSERT INTO public.umkm_profiles (user_id, business_name, city)
  VALUES (v_u7, 'P1C UMKM 7', 'Palembang') RETURNING id INTO v_um;
  INSERT INTO public.products (umkm_id, name, slug, surplus_price, stock, sold_count, status)
  VALUES (v_um, 'P1C Produk 7', 'p1c-owner-7', 10000, 10, 0, 'available') RETURNING id INTO v_pr;
  INSERT INTO public.orders (
    buyer_id, umkm_id, product_id, quantity, total_price, delivery_option,
    payment_status, order_status, lifecycle_status, progress_status,
    order_code, product_slug, coin_used, coin_earned, stock_reserved_at, created_at
  ) VALUES (
    v_u7, v_um, v_pr, 1, 0, 'pickup',
    'unpaid', 'pending', 'ongoing', 'disiapkan',
    'RB-P1C-7', 'p1c-owner-7', 250, 0, NULL, now()
  );
  
  INSERT INTO public.coin_transactions (user_id, order_code, type, amount, description)
  VALUES (v_u7, NULL, 'earned', 1000, 'Saldo awal uji S-1');

  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES (v_u8, 'p1c-8@example.com', 'x', now(), now());
  
  
  
  
  INSERT INTO public.coin_transactions (user_id, order_code, type, amount, description)
  VALUES (v_u8, NULL, 'earned', 1000, 'Saldo awal uji S-1 (bukan pemilik order)');

  
  
  
  
  
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES (v_u9, 'p1c-9@example.com', 'x', now(), now());
  INSERT INTO public.umkm_profiles (user_id, business_name, city)
  VALUES (v_u9, 'P1C UMKM 9', 'Denpasar') RETURNING id INTO v_um;
  INSERT INTO public.products (umkm_id, name, slug, surplus_price, stock, sold_count, status)
  VALUES (v_um, 'P1C Produk 9', 'p1c-ledger-9', 10000, 10, 0, 'available') RETURNING id INTO v_pr;
  INSERT INTO public.orders (
    buyer_id, umkm_id, product_id, quantity, total_price, delivery_option,
    payment_status, order_status, lifecycle_status, progress_status,
    order_code, product_slug, coin_used, coin_earned, stock_reserved_at, created_at
  ) VALUES (
    v_u9, v_um, v_pr, 1, 0, 'pickup',
    'paid', 'paid', 'ongoing', 'disiapkan',
    'RB-P1C-9', 'p1c-ledger-9', 900, 0, now(), now()
  );
  INSERT INTO public.coin_transactions (user_id, order_code, type, amount, description)
  VALUES (v_u9, 'RB-P1C-9', 'spent', 300, 'Potongan pesanan (nominal ledger)');
END $$;


SELECT ok(
  (SELECT count(*) FROM public.orders o
     JOIN public.coin_transactions ct
       ON ct.user_id = o.buyer_id AND ct.order_code = o.order_code AND ct.type = 'spent'
    WHERE o.order_code = 'RB-P1C-1' AND o.coin_used = 500 AND ct.amount = 500) = 1,
  'fixture: RB-P1C-1 paid, coin_used 500, ada debit spent 500'
);

SELECT ok(
  (SELECT count(*) FROM public.orders o
    WHERE o.order_code = 'RB-P1C-2' AND o.coin_used = 500
      AND NOT EXISTS (SELECT 1 FROM public.coin_transactions ct
                       WHERE ct.user_id = o.buyer_id AND ct.order_code = o.order_code
                         AND ct.type = 'spent')) = 1,
  'fixture: RB-P1C-2 paid, coin_used 500, TIDAK ada debit spent'
);





SELECT ok(
  (SELECT count(*) FROM (
     SELECT user_id,
            SUM(CASE WHEN type IN ('earned','refund') THEN amount ELSE 0 END)
            - SUM(CASE WHEN type = 'spent' THEN amount ELSE 0 END) AS saldo
       FROM public.coin_transactions
      WHERE user_id IN ('66666666-6666-4666-8666-666666666666',
                        '88888888-8888-4888-8888-888888888888')
      GROUP BY user_id
   ) s
   WHERE s.saldo >= 250) = 2,
  'fixture: saldo U6 dan U8 >= 250 (cukup) sehingga false pada I7/I9 bukan berasal dari saldo'
);



SELECT ok(
  (SELECT count(*) FROM public.orders o
     JOIN public.coin_transactions ct
       ON ct.user_id = o.buyer_id AND ct.order_code = o.order_code AND ct.type = 'spent'
    WHERE o.order_code = 'RB-P1C-9' AND o.coin_used = 900 AND ct.amount = 300) = 1,
  'fixture: RB-P1C-9 coin_used 900 dengan debit spent 300 (nominal ledger != snapshot)'
);




UPDATE public.orders
   SET order_status = 'cancelled', payment_status = 'failed'
 WHERE order_code = 'RB-P1C-1';

SELECT is(
  (SELECT count(*) FROM public.coin_transactions
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
      AND order_code = 'RB-P1C-1' AND type = 'refund'),
  1::bigint,
  'I1: terminalisasi dengan debit spent menghasilkan tepat satu refund'
);

SELECT is(
  (SELECT amount FROM public.coin_transactions
    WHERE user_id = '11111111-1111-4111-8111-111111111111'
      AND order_code = 'RB-P1C-1' AND type = 'refund'),
  500::integer,
  'I1: nominal refund = debit aktual (500), bukan nilai lain'
);

SELECT is(
  (SELECT count(*) FROM public.coin_transactions
    WHERE order_code = 'RB-P1C-1' AND type IN ('spent','refund')),
  2::bigint,
  'I1: ledger order RB-P1C-1 berisi satu spent + satu refund'
);




UPDATE public.orders
   SET order_status = 'cancelled', payment_status = 'failed'
 WHERE order_code = 'RB-P1C-2';

SELECT is(
  (SELECT count(*) FROM public.coin_transactions
    WHERE user_id = '22222222-2222-4222-8222-222222222222'
      AND order_code = 'RB-P1C-2' AND type = 'refund'),
  0::bigint,
  'I2: tanpa debit spent tidak ada baris refund sama sekali'
);

SELECT is(
  (SELECT COALESCE(SUM(CASE WHEN type IN ('earned','refund') THEN amount ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN type = 'spent' THEN amount ELSE 0 END), 0)
     FROM public.coin_transactions
    WHERE user_id = '22222222-2222-4222-8222-222222222222'),
  0::bigint,
  'I2: saldo buyer tidak naik (tidak ada Coin dari nol)'
);




UPDATE public.orders
   SET order_status = 'cancelled', payment_status = 'failed'
 WHERE order_code = 'RB-P1C-1';

SELECT is(
  (SELECT count(*) FROM public.coin_transactions
    WHERE order_code = 'RB-P1C-1' AND type = 'refund'),
  1::bigint,
  'I3: transisi terminal kedua tidak menambah refund'
);

SELECT is(
  (SELECT amount FROM public.coin_transactions
    WHERE order_code = 'RB-P1C-1' AND type = 'refund'),
  500::integer,
  'I3: nominal refund tidak berubah setelah transisi kedua'
);




SELECT is(
  public.refund_order_coins('33333333-3333-4333-8333-333333333333', 'RB-P1C-3'),
  true,
  'I4: RPC refund_order_coins mengembalikan true untuk order yang punya spent'
);

UPDATE public.orders
   SET order_status = 'cancelled', payment_status = 'failed'
 WHERE order_code = 'RB-P1C-3';

SELECT is(
  (SELECT count(*) FROM public.coin_transactions
    WHERE order_code = 'RB-P1C-3' AND type = 'refund'),
  1::bigint,
  'I4: RPC refund + terminalisasi tetap menghasilkan satu refund'
);

SELECT is(
  (SELECT amount FROM public.coin_transactions
    WHERE order_code = 'RB-P1C-3' AND type = 'refund'),
  300::integer,
  'I4: nominal refund = debit aktual (300)'
);




UPDATE public.orders
   SET order_status = 'cancelled', payment_status = 'failed'
 WHERE order_code = 'RB-P1C-4';

SELECT is(
  public.refund_order_coins('44444444-4444-4444-8444-444444444444', 'RB-P1C-4'),
  true,
  'I5: RPC refund setelah terminalisasi idempoten (true)'
);

SELECT is(
  (SELECT count(*) FROM public.coin_transactions
    WHERE order_code = 'RB-P1C-4' AND type = 'refund'),
  1::bigint,
  'I5: tidak ada refund kedua dari RPC setelah terminalisasi'
);

SELECT is(
  (SELECT amount FROM public.coin_transactions
    WHERE order_code = 'RB-P1C-4' AND type = 'refund'),
  700::integer,
  'I5: nominal refund = debit aktual (700)'
);




UPDATE public.orders
   SET order_status = 'cancelled', payment_status = 'failed'
 WHERE order_code = 'RB-P1C-5';

SELECT is(
  (SELECT count(*) FROM public.coin_transactions
    WHERE order_code = 'RB-P1C-5' AND type = 'refund'),
  0::bigint,
  'I6: order historis tanpa spent tidak menghasilkan refund'
);

SELECT is(
  (SELECT COALESCE(SUM(CASE WHEN type IN ('earned','refund') THEN amount ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN type = 'spent' THEN amount ELSE 0 END), 0)
     FROM public.coin_transactions
    WHERE user_id = '55555555-5555-4555-8555-555555555555'),
  0::bigint,
  'I6: saldo buyer order historis tidak naik (regresi mint tertutup)'
);

SELECT is(
  (SELECT coin_used FROM public.orders WHERE order_code = 'RB-P1C-5'),
  900::integer,
  'I6: orders.coin_used TIDAK diubah oleh terminalisasi (bukti utang tetap ada)'
);




UPDATE public.orders
   SET order_status = 'cancelled', payment_status = 'failed'
 WHERE order_code = 'RB-P1C-6';

SELECT is(
  public.spend_order_coins('66666666-6666-4666-8666-666666666666', 'RB-P1C-6', 250),
  false,
  'I7: spend_order_coins menolak order yang sudah terminal'
);

SELECT is(
  (SELECT count(*) FROM public.coin_transactions
    WHERE user_id = '66666666-6666-4666-8666-666666666666'
      AND order_code = 'RB-P1C-6'),
  0::bigint,
  'I7: ledger tidak berubah setelah debit ditolak'
);

SELECT is(
  (SELECT COALESCE(SUM(CASE WHEN type IN ('earned','refund') THEN amount ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN type = 'spent' THEN amount ELSE 0 END), 0)
     FROM public.coin_transactions
    WHERE user_id = '66666666-6666-4666-8666-666666666666'),
  1000::bigint,
  'I7: saldo buyer tetap 1000 setelah debit ditolak (tidak ada debit 250)'
);




SELECT ok(
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders'
      AND column_name IN ('coin_debit_status','coin_debit_reason','coin_debit_updated_at')) = 3,
  'I8: tiga kolom status utang tersedia di public.orders'
);

SELECT lives_ok(
  $$UPDATE public.orders
       SET coin_debit_status = 'pending',
           coin_debit_reason = 'rpc_error',
           coin_debit_updated_at = now()
     WHERE order_code = 'RB-P1C-1'$$,
  'I8: status utang pending/rpc_error dapat ditulis'
);

SELECT is(
  (SELECT coin_debit_status FROM public.orders WHERE order_code = 'RB-P1C-1'),
  'pending'::text,
  'I8: status utang tersimpan sebagai pending'
);

SELECT is(
  (SELECT coin_used FROM public.orders WHERE order_code = 'RB-P1C-1'),
  500::integer,
  'I8: orders.coin_used tidak berubah saat status utang ditulis'
);


CREATE TEMP TABLE p1c_probe (ok boolean) ON COMMIT DROP;
DO $$
BEGIN
  BEGIN
    UPDATE public.orders
       SET coin_debit_status = 'resolved'
     WHERE order_code = 'RB-P1C-1';
    INSERT INTO p1c_probe VALUES (false);
  EXCEPTION WHEN check_violation THEN
    INSERT INTO p1c_probe VALUES (true);
  END;
END $$;

SELECT is(
  (SELECT ok FROM p1c_probe),
  true,
  'I8: CHECK constraint menolak status di luar kontrak (pending/insufficient)'
);

SELECT is(
  (SELECT coin_debit_status FROM public.orders WHERE order_code = 'RB-P1C-1'),
  'pending'::text,
  'I8: penolakan CHECK tidak mengubah status yang sudah tersimpan'
);

SELECT is(
  (SELECT count(*) FROM public.coin_transactions
    WHERE order_code = 'RB-P1C-1' AND type = 'refund'),
  1::bigint,
  'I8: pencatatan status utang tidak menambah/mengubah baris refund'
);









SELECT is(
  public.spend_order_coins('88888888-8888-4888-8888-888888888888', 'RB-P1C-7', 250),
  false,
  'I9: debit ditolak bila p_user_id bukan buyer_id order'
);

SELECT is(
  (SELECT count(*) FROM public.coin_transactions
    WHERE order_code = 'RB-P1C-7' AND type = 'spent'),
  0::bigint,
  'I9: penolakan pemeriksaan pemilik tidak menulis baris spent'
);

SELECT is(
  (SELECT count(*) FROM public.coin_transactions
    WHERE user_id = '88888888-8888-4888-8888-888888888888' AND type = 'spent'),
  0::bigint,
  'I9: saldo user lain tidak tersentuh'
);

SELECT is(
  public.spend_order_coins('77777777-7777-4777-8777-777777777777', 'RB-P1C-7', 250),
  true,
  'I9: pemilik order dengan saldo cukup dapat didebit'
);

SELECT is(
  (SELECT count(*) FROM public.coin_transactions
    WHERE user_id = '77777777-7777-4777-8777-777777777777'
      AND order_code = 'RB-P1C-7' AND type = 'spent' AND amount = 250),
  1::bigint,
  'I9: debit pemilik tercatat tepat satu baris sebesar 250'
);

SELECT is(
  public.spend_order_coins('77777777-7777-4777-8777-777777777777', 'RB-P1C-7', 250),
  true,
  'I9: pemanggilan idempoten oleh pemilik tetap mengembalikan true'
);

SELECT is(
  (SELECT count(*) FROM public.coin_transactions
    WHERE order_code = 'RB-P1C-7' AND type = 'spent'),
  1::bigint,
  'I9: pemanggilan idempoten tidak menambah debit kedua'
);









UPDATE public.orders
   SET order_status = 'cancelled', payment_status = 'failed'
 WHERE order_code = 'RB-P1C-9';

SELECT is(
  (SELECT count(*) FROM public.coin_transactions
    WHERE user_id = '99999999-9999-4999-8999-999999999999'
      AND order_code = 'RB-P1C-9' AND type = 'refund'),
  1::bigint,
  'I10: terminalisasi menghasilkan tepat satu refund'
);

SELECT is(
  (SELECT amount FROM public.coin_transactions
    WHERE user_id = '99999999-9999-4999-8999-999999999999'
      AND order_code = 'RB-P1C-9' AND type = 'refund'),
  300::integer,
  'I10: nominal refund = 300 (debit ledger aktual), BUKAN 900 (snapshot coin_used)'
);

UPDATE public.orders
   SET order_status = 'cancelled', payment_status = 'failed'
 WHERE order_code = 'RB-P1C-9';

SELECT is(
  (SELECT count(*) FROM public.coin_transactions
    WHERE order_code = 'RB-P1C-9' AND type = 'refund'),
  1::bigint,
  'I10: transisi terminal kedua tidak menambah refund (tetap satu, nominal 300)'
);




SELECT is(
  (SELECT count(*) FROM public.coin_transactions r
    WHERE r.type = 'refund'
      AND NOT EXISTS (SELECT 1 FROM public.coin_transactions s
                       WHERE s.user_id = r.user_id AND s.order_code = r.order_code
                         AND s.type = 'spent')),
  0::bigint,
  'Ringkasan: tidak ada satu pun refund tanpa debit spent yang mengimbangi'
);

SELECT is(
  (SELECT count(*) FROM public.coin_transactions r
    WHERE r.type = 'refund'
      AND EXISTS (SELECT 1 FROM public.coin_transactions s
                   WHERE s.user_id = r.user_id AND s.order_code = r.order_code
                     AND s.type = 'spent')
      AND r.amount <> (SELECT s.amount FROM public.coin_transactions s
                         WHERE s.user_id = r.user_id AND s.order_code = r.order_code
                           AND s.type = 'spent')),
  0::bigint,
  'Ringkasan: setiap refund berpasangan dengan debit spent dan nominalnya sama'
);

SELECT * FROM finish();
ROLLBACK;
