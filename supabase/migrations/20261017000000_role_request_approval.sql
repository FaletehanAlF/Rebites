-- ============================================================================
-- 20261017000000: Permintaan perubahan role + persetujuan Super Admin
--
-- Konteks (Tahap 2 "Super Admin Approval System", disetujui owner):
--   - Admin tim (profiles.role='admin' TANPA SUPER_ADMIN_USER_ID) TIDAK
--     boleh mengubah role pengguna secara langsung. Mereka MENGAJUKAN
--     permintaan yang harus disetujui/ditolak Super Admin.
--   - Hanya Super Admin (user terverifikasi server yang id-nya sama dengan
--     env SUPER_ADMIN_USER_ID di aplikasi Next) yang boleh memutuskan.
--     Identitas Super Admin TIDAK diketahui database (env server-only),
--     sehingga penegakan "super admin only" berada di route server
--     (getAdminActor + lib/admin-access.ts). Database menegakkan yang TIDAK
--     bisa ditegakkan aplikasi:
--       * status permintaan tidak dapat diubah siapa pun via PostgREST
--         (tanpa policy/GRANT UPDATE untuk authenticated);
--       * keputusan + perubahan role + audit terjadi dalam SATU transaksi
--         (klaim atomik status='pending' -> exactly-once);
--       * perubahan profiles.role hanya sah dari konteks service_role
--         (trigger lock_profiles_role_on_update di-hardening), sehingga
--         admin tim tidak dapat melewati API/PostgREST langsung.
--
-- Bagian:
--   1. Tabel public.role_change_requests (+ index unik pending per target).
--   2. RLS + grant (SELECT/INSERT admin; TANPA UPDATE/DELETE authenticated).
--   3. RPC decide_role_change_request()  -- setujui/tolak (khusus service_role).
--   4. RPC apply_role_change()           -- perubahan langsung Super Admin (khusus service_role).
--   5. Hardening trigger lock_profiles_role_on_update (service_role-only).
--
-- Keamanan:
--   - SECURITY DEFINER + SET search_path = public (pola RPC P0/P1 repo ini).
--   - REVOKE EXECUTE dari PUBLIC, anon, authenticated -> hanya service_role.
--     Service key HANYA ada di server Next (lib/server/supabase.ts); admin
--     tim dengan JWT miliknya TIDAK dapat memanggil RPC lewat PostgREST.
--   - Pelaku (p_request_id/p_actor_id) divalidasi di route server sebelum
--     RPC dipanggil; RPC menolak pelaku = pemohon (double guard + CHECK
--     decided_by <> requested_by).
--   - Tanpa policy UPDATE: menandai approved/rejected hanya mungkin lewat
--     RPC SECURITY DEFINER (owner), bukan lewat PostgREST authenticated.
--   - RPC memverifikasi hasil UPDATE profiles.role; bila trigger proteksi
--     mengembalikan role (konteks bukan service_role), seluruh transaksi
--     di-ROLLBACK via RAISE EXCEPTION (tidak pernah "approved" tanpa efek).
--
-- Idempoten: CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF
--   EXISTS / CREATE INDEX IF NOT EXISTS / DROP TRIGGER IF EXISTS.
--
-- Rollback manual (bila diperlukan, dijalankan owner):
--   DROP FUNCTION IF EXISTS public.decide_role_change_request(uuid, uuid, text, text);
--   DROP FUNCTION IF EXISTS public.apply_role_change(uuid, text, uuid);
--   -- kembalikan body trigger versi 20260930120005 lalu:
--   DROP TRIGGER IF EXISTS trg_profiles_lock_role ON public.profiles;
--   CREATE TRIGGER trg_profiles_lock_role
--     BEFORE UPDATE ON public.profiles
--     FOR EACH ROW EXECUTE FUNCTION public.lock_profiles_role_on_update();
--   DROP TABLE IF EXISTS public.role_change_requests;
--
-- PRASYARAT (dibaca dari repo; diverifikasi ulang sebelum apply):
--   - 20260928120000_admin_rls_foundation.sql (public.is_admin()).
--   - 20260930120005_role_security_fix.sql (trigger lock role existing).
--   - 20260930120006_role_change_audit_log.sql (role_change_logs).
--   - 20261001000000_admin_monitoring_foundation.sql (admin_audit_logs +
--     CHECK admin_audit_logs_reason_or_auto_check).
--
-- JANGAN dijalankan otomatis oleh agent. File ini disiapkan untuk ditinjau
-- dan dijalankan MANUAL oleh owner di Supabase V1. JANGAN ke V2.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabel permintaan perubahan role
-- ---------------------------------------------------------------------------
-- NOTE: "current_role" WAJIB dikutip. Nama itu adalah fungsi sistem
-- PostgreSQL (reserved keyword) sehingga CREATE TABLE gagal dengan
-- `syntax error at or near "current_role"` bila ditulis tanpa kutip.
-- PostgREST/supabase-js mengutip identifier secara otomatis, jadi kode
-- aplikasi (route.ts) tetap memakai nama tanpa kutip tanpa perubahan.
CREATE TABLE IF NOT EXISTS public.role_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  "current_role" text NOT NULL CHECK ("current_role" IN ('admin', 'umkm', 'buyer')),
  requested_role text NOT NULL CHECK (requested_role IN ('admin', 'umkm', 'buyer')),
  reason text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Pemohon tidak boleh menargetkan dirinya sendiri.
  CONSTRAINT role_change_requests_no_self
    CHECK (requested_by <> target_user_id),
  -- Permintaan harus benar-benar mengubah role (no-op ditolak di server).
  CONSTRAINT role_change_requests_role_change
    CHECK ("current_role" <> requested_role),
  -- Field keputusan konsisten dengan status.
  CONSTRAINT role_change_requests_decision_state
    CHECK (
      (status = 'pending' AND decided_by IS NULL AND decided_at IS NULL)
      OR
      (status <> 'pending' AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
    ),
  -- Pemohon tidak boleh menjadi pemutus permintaannya sendiri (anti self-approval).
  CONSTRAINT role_change_requests_no_self_decision
    CHECK (decided_by IS NULL OR decided_by <> requested_by)
);

