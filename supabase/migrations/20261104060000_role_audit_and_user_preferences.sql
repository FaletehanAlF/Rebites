



























CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.user_preferences TO authenticated, service_role;

DROP POLICY IF EXISTS "user_preferences_select_own" ON public.user_preferences;
CREATE POLICY "user_preferences_select_own"
ON public.user_preferences FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preferences_insert_own" ON public.user_preferences;
CREATE POLICY "user_preferences_insert_own"
ON public.user_preferences FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preferences_update_own" ON public.user_preferences;
CREATE POLICY "user_preferences_update_own"
ON public.user_preferences FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_preferences_delete_own" ON public.user_preferences;
CREATE POLICY "user_preferences_delete_own"
ON public.user_preferences FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_preferences IS
  'Preferensi panel admin per pengguna (jsonb): tampilan, status baca notifikasi, dan status keputusan permintaan role yang sudah dilihat. Sumber kebenaran lintas perangkat; localStorage hanya cache.';



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

  
  
  
  INSERT INTO public.admin_audit_logs
    (admin_id, action, target_type, target_id, reason, metadata)
  VALUES (
    p_actor_id,
    'change_user_role',
    'user',
    p_target_id,
    'Perubahan peran: ' || v_old_role || ' -> ' || p_new_role,
    jsonb_build_object(
      'via', 'apply_role_change',
      'old_role', v_old_role,
      'new_role', p_new_role
    )
  );

  RETURN jsonb_build_object('result', 'ok', 'old_role', v_old_role, 'new_role', p_new_role);
END;
$$;

COMMENT ON FUNCTION public.apply_role_change(uuid, text, uuid) IS
  'Perubahan peran langsung oleh Super Admin: menulis role_change_logs DAN admin_audit_logs dalam satu transaksi. Khusus service_role.';
