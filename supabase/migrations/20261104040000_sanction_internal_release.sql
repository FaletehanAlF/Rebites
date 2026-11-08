























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
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;
  
  
  
  IF current_setting('rebites.internal_sanction_release', true) = 'on'
     AND (session_user LIKE 'postgres%' OR session_user LIKE 'supabase_admin%') THEN
    RETURN NEW;
  END IF;
  NEW.account_status := OLD.account_status;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_lock_account_status ON public.profiles;
CREATE TRIGGER trg_profiles_lock_account_status
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.lock_profiles_account_status_on_update();


CREATE OR REPLACE FUNCTION public.restore_account_status_if_clear(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restored uuid;
  v_role text;
BEGIN
  IF p_user IS NULL THEN
    RAISE EXCEPTION 'p_user wajib diisi.' USING ERRCODE = '22023';
  END IF;

  IF NOT (
    public.is_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    
    
    
    OR session_user LIKE 'postgres%'
    OR session_user LIKE 'supabase_admin%'
  ) THEN
    RAISE EXCEPTION 'Akses ditolak: hanya admin yang dapat memulihkan status akun.'
      USING ERRCODE = '42501';
  END IF;

  
  IF EXISTS (
    SELECT 1
      FROM public.sanctions s
     WHERE s.user_id = p_user
       AND s.sanction_type IN ('suspend', 'ban')
       AND (s.end_at IS NULL OR s.end_at > now())
  ) THEN
    RETURN;
  END IF;

  
  
  PERFORM set_config('rebites.internal_sanction_release', 'on', true);

  UPDATE public.profiles
     SET account_status = 'active'
   WHERE id = p_user
     AND account_status IN ('suspended', 'banned')
   RETURNING id INTO v_restored;

  PERFORM set_config('rebites.internal_sanction_release', '', true);

  IF v_restored IS NULL THEN
    RETURN;
  END IF;

  v_role := public.notification_role_for(p_user);
  IF v_role IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.notifications (user_id, role, type, title, message, reference_id, href)
    VALUES (
      p_user,
      v_role,
      'account_restored',
      'Status Akun Dipulihkan',
      'Sanksi pada akun Anda telah berakhir atau dicabut. Akun Anda kembali aktif dan dapat digunakan seperti biasa.',
      NULL,
      '/akun/sanksi'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING
      'restore_account_status_if_clear: status akun % dipulihkan tetapi notifikasi gagal dibuat', p_user;
  END;
END;
$$;


CREATE OR REPLACE FUNCTION public.release_expired_sanctions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_count integer := 0;
BEGIN
  IF NOT (
    public.is_admin()
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR session_user LIKE 'postgres%'
    OR session_user LIKE 'supabase_admin%'
  ) THEN
    RAISE EXCEPTION 'Akses ditolak: hanya admin yang dapat menjalankan sweep sanksi.'
      USING ERRCODE = '42501';
  END IF;

  FOR v_user IN
    SELECT DISTINCT s.user_id
      FROM public.sanctions s
     WHERE s.user_id IS NOT NULL
       AND s.sanction_type IN ('suspend', 'ban')
       AND s.end_at IS NOT NULL
       AND s.end_at <= now()
       AND EXISTS (
         SELECT 1 FROM public.profiles p
          WHERE p.id = s.user_id
            AND p.account_status IN ('suspended', 'banned')
       )
       AND NOT EXISTS (
         SELECT 1 FROM public.sanctions a
          WHERE a.user_id = s.user_id
            AND a.sanction_type IN ('suspend', 'ban')
            AND (a.end_at IS NULL OR a.end_at > now())
       )
  LOOP
    PERFORM public.restore_account_status_if_clear(v_user);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;



SELECT public.release_expired_sanctions();



DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
      EXECUTE 'CREATE EXTENSION pg_cron WITH SCHEMA pg_catalog';
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rebites-release-expired-sanctions') THEN
      PERFORM cron.unschedule('rebites-release-expired-sanctions');
    END IF;
    PERFORM cron.schedule(
      'rebites-release-expired-sanctions',
      '*/15 * * * *',
      'SELECT public.release_expired_sanctions();'
    );
  ELSE
    RAISE WARNING 'pg_cron tidak tersedia; sanksi kedaluwarsa dipulihkan lewat sweep saat admin membuka daftar sanksi.';
  END IF;
END $$;

COMMENT ON FUNCTION public.restore_account_status_if_clear(uuid) IS
  'Pulihkan account_status ke active bila tidak ada sanksi suspend/ban yang berlaku; kirim notifikasi account_restored. Internal/admin saja.';
COMMENT ON FUNCTION public.release_expired_sanctions() IS
  'Sweep sanksi suspend/ban yang end_at-nya sudah lewat dan pulihkan status akun terkait. Dijalankan job berkala dan saat admin membuka daftar sanksi.';
