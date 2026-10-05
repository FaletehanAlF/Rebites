-- ============================================================================
-- 0025: Admin Monitoring foundation (Database saja, tanpa UI)
--
-- Tabel baru:
--   - public.activity_logs     : aktivitas penting user/penjual (append-only)
--   - public.reports           : laporan terhadap user/penjual
--   - public.warnings          : peringatan admin level 1-3
--   - public.sanctions         : tindakan admin (suspend / ban / delete)
--   - public.admin_audit_logs  : jejak tindakan admin (append-only)
-- Kolom baru:
--   - public.profiles.account_status ('active' | 'suspended' | 'banned',
--     default 'active')
--
-- Batasan scope yang SENGAJA tidak disentuh:
--   - TIDAK ada approval produk / verifikasi foto / AI moderation.
--     Produk tetap langsung aktif setelah penjual menambahkannya.
--   - TIDAK mengubah flow checkout, Biteship, payment, auth login,
--     marketplace, subscriptions, atau UMKM.
--   - TIDAK mengubah profiles.role dan TIDAK mengubah status seller/UMKM
--     berdasarkan profiles.role. Kepemilikan toko tetap via umkm_profiles.
--   - TIDAK ada trigger otomatis warning -> sanction dan TIDAK ada
--     penghapusan akun otomatis. Warning ketiga hanya membuat user memenuhi
--     kondisi untuk DIPERTIMBANGKAN mendapat sanction; keputusan sanction
--     tetap manual oleh admin.
--   - RLS existing untuk products, orders, subscriptions, umkm_profiles,
--     dan tabel lain TIDAK diubah. Satu-satunya policy tambahan pada tabel
--     lama adalah "profiles_update_admin" (diperlukan agar admin dapat
--     mengubah account_status via authed client, pola yang sama seperti
--     PATCH /api/admin/users/[id]/role).
--
-- Foreign key & ON DELETE:
--   - Semua FK ke public.profiles memakai ON DELETE SET NULL dengan kolom
--     nullable, dan FK antar tabel audit (reports.activity_id,
--     warnings.report_id, sanctions.warning_id) juga ON DELETE SET NULL.
--   - Alasan: riwayat audit/history tidak boleh hilang bila sebuah akun
--     dihapus (sanction_type 'delete' harus tetap bisa dieksekusi tanpa
--     pelanggaran FK), dan TIDAK ada CASCADE ke tabel audit/history.
--   - Konsekuensi yang didokumentasikan: kolom user FK bersifat nullable;
--     nilai NULL berarti "akun asal sudah dihapus, baris riwayat
--     dipertahankan". Kolom yang menurut spesifikasi selalu terisi saat
--     dibuat (reported_user_id, reported_by, warnings.user_id,
--     warnings.report_id, sanctions.user_id, issued_by/admin_id) tetap
--     diwajibkan di level aplikasi/policy (WITH CHECK) dan/atau trigger,
--     bukan via NOT NULL database, agar penghapusan akun tidak terblokir.
--
-- Pengecekan admin memakai public.is_admin() (SECURITY DEFINER, pola Fase 1)
-- agar tidak recursion.
--
-- Urutan bagian PENTING: backfill profiles.account_status (Bagian 1)
-- dijalankan SEBELUM trigger pengunci account_status dibuat (Bagian 7),
-- karena trigger tersebut mengembalikan perubahan non-admin (konteks owner
-- migrasi memiliki auth.uid() NULL sehingga dianggap non-admin).
--
-- Idempoten: aman dijalankan berulang (IF NOT EXISTS / DROP IF EXISTS /
-- CREATE OR REPLACE / DO block untuk constraint).
--
-- Revisi M4 (tanpa migration baru karena file ini BELUM di-push ke remote):
--   Bagian 8 menambahkan trigger trg_reports_resolution_attribution yang
--   mengikat reports.resolved_by ke admin pelaksana (auth.uid()) setiap
--   report berubah menjadi resolved/dismissed, dan mempertahankan atribusi
--   awal pada edit berikutnya. Dipilih BEFORE UPDATE trigger (bukan RLS
--   WITH CHECK) karena WITH CHECK tidak dapat melihat OLD sehingga tidak
--   bisa membedakan "resolusi baru" (wajib = caller) dari "edit pada report
--   yang sudah resolved" (wajib = resolver awal) tanpa memblokir edit sah
--   oleh admin lain.
--
-- Revisi M2 (tanpa migration baru karena file ini BELUM di-push ke remote):
--   Bagian 9 menambahkan audit otomatis via trigger AFTER (bukan mengandalkan
--   API): resolusi/dismiss report, INSERT warning, INSERT sanction, dan
--   perubahan profiles.account_status selalu menulis baris admin_audit_logs
--   dengan admin_id = auth.uid() (NULL = service_role/system). Dipilih
--   trigger AFTER agar tercatat apa yang benar-benar terjadi (setelah
--   trigger BEFORE fail-safe Phase 3/7 berjalan), dan agar tidak bisa
--   dilewati hanya karena developer lupa logging di API.
--   Konsekuensi struktur yang benar-benar diperlukan: kolom
--   admin_audit_logs.reason menjadi nullable (auto-audit resolve/status
--   tidak memiliki reason manusia; NULL lebih jujur daripada teks
--   karangan), diimbangi CHECK admin_audit_logs_reason_or_auto_check yang
--   mewajibkan reason terisi kecuali baris bertanda metadata 'auto'.
--   Tidak ada trigger pada admin_audit_logs itu sendiri (tanpa loop),
--   tidak ada UPDATE/DELETE audit lama, RLS audit tidak diubah.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. profiles.account_status
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';

