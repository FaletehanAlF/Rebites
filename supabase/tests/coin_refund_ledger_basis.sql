-- ============================================================================
-- TES INTEGRASI pgTAP — P1-C: refund Coin berbasis LEDGER (bukan snapshot)
--
-- STATUS: BELUM DIJALANKAN. Disiapkan pada Tahap 2.2 dan diperbaiki pada
-- Tahap 2.3D (kualitas tes: I7/I9 dibuat diskriminatif, ditambah kasus
-- nominal refund berbasis ledger).
-- Jalankan manual terhadap DATABASE LOKAL yang sudah menerapkan SEMUA
-- migration (termasuk 20261020000000_p1c_coin_refund_ledger_basis.sql).
-- Contoh (supabase CLI lokal atau Postgres + pgTAP):
--   psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" \
--     -f supabase/tests/coin_refund_ledger_basis.sql
-- JANGAN dijalankan pada database produksi/hosted.
--
-- Yang dibuktikan (perilaku trigger & RPC sungguhan, bukan simulasi):
--   I1  'spent' tersedia  -> terminalisasi menghasilkan TEPAT SATU 'refund'
--                            dengan nominal = debit aktual.
--   I2  tidak ada 'spent' -> terminalisasi TIDAK menghasilkan 'refund'
--                            (anti-mint: tidak ada Coin dari nol).
--   I3  terminalisasi berulang -> jumlah 'refund' tetap satu.
--   I4  RPC refund_order_coins lalu terminalisasi -> tetap satu 'refund'.
--   I5  terminalisasi lalu RPC refund_order_coins -> tetap satu 'refund'
--                            dan nominalnya debit aktual (idempoten).
--   I6  order historis tanpa 'spent' lalu dibatalkan -> saldo buyer TIDAK naik.
--   I7  spend_order_coins terhadap order terminal -> ditolak (false) dan
--                            ledger tidak berubah, MESKIPUN saldo buyer
--                            cukup (jadi false bukan berasal dari saldo).
--   I8  status utang durable (SQL saja): tiga kolom ada, nilai
--                            pending/rpc_error dapat ditulis dan tersimpan,
--                            CHECK menolak nilai di luar kontrak, dan
--                            orders.coin_used tidak berubah. Perilaku
--                            TypeScript (klasifikasi debit di coin-debit.ts,
--                            pencatatan utang di order-settlement.ts) TIDAK
--                            diperiksa oleh SQL ini.
--   I9  spend_order_coins menolak p_user_id yang bukan pemilik order
--                            (buyer_id) tanpa menyentuh ledger, dan tetap
--                            idempoten untuk pemanggilan pemilik yang sah.
--                            Saldo U8 (bukan pemilik) SENGAJA cukup, jadi
--                            false hanya dapat berasal dari pemeriksaan
--                            pemilik.
--   I10 coin_used 900 dengan debit 'spent' 300 -> refund = 300 (nominal
--                            LEDGER), bukan 900 (snapshot), dan tetap satu
--                            saat transisi terminal diulang.
--
-- Prasyarat & asumsi:
--   - Sesi berjalan sebagai superuser (session_user 'postgres'). Trigger
--     guard P0-A/P0-B/2D-E mengizinkan service_role lewat
--     request.jwt.claims; claims diset dengan statement-level
--     `SET LOCAL request.jwt.claims` (transaction-scoped) TANPA 'sub' supaya
--     auth.uid() = NULL dan insert activity_logs memakai buyer order
--     (FK profiles tetap valid).
--   - orders.coin_used TIDAK boleh diubah oleh trigger mana pun; di sini
--     nilainya dipasang lewat INSERT (service_role melewati guard insert).
--   - Saldo Coin = SUM(earned + refund) - SUM(spent) (tidak ada kolom saldo).
--
-- Batas bukti (BACA SEBELUM MENYIMPULKAN):
--   - SELURUH I-series di file ini bersifat SEKUENSIAL. Tidak ada satu pun
--     assertion yang menjalankan dua sesi/dua transaksi berbarengan.
--   - Race dua sesi untuk Coin (terminalisasi vs spend_order_coins, dan
--     refund_order_coins vs trigger) BELUM DIUJI. Belum ada harness untuk
--     kasus ini.
--   - scripts/stock-release-race/run-race.mjs HANYA menguji pelepasan STOK
--     (mode tc03/tc04). Harness itu tidak menyentuh tabel coin_transactions
--     maupun RPC coin, sehingga TIDAK dapat dipakai sebagai bukti apa pun
--     untuk P1-C.
--   - Analisis urutan lock (L1 order -> L2 advisory coin -> L3 ledger) pada
--     komentar migrasi adalah ANALISIS STATIS. Ia bukan bukti empiris bahwa
--     deadlock/race tidak mungkin terjadi; itu hanya dapat dibuktikan dengan
--     dua sesi nyata.
--   - Kehadiran unique index coin_tx_once_per_order_type diasumsikan dari
--     migrasi 0003; perilaku insert tanpa index TIDAK diuji di sini.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(42);

-- Kontrak service_role untuk sesi ini (tanpa 'sub' -> auth.uid() NULL).
-- Statement-level SET LOCAL: transaction-scoped (BEGIN..ROLLBACK), sehingga
-- nilainya berlaku untuk seluruh assertion di bawah tanpa blok DO.
SET LOCAL request.jwt.claims = '{"role":"service_role"}';

