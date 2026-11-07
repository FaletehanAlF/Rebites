









































































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
  
  CONSTRAINT role_change_requests_no_self
    CHECK (requested_by <> target_user_id),
  
  CONSTRAINT role_change_requests_role_change
    CHECK ("current_role" <> requested_role),
  
  CONSTRAINT role_change_requests_decision_state
    CHECK (
      (status = 'pending' AND decided_by IS NULL AND decided_at IS NULL)
      OR
      (status <> 'pending' AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
    ),
  
  CONSTRAINT role_change_requests_no_self_decision
    CHECK (decided_by IS NULL OR decided_by <> requested_by)
);


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



REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.role_change_requests FROM anon, authenticated;
GRANT SELECT, INSERT ON public.role_change_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.role_change_requests TO service_role;

DROP POLICY IF EXISTS "role_change_requests_select_admin" ON public.role_change_requests;
CREATE POLICY "role_change_requests_select_admin"
ON public.role_change_requests FOR SELECT
TO authenticated
USING (public.is_admin());






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

  
  SELECT role INTO v_target_role
  FROM public.profiles
  WHERE id = v_req.target_user_id;

  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('result', 'target_missing');
  END IF;

  IF p_decision = 'approved' AND v_target_role = v_req.requested_role THEN
    RETURN jsonb_build_object('result', 'no_change', 'role', v_target_role);
  END IF;

  
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
    
    v_old_role := v_target_role;

    UPDATE public.profiles
       SET role = v_req.requested_role
     WHERE id = v_req.target_user_id;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated <> 1 THEN
      RAISE EXCEPTION 'decide_role_change_request: target tidak ditemukan saat menerapkan role';
    END IF;

    
    
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