-- Backfill defensif: normalisasi baris yang masih NULL (mis. kolom pernah
-- dibuat manual tanpa default sebelum migration ini).
UPDATE public.profiles
SET account_status = 'active'
WHERE account_status IS NULL;

-- CHECK hanya active/suspended/banned (ADD CONSTRAINT tidak punya
-- IF NOT EXISTS sehingga dibungkus DO block).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'profiles_account_status_check'
      AND n.nspname = 'public'
      AND t.relname = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_status_check
      CHECK (account_status IN ('active', 'suspended', 'banned'));
  END IF;
END
$$;

-- Konvergensi NOT NULL bila kolom pre-existing masih nullable.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'profiles'
      AND a.attname = 'account_status'
      AND NOT a.attnotnull
  ) THEN
    ALTER TABLE public.profiles
      ALTER COLUMN account_status SET NOT NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_profiles_account_status
  ON public.profiles(account_status);

-- ---------------------------------------------------------------------------
-- 2. activity_logs (append-oriented: tanpa policy UPDATE/DELETE)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  activity_type text NOT NULL CHECK (activity_type IN (
    'login',
    'register',
    'product_created',
    'product_updated',
    'product_deleted',
    'order_created',
    'order_cancelled',
    'store_updated',
    'subscription_changed',
    'report_received',
    'warning_received'
  )),
  description text NOT NULL,
  target_type text,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id
  ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_activity_type
  ON public.activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON public.activity_logs(created_at DESC);

-- Append-only: grant tanpa UPDATE/DELETE. Tidak ada policy UPDATE/DELETE,
-- sehingga log tidak dapat diubah/dihapus via API oleh siapa pun
-- (service_role bypass RLS untuk penulisan server bila diperlukan).
GRANT SELECT, INSERT
  ON public.activity_logs TO authenticated, service_role;

-- Baca: admin semua; user hanya miliknya sendiri (TANPA select global).
DROP POLICY IF EXISTS "activity_logs_select_own_or_admin" ON public.activity_logs;
CREATE POLICY "activity_logs_select_own_or_admin"
ON public.activity_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

-- Tulis: user hanya atas nama sendiri; admin bebas (mis. mencatat
-- report_received / warning_received untuk user lain).
DROP POLICY IF EXISTS "activity_logs_insert_own_or_admin" ON public.activity_logs;
CREATE POLICY "activity_logs_insert_own_or_admin"
ON public.activity_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  activity_id uuid REFERENCES public.activity_logs(id) ON DELETE SET NULL,
  category text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_reports_reported_user_id
  ON public.reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_by
  ON public.reports(reported_by);
