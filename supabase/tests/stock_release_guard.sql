-- ============================================================================
-- TES INTEGRASI pgTAP — perilaku trigger guard_orders_update (P0-B) ketika
-- release_stock() mengembalikan false.
--
-- STATUS: TIDAK DIJALANKAN OLEH SISTEM/TES TypeScript. Jalankan manual
-- terhadap DATABASE LOKAL yang sudah menerapkan SEMUA migration (0001 s/d
-- terakhir). Contoh (supabase CLI lokal atau Postgres + pgTAP):
--   psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" \
--     -f supabase/tests/stock_release_guard.sql
-- JANGAN dijalankan pada database produksi (fixture tidak boleh menulis ke
-- database lapisan produksi — file ini hanya untuk dev lokal).
--
-- Yang dibuktikan (perilaku trigger sungguhan, bukan simulasi TypeScript):
--   1. UPDATE batal-normatif dengan release_stock SUKSES → stok +quantity,
--      marker stock_released_at terisi; panggilan kedua release_order_stock
--      idempotent (false) tanpa pelepasan kedua.
--   2. UPDATE ketika slug produk tidak ditemukan (release_stock false) →
--      transisi status TETAP commit (fail-open, tanpa exception), stok TIDAK
--      berubah, marker dibiarkan NULL.
--   3. Setelah slug dipulihkan, release_order_stock() mengembalikan true dan
--      stok dilepas tepat-1x.
--   4. Wrapper jujur: mengembalikan false selama stok belum berhasil dilepas.
--
-- Prasyarat & asumsi:
--   - Sesi berjalan sebagai superuser (session_user 'postgres'): guard
--     memperlakukannya privileged sehingga whitelist kolom dilewati; blok
--     pelepasan stok tetap berjalan untuk semua caller.
--   - guard_orders_insert_client_defaults menimpa kolom stok untuk caller
--     non-admin (auth.jwt() NULL pada sesi psql), jadi stock_reserved_at
--     diklaim lewat UPDATE terpisah privileged setelah insert.
--   - Trigger handle_new_user (0001) otomatis membuat baris profiles dari
--     auth.users, sehingga fixture tidak memasukkan profiles secara eksplisit.
--   - Kolom pada auth.users dapat berbeda antar versi GoTrue; bila insert
--     gagal karena kolom NOT NULL tambahan, sesuaikan fixture di bawah.
--   - Trigger lain (koin P1-A, invoice_state 2D-E, activity log) aman untuk
--     fixture ini karena coin_used = 0 dan idempoten per order_code.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(16);

-- ---------------------------------------------------------------------------
-- Fixture 1: order yang pelepasannya SUKSES.
-- Produk slug 'test-release-ayam', stok 0 (reservasi konseptual = 2).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_umkm uuid;
  v_product uuid;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES (
    v_user,
    'stockrelease-guard-test@example.com',
    'no-password-just-fixture',
    now(), now()
  );

  -- (profiles dibuat otomatis oleh trigger handle_new_user.)

  INSERT INTO public.umkm_profiles (user_id, business_name, city)
  VALUES (v_user, 'UMKM Tes Pelepasan Stok', 'Jakarta')
  RETURNING id INTO v_umkm;

  INSERT INTO public.products (umkm_id, name, slug, surplus_price, stock, status)
  VALUES (v_umkm, 'Ayam Tes', 'test-release-ayam', 10000, 0, 'sold_out')
  RETURNING id INTO v_product;

  INSERT INTO public.orders (
    buyer_id, umkm_id, product_id, quantity, total_price,
    delivery_option, payment_status, order_status, lifecycle_status, progress_status,
    order_code, product_slug, created_at
  ) VALUES (
    v_user, v_umkm, v_product, 2, 20000,
    'pickup', 'unpaid', 'pending', 'ongoing', 'disiapkan',
    'RB-STOCK-RELEASE-TEST-1',
    'test-release-ayam',
    now()
  );

  UPDATE public.orders
     SET stock_reserved_at = created_at
   WHERE order_code = 'RB-STOCK-RELEASE-TEST-1';
END $$;

-- Kasus 1: pelepasan SUKSES → stok +2, marker terisi.
SELECT lives_ok(
  $$UPDATE public.orders SET order_status = 'cancelled'
     WHERE order_code = 'RB-STOCK-RELEASE-TEST-1'$$,
  'transisi terminal tidak melempar exception saat release sukses'
);

SELECT is(
  (SELECT stock FROM public.products WHERE slug = 'test-release-ayam'),
  2::integer,
  'stok dilepas tepat-1x (0 + 2)'
);

SELECT is(
  (SELECT status FROM public.products WHERE slug = 'test-release-ayam'),
  'available',
  'produk sold_out kembali available setelah stok dilepas'
);

SELECT isnt(
  (SELECT stock_released_at FROM public.orders WHERE order_code = 'RB-STOCK-RELEASE-TEST-1'),
  NULL,
  'marker stock_released_at terisi saat pelepasan sukses'
);

