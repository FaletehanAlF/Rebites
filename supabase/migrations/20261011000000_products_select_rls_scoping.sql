-- ============================================================================
-- products_select_rls_scoping - tutup kebocoran produk non-approved --
--
-- MASALAH yang ditutup:
--   products_select_public (dibuat di 20260806050337_0001_rebites_schema.sql,
--   tidak pernah diganti sejak itu) memakai:
--
--       CREATE POLICY "products_select_public"
--       ON public.products FOR SELECT
--       TO anon, authenticated USING (true);
--
--   Artinya SETIAP baris produk — termasuk verification_status='pending' dan
--   'rejected' — dapat dibaca siapa pun lewat Supabase REST memakai anon key:
--
--       GET /rest/v1/products?select=*
--
--   termasuk kolom rejection_reason dan reviewed_by (identitas admin yang
--   menolak). Filter verification_status='approved' yang ada di lib/catalog.ts,
--   detail-data.ts, flash-sale.ts, liked-foods.ts, dan product-storage.ts
--   hanyalah filter LAPISAN APLIKASI (client-side query builder), bukan
--   kontrol akses. REST dan Realtime keduanya melewati filter tersebut.
--
--   Auto-approve (20261009000000) tidak menutup kebocoran ini; justru
--   memperluas risikonya karena produk baru tidak lagi tertahan di 'pending'.
--
-- YANG DIUBAH (hanya policy SELECT; tidak ada perubahan data, trigger,
-- kolom, atau auto-approve):
--   1. products_select_public  -> hanya verification_status = 'approved'.
--   2. products_select_admin   -> baru: admin (public.is_admin()) membaca semua.
--   3. products_select_own     -> baru: pemilik toko membaca semua status
--                                 produknya sendiri (Menu Saya, termasuk
--                                 rejected + rejection_reason).
--
-- MATRIKS AKSES HASIL (policy permisif digabung dengan OR; anon hanya
--匹配 policy ber-TO authenticated, jadi tidak ikut):
--
--   role         | approved | pending | rejected | alasan+reviewed_by
--   -------------+----------+---------+----------+-------------------
--   anon         |   YA     |  TIDAK  |  TIDAK   | TIDAK
--   buyer        |   YA     |  TIDAK  |  TIDAK   | TIDAK
--   admin        |   YA     |   YA    |   YA     | YA
--   pemilik toko |   YA     | miliknya | miliknya | miliknya
--
-- KENAPA TIGA POLICY (policy SELECT permisif di-OR):
--   Kalau products_select_public saja yang diperketat, admin dan pemilik toko
--   akan kehilangan akses karena TIDAK ADA policy SELECT lain di tabel ini.
--   Audit penuh (rg "ON public.products FOR SELECT") mengonfirmasi bahwa
--   products_select_public adalah satu-satunya policy SELECT yang pernah ada,
--   sehingga kedua policy baru ini wajib agar admin/penjual tidak rusak.
--
-- CATATAN PENTING SOAL REALTIME:
--   Bila instance Supabase ini menegakkan RLS untuk postgres_changes, maka
--   produk rejected/pending otomatis ikut tertutup di Realtime karena
--   postgres_changes memakai policy SELECT yang sama. Bila tidak, kebocoran
--   tetap sudah tertutup lewat REST. Perilaku Realtime tidak dapat
--   diverifikasi tanpa database aktif — lihat runbook pengujian.
--
-- Keamanan:
--   - Hanya SELECT. INSERT/UPDATE/DELETE (products_insert_own,
--     products_update_own_or_admin, products_delete_own_or_admin) tidak
--     disentuh; proteksi auto-approve tetap utuh.
--   - Ekspresi kepemilikan memakai pola yang PERSIS sama dengan
--     products_insert_own / products_update_own_or_admin / moderation_logs
--     (EXISTS ke umkm_profiles), sehingga tidak menambah pola baru dan tidak
--     menimbulkan recursion RLS.
--   - Admin memakai public.is_admin() yang sudah ada (SECURITY DEFINER +
--     search_path terkunci), bukan EXISTS ke profiles secara langsung —
--     mengikuti pola anti-recursion yang sudah dipakai project di 0018 ->
--     20260928120000.
--   - Idempoten: aman dijalankan berulang (DROP POLICY IF EXISTS + CREATE).
--
-- TIDAK mencakup: auth, subscription, quota, pembayaran, checkout,
-- auto-approve, dan trigger. Tidak ada DELETE/UPDATE data.
-- Jangan dijalankan ke V1/V2 tanpa review dan uji di dev/staging dulu.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Publik: hanya produk approved
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "products_select_public" ON public.products;
CREATE POLICY "products_select_public"
ON public.products FOR SELECT
TO anon, authenticated
USING (products.verification_status = 'approved');

-- ----------------------------------------------------------------------------
-- 2. Admin: seluruh produk (pending & rejected) untuk keperluan moderasi
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "products_select_admin" ON public.products;
CREATE POLICY "products_select_admin"
ON public.products FOR SELECT
TO authenticated
USING (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. Pemilik toko: semua status produk miliknya sendiri
--    (dashboard "Menu Saya" tetap bisa melihat produk rejected + alasannya)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "products_select_own" ON public.products;
CREATE POLICY "products_select_own"
ON public.products FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.umkm_profiles u
    WHERE u.id = products.umkm_id AND u.user_id = auth.uid()
  )
);

-- ----------------------------------------------------------------------------
-- 4. Pengaman: pastikan tidak ada policy SELECT permisif lain yang menyisakan
--    produk non-approved tetap terbaca. Policy di bawah sudah DIHAPUS di
--    migration ini / tidak pernah ada (hasil audit terhadap seluruh repo):
--      - products_select_public versi lama (USING true) -> sudah di-DROP di (1)
--      - products_select_any / products_select_buyer / products_select_all
--        -> tidak pernah ada; DROP defensif agar rerun aman bila suatu saat
--           ditambahkan lewat kanal lain.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "products_select_any" ON public.products;
DROP POLICY IF EXISTS "products_select_all" ON public.products;
DROP POLICY IF EXISTS "products_select_buyer" ON public.products;

COMMENT ON POLICY "products_select_public" ON public.products IS
  'Hanya produk approved yang terlihat publik (anon + authenticated). Ditutup 20261011000000; sebelumnya USING (true) sehingga produk pending/rejected bocor lewat REST.';
COMMENT ON POLICY "products_select_admin" ON public.products IS
  'Admin membaca seluruh produk untuk moderasi, termasuk pending/rejected.';
COMMENT ON POLICY "products_select_own" ON public.products IS
  'Pemilik toko membaca semua status produknya sendiri (Menu Saya), termasuk rejected beserta rejection_reason.';