CREATE INDEX IF NOT EXISTS idx_reports_status
  ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_activity_id
  ON public.reports(activity_id);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.reports TO authenticated, service_role;

-- Baca: admin semua; user hanya laporan yang melibatkannya (sebagai pelapor
-- atau terlapor). TANPA select global untuk user biasa.
DROP POLICY IF EXISTS "reports_select_involved_or_admin" ON public.reports;
CREATE POLICY "reports_select_involved_or_admin"
ON public.reports FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR auth.uid() = reported_by
  OR auth.uid() = reported_user_id
);

-- Buat: user hanya atas nama sendiri (reported_by = dirinya); admin bebas.
DROP POLICY IF EXISTS "reports_insert_own_or_admin" ON public.reports;
CREATE POLICY "reports_insert_own_or_admin"
ON public.reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reported_by OR public.is_admin());

-- Kelola (ubah/hapus): admin saja. User tidak dapat mengubah report,
-- termasuk miliknya sendiri, demi integritas status workflow
-- (dapat dilonggarkan nanti bila dibutuhkan).
DROP POLICY IF EXISTS "reports_update_admin" ON public.reports;
CREATE POLICY "reports_update_admin"
ON public.reports FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- DELETE DINONAKTIFKAN (hardening M1): reports adalah moderation evidence
-- dan TIDAK BOLEH di-hard-delete oleh siapa pun, termasuk admin. DROP
-- dipertahankan agar rerun migration tidak meninggalkan policy DELETE aktif;
-- tidak ada CREATE POLICY FOR DELETE. Tanpa policy DELETE + RLS aktif,
-- DELETE ditolak untuk semua peran via API (service_role tetap bypass RLS
-- sesuai desain Supabase untuk operasi server darurat).

-- Fail-safe untuk INSERT (pola yang sama seperti verifikasi produk):
-- reported_by dipaksa = caller untuk non-admin, dan — penutup F1 —
-- status/resolusi dipaksa open/NULL untuk SEMUA caller non-service_role
-- (termasuk admin): report baru tidak boleh lahir resolved/dismissed,
-- sehingga penyelesaian hanya bisa via UPDATE yang selalu melewati
-- atribusi Phase 3 + audit M2. service_role dikecualikan agar penulisan
-- server-side tetap fleksibel.
CREATE OR REPLACE FUNCTION public.enforce_report_insert_defaults()
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
    NEW.reported_by := auth.uid();
  END IF;
  NEW.status := 'open';
  NEW.resolved_by := NULL;
  NEW.resolved_at := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reports_insert_defaults ON public.reports;
CREATE TRIGGER trg_reports_insert_defaults
  BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_report_insert_defaults();

-- ---------------------------------------------------------------------------
-- 4. warnings (level hanya 1, 2, 3 via CHECK; tulis hanya admin)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  issued_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  warning_level smallint NOT NULL CHECK (warning_level IN (1, 2, 3)),
  category text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.warnings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_warnings_user_id
  ON public.warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_warnings_report_id
  ON public.warnings(report_id);
CREATE INDEX IF NOT EXISTS idx_warnings_warning_level
  ON public.warnings(warning_level);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.warnings TO authenticated, service_role;

-- Baca: admin semua; user hanya miliknya sendiri.
DROP POLICY IF EXISTS "warnings_select_own_or_admin" ON public.warnings;
CREATE POLICY "warnings_select_own_or_admin"
ON public.warnings FOR SELECT
TO authenticated
USING (public.is_admin() OR auth.uid() = user_id);

-- Tulis (insert/update/delete): admin saja. issued_by wajib = admin caller
-- agar penerbit tidak dapat dipalsukan.
DROP POLICY IF EXISTS "warnings_insert_admin" ON public.warnings;
CREATE POLICY "warnings_insert_admin"
ON public.warnings FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() AND issued_by = auth.uid());

