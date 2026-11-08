




























ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

COMMENT ON COLUMN public.profiles.deleted_at IS
  'NULL = akun aktif. Terisi = akun dihapus (soft delete) oleh Super Admin: tidak dapat login lagi, disembunyikan dari daftar admin, tetapi seluruh datanya tetap ada dan dapat dipulihkan.';
COMMENT ON COLUMN public.profiles.deletion_reason IS
  'Alasan penghapusan yang ditulis Super Admin; ditampilkan di panel admin agar keputusan dapat ditelusuri.';

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON public.profiles(deleted_at)
  WHERE deleted_at IS NOT NULL;


ALTER TABLE public.umkm_profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

COMMENT ON COLUMN public.umkm_profiles.deleted_at IS
  'NULL = toko aktif. Terisi = toko dihapus (soft delete) oleh Super Admin: disembunyikan dari katalog (is_active ikut false), tetap terbaca admin, dan dapat dipulihkan.';

CREATE INDEX IF NOT EXISTS idx_umkm_profiles_deleted_at
  ON public.umkm_profiles(deleted_at)
  WHERE deleted_at IS NOT NULL;







CREATE OR REPLACE FUNCTION public.lock_profiles_deletion_on_update()
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
    NEW.deleted_at := OLD.deleted_at;
    NEW.deleted_by := OLD.deleted_by;
    NEW.deletion_reason := OLD.deletion_reason;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_lock_deletion ON public.profiles;
CREATE TRIGGER trg_profiles_lock_deletion
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.lock_profiles_deletion_on_update();

COMMENT ON FUNCTION public.lock_profiles_deletion_on_update() IS
  'Menghapus/memulihkan akun adalah keputusan admin; UPDATE dari pengguna biasa tidak boleh mengubah deleted_at/deleted_by/deletion_reason.';






CREATE OR REPLACE FUNCTION public.lock_umkm_deletion_on_update()
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
    NEW.deleted_at := OLD.deleted_at;
    NEW.deleted_by := OLD.deleted_by;
    NEW.deletion_reason := OLD.deletion_reason;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_umkm_lock_deletion ON public.umkm_profiles;
CREATE TRIGGER trg_umkm_lock_deletion
  BEFORE UPDATE ON public.umkm_profiles
  FOR EACH ROW EXECUTE FUNCTION public.lock_umkm_deletion_on_update();

COMMENT ON FUNCTION public.lock_umkm_deletion_on_update() IS
  'Menghapus/memulihkan toko adalah keputusan admin; UPDATE dari penjual tidak boleh mengubah deleted_at/deleted_by/deletion_reason.';













CREATE OR REPLACE FUNCTION public.keep_deleted_store_inactive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  
  
  
  
  
  IF NEW.deleted_at IS NOT NULL AND NEW.is_active = true THEN
    NEW.is_active := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_umkm_deleted_store_inactive ON public.umkm_profiles;
CREATE TRIGGER trg_umkm_deleted_store_inactive
  BEFORE UPDATE ON public.umkm_profiles
  FOR EACH ROW EXECUTE FUNCTION public.keep_deleted_store_inactive();

COMMENT ON FUNCTION public.keep_deleted_store_inactive() IS
  'Toko yang ditandai deleted_at tidak dapat diaktifkan kembali lewat jalur lain; hanya pemulihan (deleted_at dikosongkan) yang mengembalikannya ke katalog.';