-- ---------------------------------------------------------------------------
-- Fixture
-- ---------------------------------------------------------------------------
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
  -- U1 / O1: order SUDAH paid, coin_used 500, ADA debit 'spent' 500.
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

  -- U2 / O2: order SUDAH paid, coin_used 500, TIDAK ADA 'spent'.
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

  -- U3 / O3: order SUDAH paid, coin_used 300, ADA 'spent' 300.
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

  -- U4 / O4: order SUDAH paid, coin_used 700, ADA 'spent' 700.
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

  -- U5 / O5: order historis: paid, coin_used 900, TIDAK ADA 'spent'.
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

  -- U6 / O6: order pending/unpaid (belum dibayar) untuk uji debit terminal.
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

  -- T-2: saldo U6 SENGAJA cukup (1000 >= 250 yang diminta I7).
  -- Tanpa saldo, blok cek saldo di spend_order_coins juga mengembalikan
  -- false, sehingga I7 lulus walau pemeriksaan status terminal dihapus.
  -- Dengan saldo cukup, satu-satunya sebab false yang tersisa adalah
  -- status order terminal.
  INSERT INTO public.coin_transactions (user_id, order_code, type, amount, description)
  VALUES (v_u6, NULL, 'earned', 1000, 'Saldo awal uji I7 (order terminal)');

  -- U7 / O7: order MILIK U7 (unpaid/pending, belum terminal) + saldo 1000.
  -- U8: user lain dengan saldo 1000 tetapi BUKAN pemilik order, dipakai
  -- untuk menguji pemeriksaan pemilik (lihat T-1 di bawah).
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
  -- Saldo awal U7 (tanpa order_code: unique index tidak berlaku untuk NULL).
  INSERT INTO public.coin_transactions (user_id, order_code, type, amount, description)
  VALUES (v_u7, NULL, 'earned', 1000, 'Saldo awal uji S-1');

  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES (v_u8, 'p1c-8@example.com', 'x', now(), now());
  -- T-1: saldo U8 SENGAJA cukup (1000 >= 250). Tanpa saldo, blok cek saldo
  -- di spend_order_coins juga mengembalikan false, sehingga I9 lulus walau
  -- pemeriksaan pemilik (buyer_id = p_user_id) dihapus. Dengan saldo cukup,
  -- false hanya dapat berasal dari pemeriksaan pemilik.
  INSERT INTO public.coin_transactions (user_id, order_code, type, amount, description)
  VALUES (v_u8, NULL, 'earned', 1000, 'Saldo awal uji S-1 (bukan pemilik order)');

  -- T-3: U9 / O9 — orders.coin_used = 900, tetapi debit 'spent' = 300.
  -- Ini satu-satunya fixture yang membedakan nominal refund berbasis LEDGER
  -- (300, = debit aktual) dari snapshot orders.coin_used (900). Tanpa
  -- fixture ini, I1/I4/I5 tidak dapat membedakan kedua basis karena pada
  -- order-order itu coin_used selalu sama dengan amount spent.
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

-- Validasi fixture: prasyarat tiap skenario benar-benar terbentuk.
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

-- T-1/T-2: saldo U6 dan U8 WAJIB cukup. Bila salah satunya bersaldo kurang,
-- I7/I9 tidak diskriminatif: 'false' akan muncul dari blok cek saldo di
-- spend_order_coins meskipun pemeriksaan status terminal / kepemilikan
-- dihapus dari fungsi.
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

-- T-3: fixture nominal ledger — coin_used (snapshot) berbeda dari amount
-- 'spent' (fakta debit). Inilah yang membuat I10 dapat membedakan 300 vs 900.
SELECT ok(
  (SELECT count(*) FROM public.orders o
     JOIN public.coin_transactions ct
       ON ct.user_id = o.buyer_id AND ct.order_code = o.order_code AND ct.type = 'spent'
    WHERE o.order_code = 'RB-P1C-9' AND o.coin_used = 900 AND ct.amount = 300) = 1,
  'fixture: RB-P1C-9 coin_used 900 dengan debit spent 300 (nominal ledger != snapshot)'
);

-- ---------------------------------------------------------------------------
-- I1: 'spent' tersedia -> tepat satu 'refund' sebesar debit aktual
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- I2: tidak ada 'spent' -> TIDAK ada refund (anti-mint)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- I3: terminalisasi berulang -> refund tetap satu
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- I4: RPC refund_order_coins lalu terminalisasi -> tetap satu refund
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- I5: terminalisasi lalu RPC refund_order_coins (varian sekuensial) -> satu
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- I6: order historis tanpa 'spent' yang dibatalkan -> saldo tidak naik
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- I7: debit baru terhadap order terminal ditolak
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- I8: status utang durable (kolom baru) + orders.coin_used tidak berubah
-- ---------------------------------------------------------------------------
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

-- Nilai status di luar kontrak harus DITOLAK oleh CHECK constraint.
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

-- ---------------------------------------------------------------------------
-- I9 (S-1): pemilik order harus cocok dengan p_user_id
--
-- U8 bukan pemilik RB-P1C-7 (buyer_id = U7) TETAPI saldonya cukup (1000).
-- Debit harus ditolak SEBELUM menyentuh ledger — dan karena saldo bukan
-- penghalang, penolakan hanya bisa berasal dari pemeriksaan pemilik.
-- Pemanggilan oleh pemilik yang sah tetap berhasil dan tetap idempoten.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- I10 (T-3): nominal refund berasal dari LEDGER, bukan snapshot coin_used
--
-- Fixture RB-P1C-9: coin_used = 900 (snapshot niat/diskon) tetapi debit
-- 'spent' yang benar-benar tercatat = 300. Trigger refund WAJIB memakai
-- 300. Bila trigger kembali memakai NEW.coin_used, assertion nominal akan
-- membaca 900 dan GAGAL — inilah pembeda yang tidak dimiliki I1/I4/I5.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Ringkasan: tidak ada 'refund' tanpa 'spent' di seluruh fixture.
-- ---------------------------------------------------------------------------
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