DROP POLICY IF EXISTS "warnings_update_admin" ON public.warnings;
CREATE POLICY "warnings_update_admin"
ON public.warnings FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- DELETE DINONAKTIFKAN (hardening M1): warnings adalah immutable moderation
-- history setelah dibuat. DROP dipertahankan agar rerun tidak meninggalkan
-- policy DELETE aktif; tidak ada CREATE POLICY FOR DELETE.

-- ---------------------------------------------------------------------------
-- 5. sanctions (suspend / ban / delete; tulis hanya admin)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sanctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  warning_id uuid REFERENCES public.warnings(id) ON DELETE SET NULL,
  issued_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sanction_type text NOT NULL CHECK (sanction_type IN ('suspend', 'ban', 'delete')),
  reason text NOT NULL,
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at IS NULL OR end_at > start_at)
);

ALTER TABLE public.sanctions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sanctions_user_id
  ON public.sanctions(user_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_warning_id
  ON public.sanctions(warning_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_sanction_type
  ON public.sanctions(sanction_type);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.sanctions TO authenticated, service_role;

-- Baca: admin semua; user hanya miliknya sendiri.
DROP POLICY IF EXISTS "sanctions_select_own_or_admin" ON public.sanctions;
CREATE POLICY "sanctions_select_own_or_admin"
ON public.sanctions FOR SELECT
TO authenticated
USING (public.is_admin() OR auth.uid() = user_id);

-- Tulis (insert/update/delete): admin saja. issued_by wajib = admin caller.
-- end_at NULL berarti permanen (ban/delete) atau sampai dicabut manual.
DROP POLICY IF EXISTS "sanctions_insert_admin" ON public.sanctions;
CREATE POLICY "sanctions_insert_admin"
ON public.sanctions FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() AND issued_by = auth.uid());

DROP POLICY IF EXISTS "sanctions_update_admin" ON public.sanctions;
CREATE POLICY "sanctions_update_admin"
ON public.sanctions FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- DELETE DINONAKTIFKAN (hardening M1): sanctions adalah immutable moderation
-- history setelah dibuat. DROP dipertahankan agar rerun tidak meninggalkan
-- policy DELETE aktif; tidak ada CREATE POLICY FOR DELETE.

-- ---------------------------------------------------------------------------
-- 6. admin_audit_logs (append-oriented: baca/tulis hanya admin,
--    tanpa policy UPDATE/DELETE)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id
  ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target
  ON public.admin_audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs(created_at DESC);

-- Append-only bahkan untuk admin: grant tanpa UPDATE/DELETE.
GRANT SELECT, INSERT
  ON public.admin_audit_logs TO authenticated, service_role;

DROP POLICY IF EXISTS "admin_audit_logs_select_admin" ON public.admin_audit_logs;
CREATE POLICY "admin_audit_logs_select_admin"
ON public.admin_audit_logs FOR SELECT
TO authenticated
USING (public.is_admin());

-- admin_id wajib = admin caller agar pencatatan tidak mengatasnamakan
-- admin lain.
DROP POLICY IF EXISTS "admin_audit_logs_insert_admin" ON public.admin_audit_logs;
CREATE POLICY "admin_audit_logs_insert_admin"
ON public.admin_audit_logs FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() AND admin_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 7. profiles: izinkan admin update + kunci account_status dari non-admin
--
-- Kebijakan existing (profiles_update_own) hanya mengizinkan update baris
-- milik sendiri, sehingga admin tidak dapat mengubah account_status user
-- lain via authed client. Policy tambahan ini bersifat aditif (policy lama
-- tidak diubah) dan mengikuti pola authed admin client yang dipakai
-- PATCH /api/admin/users/[id]/role.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Proteksi kolom (melengkapi trigger lock_profiles_role_on_update yang ada
-- dan TIDAK diubah): kembalikan NEW.account_status ke OLD bila caller
-- bukan admin, sehingga user tetap bisa update full_name/phone/avatar
-- miliknya sendiri tanpa bisa mengubah status akunnya. service_role
-- dikecualikan (pola guard_order_payment_status) agar penulisan
-- server-side (mis. penegakan sanction) tetap dapat berjalan.
CREATE OR REPLACE FUNCTION public.lock_profiles_account_status_on_update()
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
    NEW.account_status := OLD.account_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_lock_account_status ON public.profiles;
CREATE TRIGGER trg_profiles_lock_account_status
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.lock_profiles_account_status_on_update();

-- ---------------------------------------------------------------------------
-- 8. reports: ikat resolved_by ke admin pelaksana (perbaikan M4)
--
-- Masalah: policy reports_update_admin hanya memastikan caller adalah
-- admin, sehingga admin A secara teori dapat mengisi resolved_by dengan
-- ID admin B.
--
-- Perbaikan: BEFORE UPDATE trigger fail-safe (pola yang sama seperti
-- Bagian 3 dan 7):
--   - transisi baru menuju resolved/dismissed -> resolved_by dipaksa
--     menjadi auth.uid() admin pelaksana (payload resolved_by dari
--     client diabaikan/ditimpa, bukan error);
--   - edit pada report yang SUDAH resolved/dismissed tanpa mengubah
--     status -> resolved_by dikembalikan ke OLD (atribusi resolver awal
--     dipertahankan, tidak bisa dialihkan ke admin lain);
--   - service_role dikecualikan agar penulisan server-side yang menyetel
--     atribusi secara eksplisit tetap fleksibel.
-- RLS WITH CHECK tidak dipakai untuk ini karena tidak dapat melihat OLD.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_report_resolution_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('resolved', 'dismissed') THEN
    IF OLD.status IN ('resolved', 'dismissed') THEN
      NEW.resolved_by := OLD.resolved_by;
    ELSE
      NEW.resolved_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reports_resolution_attribution ON public.reports;
CREATE TRIGGER trg_reports_resolution_attribution
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_report_resolution_attribution();

-- ---------------------------------------------------------------------------
-- 9. Audit otomatis tindakan admin (perbaikan M2)
--
-- Prinsip:
--   - Audit ditulis di DATABASE via trigger AFTER, sehingga tidak bergantung
--     pada kedisiplinan logging di API layer yang belum ada.
--   - Fungsi trigger SECURITY DEFINER (pola file ini): INSERT audit
--     melewati RLS karena dieksekusi sebagai owner, sedangkan INSERT manual
--     via client tetap tunduk pada policy admin_audit_logs_insert_admin
--     (admin saja, admin_id = auth.uid()) yang TIDAK diubah.
--   - service_role TIDAK dikecualikan dari pencatatan (berbeda dengan
--     trigger permission): aksi server-side tetap tercatat dengan
--     admin_id NULL (= system). Ini pencatatan, bukan pembatasan.
--   - Tanpa loop: tidak ada trigger apa pun pada admin_audit_logs, dan
--     fungsi di bawah hanya melakukan INSERT (tidak pernah UPDATE/DELETE
--     baris audit lama).
--   - Tanpa duplikat: setiap pemicu dibatasi transisi/kejadian tunggal
--     (lihat masing-masing trigger), dan setiap baris auto-audit membawa
--     metadata 'auto' agar API layer nanti TIDAK menulis audit manual
--     ganda untuk keempat aksi yang sudah tercakup di sini.
-- ---------------------------------------------------------------------------

-- 9a. reason menjadi nullable: auto-audit resolve/dismiss dan perubahan
-- account_status tidak memiliki reason manusia (NULL = jujur). Baris manual
-- tetap diwajibkan punya reason via CHECK kompensasi di bawah.
ALTER TABLE public.admin_audit_logs ALTER COLUMN reason DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'admin_audit_logs_reason_or_auto_check'
      AND n.nspname = 'public'
      AND t.relname = 'admin_audit_logs'
  ) THEN
    ALTER TABLE public.admin_audit_logs
      ADD CONSTRAINT admin_audit_logs_reason_or_auto_check
      CHECK (reason IS NOT NULL OR (metadata ? 'auto'));
  END IF;