SELECT is(
  public.release_order_stock('RB-STOCK-RELEASE-TEST-1'),
  false,
  'release_order_stock panggilan kedua idempotent (false)'
);

SELECT is(
  (SELECT stock FROM public.products WHERE slug = 'test-release-ayam'),
  2::integer,
  'stok TIDAK bertambah lagi pada pelepasan kedua'
);

-- ---------------------------------------------------------------------------
-- Fixture 2: order yang pelepasannya GAGAL (slug produk di-rename).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_umkm uuid;
  v_product uuid;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, created_at, updated_at)
  VALUES (v_user, 'stockrelease-guard-test-2@example.com', 'no-password-just-fixture', now(), now());

  INSERT INTO public.umkm_profiles (user_id, business_name)
  VALUES (v_user, 'UMKM Tes Pelepasan Stok 2')
  RETURNING id INTO v_umkm;

  INSERT INTO public.products (umkm_id, name, slug, surplus_price, stock, status)
  VALUES (v_umkm, 'Bakso Tes', 'test-release-bakso', 10000, 0, 'sold_out')
  RETURNING id INTO v_product;

  INSERT INTO public.orders (
    buyer_id, umkm_id, product_id, quantity, total_price,
    delivery_option, payment_status, order_status, lifecycle_status, progress_status,
    order_code, product_slug, created_at
  ) VALUES (
    v_user, v_umkm, v_product, 2, 20000,
    'pickup', 'unpaid', 'pending', 'ongoing', 'disiapkan',
    'RB-STOCK-RELEASE-TEST-2',
    'test-release-bakso',
    now()
  );

  UPDATE public.orders
     SET stock_reserved_at = created_at
   WHERE order_code = 'RB-STOCK-RELEASE-TEST-2';

  -- Simulasi kegagalan release_stock: rename slug produk →
  -- UPDATE ... WHERE slug = 'test-release-bakso' cocok 0 baris → false,
  -- tanpa menyentuh baris order (products memang tidak dihapus).
  UPDATE public.products SET slug = 'test-release-bakso-renamed' WHERE id = v_product;
END $$;

-- Kasus 2: pelepasan GAGAL → fail-open + retry.
SELECT lives_ok(
  $$UPDATE public.orders
       SET order_status = 'cancelled'
     WHERE order_code = 'RB-STOCK-RELEASE-TEST-2'
       AND payment_status = 'unpaid'$$,
  'kegagalan release_stock TIDAK menggagalkan transisi status (tanpa exception)'
);

SELECT is(
  (SELECT order_status FROM public.orders WHERE order_code = 'RB-STOCK-RELEASE-TEST-2'),
  'cancelled',
  'transisi status tetap commit ketika release_stock gagal (fail-open)'
);

SELECT is(
  (SELECT stock FROM public.products
    WHERE id = (SELECT product_id FROM public.orders WHERE order_code = 'RB-STOCK-RELEASE-TEST-2')),
  0::integer,
  'stok TIDAK berubah ketika release_stock gagal'
);

SELECT is(
  (SELECT stock_released_at FROM public.orders WHERE order_code = 'RB-STOCK-RELEASE-TEST-2'),
  NULL,
  'marker dibiarkan NULL ketika release_stock gagal (agar bisa di-retry)'
);

SELECT is(
  public.release_order_stock('RB-STOCK-RELEASE-TEST-2'),
  false,
  'wrapper release_order_stock jujur mengembalikan false saat stok belum dilepas'
);

-- ---------------------------------------------------------------------------
-- Kasus 3: pemulihan data → retry melepas stok tepat-1x.
-- ---------------------------------------------------------------------------
UPDATE public.products
   SET slug = 'test-release-bakso'
 WHERE id = (SELECT product_id FROM public.orders WHERE order_code = 'RB-STOCK-RELEASE-TEST-2');

SELECT is(
  public.release_order_stock('RB-STOCK-RELEASE-TEST-2'),
  true,
  'retry (wrapper) sukses setelah slug dipulihkan'
);

SELECT is(
  (SELECT stock FROM public.products WHERE slug = 'test-release-bakso'),
  2::integer,
  'stok dilepas tepat-1x pada retry (0 + 2)'
);

SELECT is(
  (SELECT stock_released_at FROM public.orders WHERE order_code = 'RB-STOCK-RELEASE-TEST-2')
  IS NOT NULL,
  true,
  'marker terisi setelah retry sukses'
);

-- Idempotensi akhir: tidak ada pelepasan ketiga.
SELECT is(
  public.release_order_stock('RB-STOCK-RELEASE-TEST-2'),
  false,
  'setelah marker terisi, wrapper kembali mengembalikan false'
);

SELECT is(
  (SELECT stock FROM public.products WHERE slug = 'test-release-bakso'),
  2::integer,
  'stok tetap 2 (tidak dilepas berulang)'
);

SELECT * FROM finish();
ROLLBACK;
