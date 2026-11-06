-- ============================================================================
-- 0022: Role security fix (Phase 1)
--
-- Menutup dua vektor privilege escalation pada public.profiles
-- (temuan ROLE SECURITY AUDIT):
--
--   VECTOR 1 (CRITICAL) - Signup metadata role injection:
--     handle_new_user() lama menyalin NEW.raw_user_meta_data->>'role'
--     ke profiles.role. Metadata signup dikontrol client, sehingga
--     payload { role: "admin" } menghasilkan profil admin.
--     FIX: role awal SELALU 'buyer', ditentukan server/database.
--     full_name/phone tetap diambil dari metadata (display data,
--     bukan otorisasi).
--
--   VECTOR 2 (HIGH) - Self-update profiles.role via PostgREST:
--     Policy profiles_update_own hanya membatasi BARIS
--     (auth.uid() = id), tidak membatasi KOLOM, dan tidak ada
--     trigger penjaga. User terautentikasi dapat
--     UPDATE profiles SET role='admin' WHERE id = auth.uid().
--     FIX: trigger BEFORE UPDATE mengembalikan NEW.role ke OLD.role
--     bila caller bukan admin. Update full_name/phone/avatar milik
--     sendiri tetap lolos seperti semula (fail-safe revert, bukan error).
--
-- Kompatibilitas masa depan:
--   - Admin (public.is_admin() = true, pola Fase 1) tetap dapat
--     mengubah role via jalur khusus nanti
--     (mis. PATCH /api/admin/users/[id]/role dengan authed client).
--     Migration ini TIDAK membuat endpoint/audit-log/UI tersebut.
--   - service_role (auth.uid() NULL -> bukan admin) yang meng-update
--     profil tanpa menyentuh role (mis. PATCH /api/profile:
--     full_name/phone) tidak terpengaruh (revert = no-op).
--
-- Batasan scope (TIDAK disentuh):
--   - TIDAK ada UPDATE/DELETE data existing (role user saat ini utuh).
--   - TIDAK mengubah migration lama, policy lain, trigger lain,
--     notifications.role, checkout, moderation, auth UI.
--   - getAdminUser() (JWT -> profiles.role) tidak berubah.
--
-- Idempoten: aman dijalankan berulang (OR REPLACE / IF EXISTS /
-- DROP IF EXISTS). CREATE OR REPLACE mempertahankan ACL existing;
-- REVOKE 0002 ditegaskan ulang agar tidak longgar.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. handle_new_user(): role awal selalu 'buyer'
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- PENTING: role TIDAK lagi dibaca dari raw_user_meta_data.
  -- Nilai metadata apa pun ("admin", "umkm", "super_admin", ...) diabaikan.
  INSERT INTO public.profiles (id, email, full_name, role, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'buyer',
    NEW.raw_user_meta_data->>'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Pertahankan pembatasan eksekusi langsung (0002): hanya trigger sistem
-- (dan owner/definisi) yang boleh menjalankan function ini.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- Trigger existing dipertahankan apa adanya (tidak dibuat duplikat).
-- Dipastikan ada bila database pernah di-reset tanpa 0001 secara penuh.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Kunci profiles.role dari self-update (BEFORE UPDATE trigger)
--
-- RLS profiles_update_own tetap (baris milik sendiri); proteksi KOLOM
-- ditangani trigger ini agar user tetap bisa update
-- full_name/phone/avatar tanpa bisa mengubah hasil otorisasi.
-- Pengecekan admin memakai public.is_admin() (SECURITY DEFINER,
-- pola Fase 1) sehingga tidak recursion: SELECT di dalam is_admin()
-- tidak memicu trigger UPDATE ini.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lock_profiles_role_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_lock_role ON public.profiles;
CREATE TRIGGER trg_profiles_lock_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.lock_profiles_role_on_update();
