












































ALTER TABLE public.umkm_profiles
  ADD COLUMN IF NOT EXISTS deactivation_reason text,
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.umkm_profiles.deactivation_reason IS
  'Alasan admin menonaktifkan toko (ditampilkan ke penjual). NULL saat toko aktif.';
COMMENT ON COLUMN public.umkm_profiles.deactivated_at IS
  'Waktu admin menonaktifkan toko. NULL saat toko aktif.';
COMMENT ON COLUMN public.umkm_profiles.deactivated_by IS
  'Admin yang menonaktifkan toko. NULL saat toko aktif.';




DO $$
DECLARE
  v_expected text[] := ARRAY[
    'login','register','product_created','product_updated','product_deleted',
    'order_created','order_cancelled','store_updated','subscription_changed',
    'report_received','warning_received',
    'store_deactivated','store_activated','store_activation_requested'
  ]::text[];
  v_expected_sorted text[];
  v_existing text[];
  v_cname text;
  v_def text;
BEGIN
  SELECT array_agg(u.t ORDER BY u.t) INTO v_expected_sorted FROM unnest(v_expected) AS u(t);

  SELECT c.conname, pg_get_constraintdef(c.oid)
    INTO v_cname, v_def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
   WHERE n.nspname = 'public'
     AND t.relname = 'activity_logs'
     AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) LIKE '%activity_type%'
   LIMIT 1;

  IF v_def IS NOT NULL THEN
    SELECT array_agg(m[1] ORDER BY m[1])
      INTO v_existing
      FROM regexp_matches(v_def, '''([a-z_]+)''', 'g') AS m;
  END IF;

  IF v_existing IS DISTINCT FROM v_expected_sorted THEN
    IF v_cname IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.activity_logs DROP CONSTRAINT %I', v_cname);
    END IF;
    ALTER TABLE public.activity_logs
      ADD CONSTRAINT activity_logs_activity_type_check
      CHECK (activity_type IN (
        'login','register','product_created','product_updated','product_deleted',
        'order_created','order_cancelled','store_updated','subscription_changed',
        'report_received','warning_received',
        'store_deactivated','store_activated','store_activation_requested'
      ));
  END IF;
END $$;


CREATE TABLE IF NOT EXISTS public.store_activation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  umkm_id uuid NOT NULL REFERENCES public.umkm_profiles(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  decision_note text,
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(message) <> ''),
  CHECK (char_length(message) <= 1000)
);