END
$$;

-- 9b. Resolusi/dismiss report -> resolve_report / dismiss_report.
-- Hanya pada TRANSISI baru menuju resolved/dismissed (edit biasa atau
-- update ulang pada report yang sudah resolved tidak dicatat ulang).
-- Berjalan AFTER sehingga melihat baris final setelah trigger atribusi
-- Phase 3 (trg_reports_resolution_attribution).
CREATE OR REPLACE FUNCTION public.audit_report_resolution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IN ('resolved', 'dismissed')
     OR NEW.status NOT IN ('resolved', 'dismissed') THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.admin_audit_logs
    (admin_id, action, target_type, target_id, reason, metadata)
  VALUES (
    auth.uid(),
    CASE NEW.status WHEN 'resolved' THEN 'resolve_report' ELSE 'dismiss_report' END,
    'report',
    NEW.id,
    NULL,
    jsonb_build_object(
      'auto', true,
      'from_status', OLD.status,
      'to_status', NEW.status,
      'reported_user_id', NEW.reported_user_id,
      'category', NEW.category
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_report_resolution ON public.reports;
CREATE TRIGGER trg_audit_report_resolution
  AFTER UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.audit_report_resolution();

-- 9c. INSERT warning -> issue_warning (tepat satu audit per warning,
-- karena hanya AFTER INSERT; UPDATE/DELETE warning tidak diaudit otomatis).
CREATE OR REPLACE FUNCTION public.audit_warning_issued()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_logs
    (admin_id, action, target_type, target_id, reason, metadata)
  VALUES (
    auth.uid(),
    'issue_warning',
    'user',
    NEW.user_id,
    NEW.reason,
    jsonb_build_object(
      'auto', true,
      'warning_level', NEW.warning_level,
      'report_id', NEW.report_id,
      'issued_by', NEW.issued_by
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_warning_issued ON public.warnings;
CREATE TRIGGER trg_audit_warning_issued
  AFTER INSERT ON public.warnings
  FOR EACH ROW EXECUTE FUNCTION public.audit_warning_issued();

-- 9d. INSERT sanction -> issue_sanction (tepat satu audit per sanction;
-- sanction TANPA warning tetap tercatat karena warning_id boleh NULL).
CREATE OR REPLACE FUNCTION public.audit_sanction_issued()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_logs
    (admin_id, action, target_type, target_id, reason, metadata)
  VALUES (
    auth.uid(),
    'issue_sanction',
    'user',
    NEW.user_id,
    NEW.reason,
    jsonb_build_object(
      'auto', true,
      'sanction_type', NEW.sanction_type,
      'warning_id', NEW.warning_id,
      'start_at', NEW.start_at,
      'end_at', NEW.end_at,
      'issued_by', NEW.issued_by
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_sanction_issued ON public.sanctions;
CREATE TRIGGER trg_audit_sanction_issued
  AFTER INSERT ON public.sanctions
  FOR EACH ROW EXECUTE FUNCTION public.audit_sanction_issued();

-- 9e. Perubahan account_status -> suspend_user / ban_user / activate_user.
-- AFTER UPDATE sehingga melihat nilai FINAL setelah trigger pengunci
-- Bagian 7: perubahan non-admin sudah dikembalikan -> OLD = NEW ->
-- tidak tercatat. Perubahan kolom profile lain (nama, avatar, ...) tidak
-- menyentuh account_status -> tidak tercatat (bukan sanction).
CREATE OR REPLACE FUNCTION public.audit_account_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.account_status IS NOT DISTINCT FROM NEW.account_status THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.admin_audit_logs
    (admin_id, action, target_type, target_id, reason, metadata)
  VALUES (
    auth.uid(),
    CASE NEW.account_status
      WHEN 'suspended' THEN 'suspend_user'
      WHEN 'banned' THEN 'ban_user'
      ELSE 'activate_user'
    END,
    'user',
    NEW.id,
    NULL,
    jsonb_build_object(
      'auto', true,
      'old_status', OLD.account_status,
      'new_status', NEW.account_status
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_account_status_change ON public.profiles;
CREATE TRIGGER trg_audit_account_status_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_account_status_change();
