-- ============================================================================
-- Admin dapat menonaktifkan toko UMKM
--
-- MASALAH: tidak ada penanda "toko dinonaktifkan admin". Kolom `is_open` milik
-- penjual (toggle buka/tutup harian), sehingga admin yang memakainya akan
-- ditimpa penjual pada aksi berikutnya, dan tidak ada jejak bahwa keputusan
-- itu berasal dari admin.
--
-- PERUBAHAN: satu kolom penanda `is_active` (default true).
--   - Toko nonaktif disembunyikan dari pembeli lewat RLS SELECT, bukan hanya
--     difilter di aplikasi: produk toko itu ikut tidak terbaca karena katalog
--     menempelkan business_name dari umkm_profiles. Pembeli tidak melihat
--     toko maupun produknya sama sekali.
--   - Admin tetap membaca semua baris: policy admin dibuat terpisah dan
--     memakai public.is_admin(), TIDAK bergantung pada is_active.
--   - Penjual TIDAK bisa mengaktifkan kembali tokonya: trigger BEFORE UPDATE
--     mengembalikan is_active ke nilai lama untuk non-admin. Nama trigger
--     `trg_umkm_` mengurut sebelum `trg_umkm_profiles_*` sehingga nilai admin
--     (yang lolos guard) ditulis lebih dulu.
--   - Checkout dan halaman detail produk memeriksa ulang di server; RLS saja
--     tidak cukup karena service_role melewati RLS.
--
-- Data existing: tidak ada backfill. Semua baris lama mendapat DEFAULT true,
-- artinya seluruh toko tetap tampil seperti sekarang.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + DROP POLICY IF EXISTS + CREATE POLICY.
-- ============================================================================

ALTER TABLE public.umkm_profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.umkm_profiles.is_active IS
  'false = toko dinonaktifkan admin: tidak tampil di katalog publik dan tidak bisa dibeli. Hanya admin yang boleh mengubah (lihat trg_umkm_lock_is_active).';

CREATE INDEX IF NOT EXISTS idx_umkm_profiles_is_active
  ON public.umkm_profiles(is_active);

-- ----------------------------------------------------------------------------
-- 1. Policy SELECT publik: hanya toko aktif
--    (policy lama tetap bernama sama; definisi admin yang lama diturunkan
--     menjadi policy terpisah di bawah agar admin tidak ikut terblokir)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "umkm_select_public" ON public.umkm_profiles;
CREATE POLICY "umkm_select_public"
ON public.umkm_profiles FOR SELECT
TO anon, authenticated
USING (umkm_profiles.is_active);

-- Policy admin: dibuat HANYA bila belum ada, supaya policy admin yang lebih
-- lengkap (bila dibuat di masa depan) tidak tertimpa migrasi ini.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'umkm_profiles'
       AND policyname = 'umkm_select_admin'
  ) THEN
    CREATE POLICY "umkm_select_admin"
    ON public.umkm_profiles FOR SELECT
    TO authenticated
    USING (public.is_admin());
  END IF;
END $$;

COMMENT ON POLICY "umkm_select_public" ON public.umkm_profiles IS
  'Toko aktif terlihat publik; toko yang dinonaktifkan admin hanya terlihat oleh admin dan pemiliknya.';
COMMENT ON POLICY "umkm_select_admin" ON public.umkm_profiles IS
  'Admin membaca seluruh profil UMKM, termasuk yang dinonaktifkan.';

-- ----------------------------------------------------------------------------
-- 3. Pemilik tetap membaca tokonya sendiri, termasuk saat nonaktif
--
-- WAJIB ADA. Tanpa policy ini, `umkm_select_public` yang kini mensyaratkan
-- is_active membuat penjual kehilangan akses ke barisnya sendiri begitu admin
-- menonaktifkan toko: `getSellerUmkm()` mengembalikan null dan SELURUH
-- dashboard penjual rusak senyap, bukan menampilkan pesan "toko dinonaktifkan".
-- Penjual hanya boleh MEMBACA; mengubah is_active tetap diblokir trigger di
-- bawah, dan akses publik tetap ditentukan umkm_select_public.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "umkm_select_own" ON public.umkm_profiles;
CREATE POLICY "umkm_select_own"
ON public.umkm_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

COMMENT ON POLICY "umkm_select_own" ON public.umkm_profiles IS
  'Pemilik membaca profil tokonya sendiri apa pun status is_active-nya, agar dashboard penjual dapat menjelaskan penonaktifan alih-alih gagal memuat.';

-- ----------------------------------------------------------------------------
-- 2. Penjual tidak boleh membatalkan penonaktifan
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lock_umkm_is_active_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Jalur tepercaya: server aplikasi (service_role) melewati RLS dan boleh
  -- menulis status toko, sama seperti guard is_verified/rating di 20261007000000.
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  -- Selain itu hanya admin yang boleh mengubah is_active. Penjual tetap dapat
  -- mengubah kolom lain miliknya: is_open, jam buka, deskripsi, dan alamat.
  IF NOT public.is_admin() THEN
    NEW.is_active := OLD.is_active;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_umkm_lock_is_active ON public.umkm_profiles;
CREATE TRIGGER trg_umkm_lock_is_active
  BEFORE UPDATE ON public.umkm_profiles
  FOR EACH ROW EXECUTE FUNCTION public.lock_umkm_is_active_on_update();

COMMENT ON FUNCTION public.lock_umkm_is_active_on_update() IS
  'Menonaktifkan toko adalah keputusan admin; UPDATE dari penjual atas umkm_profiles tidak boleh mengubah is_active.';