-- Satu permintaan pending per target (anti duplikasi / antrean ganda).
CREATE UNIQUE INDEX IF NOT EXISTS uq_role_change_requests_pending_target
  ON public.role_change_requests(target_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_role_change_requests_status_created
  ON public.role_change_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_role_change_requests_requested_by
  ON public.role_change_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_role_change_requests_target
  ON public.role_change_requests(target_user_id);
CREATE INDEX IF NOT EXISTS idx_role_change_requests_created_at
  ON public.role_change_requests(created_at DESC);

ALTER TABLE public.role_change_requests ENABLE ROW LEVEL SECURITY;

-- authenticated: baca + ajukan saja. UPDATE/DELETE sengaja DICABUT dan tanpa
-- policy UPDATE/DELETE: status hanya berubah lewat RPC SECURITY DEFINER.
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.role_change_requests FROM anon, authenticated;
GRANT SELECT, INSERT ON public.role_change_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.role_change_requests TO service_role;

DROP POLICY IF EXISTS "role_change_requests_select_admin" ON public.role_change_requests;
CREATE POLICY "role_change_requests_select_admin"
ON public.role_change_requests FOR SELECT
TO authenticated
USING (public.is_admin());

-- INSERT wajib: admin, pemohon = caller token, status awal pending, kolom
-- keputusan masih kosong, target bukan diri sendiri, dan target BUKAN akun
-- ber-role admin (termasuk Super Admin). Penjagaan target di level RLS ini
-- menutup penyisipan langsung via PostgREST yang melewati route — bukan
-- hanya mengandalkan tombol UI.
DROP POLICY IF EXISTS "role_change_requests_insert_admin" ON public.role_change_requests;
CREATE POLICY "role_change_requests_insert_admin"
ON public.role_change_requests FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  AND requested_by = auth.uid()
  AND status = 'pending'
  AND decided_by IS NULL
  AND decided_at IS NULL
  AND requested_by <> target_user_id
  AND EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.id = target_user_id
      AND p.role <> 'admin'
  )
);

