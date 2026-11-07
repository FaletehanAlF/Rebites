



























ALTER TABLE public.umkm_profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.umkm_profiles.is_active IS
  'false = toko dinonaktifkan admin: tidak tampil di katalog publik dan tidak bisa dibeli. Hanya admin yang boleh mengubah (lihat trg_umkm_lock_is_active).';

CREATE INDEX IF NOT EXISTS idx_umkm_profiles_is_active
  ON public.umkm_profiles(is_active);






DROP POLICY IF EXISTS "umkm_select_public" ON public.umkm_profiles;
CREATE POLICY "umkm_select_public"
ON public.umkm_profiles FOR SELECT
TO anon, authenticated
USING (umkm_profiles.is_active);



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











DROP POLICY IF EXISTS "umkm_select_own" ON public.umkm_profiles;
CREATE POLICY "umkm_select_own"
ON public.umkm_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

COMMENT ON POLICY "umkm_select_own" ON public.umkm_profiles IS
  'Pemilik membaca profil tokonya sendiri apa pun status is_active-nya, agar dashboard penjual dapat menjelaskan penonaktifan alih-alih gagal memuat.';




CREATE OR REPLACE FUNCTION public.lock_umkm_is_active_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  
  
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  
  
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