ALTER TABLE public.store_activation_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sar_umkm_created
  ON public.store_activation_requests(umkm_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sar_status
  ON public.store_activation_requests(status);


CREATE UNIQUE INDEX IF NOT EXISTS idx_sar_one_pending
  ON public.store_activation_requests(umkm_id)
  WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON public.store_activation_requests
  TO authenticated, service_role;

DROP POLICY IF EXISTS "sar_select_own_or_admin" ON public.store_activation_requests;
CREATE POLICY "sar_select_own_or_admin"
ON public.store_activation_requests FOR SELECT
TO authenticated
USING (requested_by = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "sar_insert_own" ON public.store_activation_requests;
CREATE POLICY "sar_insert_own"
ON public.store_activation_requests FOR INSERT
TO authenticated
WITH CHECK (requested_by = auth.uid() AND public.is_admin() = false);

DROP POLICY IF EXISTS "sar_update_admin" ON public.store_activation_requests;
CREATE POLICY "sar_update_admin"
ON public.store_activation_requests FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

COMMENT ON TABLE public.store_activation_requests IS
  'Permintaan penjual agar tokonya yang dinonaktifkan admin dapat diaktifkan kembali. Satu baris pending per toko; keputusan admin disimpan di baris yang sama.';


CREATE OR REPLACE FUNCTION public.guard_store_activation_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_active boolean;
BEGIN
  SELECT u.user_id, u.is_active INTO v_owner, v_active
    FROM public.umkm_profiles u
   WHERE u.id = NEW.umkm_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Toko tidak ditemukan.' USING ERRCODE = '23503';
  END IF;
  IF v_owner <> NEW.requested_by THEN
    RAISE EXCEPTION 'Hanya pemilik toko yang dapat mengajukan aktivasi.' USING ERRCODE = '42501';
  END IF;
  IF v_active THEN
    RAISE EXCEPTION 'Toko masih aktif; permintaan aktivasi tidak diperlukan.' USING ERRCODE = '22023';
  END IF;

  
  NEW.status := 'pending';
  NEW.decision_note := NULL;
  NEW.decided_by := NULL;
  NEW.decided_at := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sar_guard_insert ON public.store_activation_requests;
CREATE TRIGGER trg_sar_guard_insert
  BEFORE INSERT ON public.store_activation_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_store_activation_request();




CREATE OR REPLACE FUNCTION public.lock_umkm_is_active_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' OR public.is_admin() THEN
    
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      IF NEW.is_active = false THEN
        
        
        IF btrim(COALESCE(NEW.deactivation_reason, '')) = '' THEN
          RAISE EXCEPTION 'Alasan penonaktifan toko wajib diisi.' USING ERRCODE = '22023';
        END IF;
        NEW.deactivated_at := COALESCE(NEW.deactivated_at, now());
        NEW.deactivated_by := COALESCE(NEW.deactivated_by, auth.uid());
      ELSE
        
        NEW.deactivation_reason := NULL;
        NEW.deactivated_at := NULL;
        NEW.deactivated_by := NULL;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  
  
  
  NEW.is_active := OLD.is_active;
  NEW.deactivation_reason := OLD.deactivation_reason;
  NEW.deactivated_at := OLD.deactivated_at;
  NEW.deactivated_by := OLD.deactivated_by;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_umkm_lock_is_active ON public.umkm_profiles;
CREATE TRIGGER trg_umkm_lock_is_active
  BEFORE UPDATE ON public.umkm_profiles
  FOR EACH ROW EXECUTE FUNCTION public.lock_umkm_is_active_on_update();

COMMENT ON FUNCTION public.lock_umkm_is_active_on_update() IS
  'Menonaktifkan toko adalah keputusan admin: penjual tidak dapat mengubah is_active maupun kolom jejaknya. Deaktivasi wajib membawa deactivation_reason; aktivasi membersihkan jejak.';


CREATE OR REPLACE FUNCTION public.log_store_activation_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_reason text;
BEGIN
  IF NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN
    RETURN NEW;
  END IF;

  IF NEW.is_active = false THEN
    v_reason := NEW.deactivation_reason;
    INSERT INTO public.activity_logs (user_id, activity_type, description, target_type, target_id, metadata)
    VALUES (
      v_actor,
      'store_deactivated',
      'Toko dinonaktifkan admin: ' || COALESCE(NEW.business_name, '(tanpa nama)'),
      'store',
      NEW.id,
      jsonb_build_object(
        'auto', true,
        'umkm_id', NEW.id,
        'business_name', NEW.business_name,
        'reason', v_reason
      )
    );
    INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, reason, metadata)
    VALUES (
      v_actor,
      'deactivate_store',
      'store',
      NEW.id,
      COALESCE(v_reason, '-'),
      jsonb_build_object('auto', true, 'umkm_id', NEW.id, 'business_name', NEW.business_name)
    );
  ELSE
    
    v_reason := OLD.deactivation_reason;
    INSERT INTO public.activity_logs (user_id, activity_type, description, target_type, target_id, metadata)
    VALUES (
      v_actor,
      'store_activated',
      'Toko diaktifkan kembali: ' || COALESCE(NEW.business_name, '(tanpa nama)'),
      'store',
      NEW.id,
      jsonb_build_object(
        'auto', true,
        'umkm_id', NEW.id,
        'business_name', NEW.business_name,
        'previous_reason', v_reason
      )
    );
    INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, reason, metadata)
    VALUES (
      v_actor,
      'activate_store',
      'store',
      NEW.id,
      COALESCE(v_reason, 'Toko diaktifkan kembali'),
      jsonb_build_object('auto', true, 'umkm_id', NEW.id, 'business_name', NEW.business_name)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_umkm_activity_activation ON public.umkm_profiles;
CREATE TRIGGER trg_umkm_activity_activation
  AFTER UPDATE OF is_active ON public.umkm_profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_store_activation_change();



CREATE OR REPLACE FUNCTION public.log_store_activation_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  SELECT business_name INTO v_name FROM public.umkm_profiles WHERE id = NEW.umkm_id;

  INSERT INTO public.activity_logs (user_id, activity_type, description, target_type, target_id, metadata)
  VALUES (
    NEW.requested_by,
    'store_activation_requested',
    'Permintaan aktivasi toko: ' || COALESCE(v_name, '(tanpa nama)'),
    'store',
    NEW.umkm_id,
    jsonb_build_object(
      'auto', true,
      'request_id', NEW.id,
      'umkm_id', NEW.umkm_id,
      'business_name', v_name,
      'message', left(NEW.message, 300)
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sar_activity_request ON public.store_activation_requests;
CREATE TRIGGER trg_sar_activity_request
  AFTER INSERT ON public.store_activation_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_store_activation_request();





DELETE FROM public.activity_logs a
 WHERE a.activity_type = 'login'
   AND EXISTS (
     SELECT 1 FROM public.profiles p
      WHERE p.id = a.user_id AND p.role = 'admin'
   )
   AND NOT EXISTS (
     SELECT 1 FROM public.reports r WHERE r.activity_id = a.id
   );

COMMENT ON FUNCTION public.log_store_activation_change() IS
  'Jejak activity_logs + admin_audit_logs ketika admin menonaktifkan/mengaktifkan toko.';
COMMENT ON FUNCTION public.log_store_activation_request() IS
  'Jejak activity_logs ketika penjual mengajukan permintaan aktivasi toko.';
COMMENT ON FUNCTION public.guard_store_activation_request() IS
  'Hanya pemilik toko nonaktif yang boleh mengajukan aktivasi; status/keputusan selalu dimulai dari pending.';