-- ---------------------------------------------------------------------------
-- 2. RPC keputusan: approve/reject + ubah role + audit, SATU transaksi.
--
-- Hasil yang mungkin (jsonb.result):
--   'ok'                       -> keputusan tersimpan (approved menerapkan role)
--   'not_found'                -> request tidak ada
--   'already_decided'          -> sudah diputuskan (klaim 0 baris)
--   'requester_cannot_decide'  -> pelaku = pemohon
--   'no_change'                -> (approve) role target sudah = role diminta
--   'target_missing'           -> profil target tidak ada
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decide_role_change_request(
  p_request_id uuid,
  p_actor_id uuid,
  p_decision text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.role_change_requests%ROWTYPE;
  v_target_role text;
  v_old_role text;
  v_updated integer;
  v_note text;
BEGIN
  IF p_request_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'decide_role_change_request: parameter tidak lengkap';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'decide_role_change_request: keputusan tidak valid';
  END IF;

  -- Kunci baris: keputusan bersamaan diserialisasi di sini.
  SELECT * INTO v_req
  FROM public.role_change_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('result', 'not_found');
  END IF;
  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('result', 'already_decided', 'status', v_req.status);
  END IF;
  IF v_req.requested_by = p_actor_id THEN
    RETURN jsonb_build_object('result', 'requester_cannot_decide');
  END IF;

  -- Role aktual target dibaca di sini (bukan dari client / nilai lama request).
  SELECT role INTO v_target_role
  FROM public.profiles
  WHERE id = v_req.target_user_id;

  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('result', 'target_missing');
  END IF;

  IF p_decision = 'approved' AND v_target_role = v_req.requested_role THEN
    RETURN jsonb_build_object('result', 'no_change', 'role', v_target_role);
  END IF;

  -- Klaim atomik tepat-1-baris; 0 baris (balapan) = sudah diputuskan.
  UPDATE public.role_change_requests
     SET status = p_decision,
         decided_by = p_actor_id,
         decided_at = now(),
         decision_note = NULLIF(btrim(COALESCE(p_note, '')), '')
   WHERE id = p_request_id
     AND status = 'pending';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RETURN jsonb_build_object('result', 'already_decided');
  END IF;

  v_note := NULLIF(btrim(COALESCE(p_note, '')), '');

  IF p_decision = 'approved' THEN
    -- Role aktual sebelum perubahan (untuk log/audit/return, bukan nilai lama request).
    v_old_role := v_target_role;

    UPDATE public.profiles
       SET role = v_req.requested_role
     WHERE id = v_req.target_user_id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN
      RAISE EXCEPTION 'decide_role_change_request: target tidak ditemukan saat menerapkan role';
    END IF;

    -- Verifikasi pasca-update: bila trigger proteksi mengembalikan role
    -- (konteks bukan service_role), batalkan SEMUA (termasuk status request).
    SELECT role INTO v_target_role
    FROM public.profiles
    WHERE id = v_req.target_user_id;
    IF v_target_role IS DISTINCT FROM v_req.requested_role THEN
      RAISE EXCEPTION 'decide_role_change_request: role tidak berubah (konteks bukan service_role?)';
    END IF;

    INSERT INTO public.role_change_logs
      (actor_admin_id, target_user_id, old_role, new_role)
    VALUES
      (p_actor_id, v_req.target_user_id, v_old_role, v_req.requested_role);

    INSERT INTO public.admin_audit_logs
      (admin_id, action, target_type, target_id, reason, metadata)
    VALUES (
      p_actor_id,
      'approve_role_request',
      'user',
      v_req.target_user_id,
      COALESCE(v_note, 'Permintaan perubahan role disetujui'),
      jsonb_build_object(
        'auto', false,
        'request_id', p_request_id,
        'old_role', v_old_role,
        'new_role', v_req.requested_role,
        'requested_by', v_req.requested_by,
        'actor_source', 'service_or_system'
      )
    );

    RETURN jsonb_build_object(
      'result', 'ok',
      'status', 'approved',
      'old_role', v_old_role,
      'new_role', v_req.requested_role
    );
  END IF;

  -- rejected: role TIDAK disentuh; tetap dicatat ke audit.
  INSERT INTO public.admin_audit_logs
    (admin_id, action, target_type, target_id, reason, metadata)
  VALUES (
    p_actor_id,
    'reject_role_request',
    'user',
    v_req.target_user_id,
    COALESCE(v_note, 'Permintaan perubahan role ditolak'),
    jsonb_build_object(
      'auto', false,
      'request_id', p_request_id,
      'old_role', v_req.current_role,
      'requested_role', v_req.requested_role,
      'requested_by', v_req.requested_by,
      'actor_source', 'service_or_system'
    )
  );

  RETURN jsonb_build_object('result', 'ok', 'status', 'rejected');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decide_role_change_request(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_role_change_request(uuid, uuid, text, text)
  TO service_role;

COMMENT ON FUNCTION public.decide_role_change_request(uuid, uuid, text, text) IS
  'Keputusan permintaan role (approved/rejected) atomik: klaim status pending + ubah role + role_change_logs + admin_audit_logs dalam satu transaksi. Khusus service_role; otorisasi Super Admin ditegakkan route server.';

-- ---------------------------------------------------------------------------
-- 3. RPC jalur langsung Super Admin (PATCH /api/admin/users/:id/role).
--    Menggantikan penulisan role dari authed client lama (yang kini akan
--    di-revert trigger hardening). Hasil:
--      'ok' | 'not_found' | 'no_change'
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_role_change(
  p_target_id uuid,
  p_new_role text,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_role text;
  v_check text;
  v_updated integer;
BEGIN
  IF p_target_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'apply_role_change: parameter tidak lengkap';
  END IF;
  IF p_new_role IS NULL OR p_new_role NOT IN ('buyer', 'umkm', 'admin') THEN
    RAISE EXCEPTION 'apply_role_change: role tidak valid';
  END IF;

  SELECT role INTO v_old_role
  FROM public.profiles
  WHERE id = p_target_id;

  IF v_old_role IS NULL THEN
    RETURN jsonb_build_object('result', 'not_found');
  END IF;
  IF v_old_role = p_new_role THEN
    RETURN jsonb_build_object('result', 'no_change', 'role', v_old_role);
  END IF;

  UPDATE public.profiles
     SET role = p_new_role
   WHERE id = p_target_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'apply_role_change: update role gagal';
  END IF;

  -- Verifikasi pasca-update (konteks service_role); bila gagal -> rollback.
  SELECT role INTO v_check
  FROM public.profiles
  WHERE id = p_target_id;
  IF v_check IS DISTINCT FROM p_new_role THEN
    RAISE EXCEPTION 'apply_role_change: role tidak berubah (konteks bukan service_role?)';
  END IF;

  INSERT INTO public.role_change_logs
    (actor_admin_id, target_user_id, old_role, new_role)
  VALUES
    (p_actor_id, p_target_id, v_old_role, p_new_role);

  RETURN jsonb_build_object('result', 'ok', 'old_role', v_old_role, 'new_role', p_new_role);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_role_change(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_role_change(uuid, text, uuid)
  TO service_role;

COMMENT ON FUNCTION public.apply_role_change(uuid, text, uuid) IS
  'Perubahan role langsung (Super Admin via PATCH route): ubah profiles.role + catat role_change_logs dalam satu transaksi. Khusus service_role.';

-- ---------------------------------------------------------------------------
-- 4. Hardening trigger: perubahan profiles.role hanya dari konteks
--    service_role (server ReBites via RPC tervalidasi).
--
--    Sebelumnya trigger mengizinkan siapa pun yang is_admin() = true,
--    sehingga admin tim dapat mengubah role via PostgREST langsung tanpa
--    melewati proses persetujuan (temuan audit). Pola deteksi service_role
--    sama dengan guard lain di repo ini (auth.jwt() ->> 'role').
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lock_profiles_role_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  NEW.role := OLD.role;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.lock_profiles_role_on_update() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_lock_role ON public.profiles;
CREATE TRIGGER trg_profiles_lock_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.lock_profiles_role_on_update();

COMMENT ON FUNCTION public.lock_profiles_role_on_update() IS
  'Proteksi kolom profiles.role: hanya konteks service_role (RPC apply_role_change / decide_role_change_request) yang boleh mengubah role; selain itu dikembalikan ke OLD. Menutup bypass PostgREST admin tim.';

-- ============================================================================
-- Selesai. Tidak ada backfill: permintaan lama tidak ada (fitur baru).
-- Tidak menyentuh policy tabel lain, handle_new_user, atau data existing.
-- ============================================================================
