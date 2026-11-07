








































DO $$
DECLARE
  v_expected text[] := ARRAY[
    'order_created','payment_success','order_delivering','order_completed',
    'promo','incoming_order','new_review','subscription_active','subscription_renewed',
    'subscription_expiring','subscription_changed','subscription_expired',
    'product_approved','product_rejected','product_warning',
    'report_received','courier_assigned','user_warning',
    'account_sanctioned','account_restored'
  ]::text[];
  v_expected_sorted text[];
  v_existing text[];
  v_def text;
BEGIN
  SELECT array_agg(u.t ORDER BY u.t) INTO v_expected_sorted FROM unnest(v_expected) AS u(t);

  SELECT pg_get_constraintdef(c.oid)
    INTO v_def
    FROM pg_constraint c
   WHERE c.conrelid = 'public.notifications'::regclass
     AND c.conname = 'notifications_type_check';

  IF v_def IS NOT NULL THEN
    SELECT array_agg(m[1] ORDER BY m[1])
      INTO v_existing
      FROM regexp_matches(v_def, '''([a-z_]+)''', 'g') AS m;
  END IF;

  IF v_existing IS DISTINCT FROM v_expected_sorted THEN
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_type_check
      CHECK (type IN (
        'order_created','payment_success','order_delivering','order_completed',
        'promo','incoming_order','new_review','subscription_active','subscription_renewed',
        'subscription_expiring','subscription_changed','subscription_expired',
        'product_approved','product_rejected','product_warning',
        'report_received','courier_assigned','user_warning',
        'account_sanctioned','account_restored'
      ));
  END IF;
END $$;




CREATE OR REPLACE FUNCTION public.notification_role_for(p_user uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE p.role
           WHEN 'buyer' THEN 'buyer'
           WHEN 'umkm' THEN 'seller'
           ELSE NULL
         END
    FROM public.profiles p
   WHERE p.id = p_user;
$$;

REVOKE EXECUTE ON FUNCTION public.notification_role_for(uuid) FROM PUBLIC, anon, authenticated;





CREATE OR REPLACE FUNCTION public.notify_on_report_received_by_reporter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_sqlstate text;
  v_message text;
BEGIN
  IF NEW.reported_by IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.reported_by = NEW.reported_user_id THEN
    RETURN NEW;
  END IF;

  v_role := public.notification_role_for(NEW.reported_by);
  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM 1
      FROM public.notifications
     WHERE user_id = NEW.reported_by
       AND type = 'report_received'
       AND reference_id = NEW.id::text;
    IF FOUND THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, role, type, title, message, reference_id, href)
    VALUES (
      NEW.reported_by,
      v_role,
      'report_received',
      'Laporan Anda Diterima',
      'Laporan Anda telah diterima dan akan ditinjau oleh tim ReBites. Kami akan memberi tahu bila ada tindakan lanjutan.',
      NEW.id::text,
      CASE v_role
        WHEN 'buyer' THEN '/notifikasi/pembeli'
        ELSE '/dashboard/penjual/notifikasi'
      END
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE,
                            v_message  = MESSAGE_TEXT;
    RAISE WARNING
      'notify_on_report_received_by_reporter: gagal membuat notifikasi untuk report % (user %, sqlstate %, pesan: %)',
      NEW.id, NEW.reported_by, v_sqlstate, v_message;
  END;

  RETURN NEW;
END;
$$;




CREATE OR REPLACE FUNCTION public.notify_on_user_warning_issued()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_sqlstate text;
  v_message text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_role := public.notification_role_for(NEW.user_id);
  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM 1
      FROM public.notifications
     WHERE user_id = NEW.user_id
       AND type = 'user_warning'
       AND reference_id = NEW.id::text;
    IF FOUND THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, role, type, title, message, reference_id, href)
    VALUES (
      NEW.user_id,
      v_role,
      'user_warning',
      'Peringatan Admin (Level ' || NEW.warning_level::text || ')',
      'Anda menerima peringatan dari admin ReBites (level ' || NEW.warning_level::text || '). Alasan: ' ||
        COALESCE(NEW.reason, '-') || '. Kategori: ' || COALESCE(NEW.category, '-') ||
        '. Bila peringatan mencapai batas maksimum, akun Anda dapat dikenai sanksi.',
      NEW.id::text,
      '/akun/sanksi'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE,
                            v_message  = MESSAGE_TEXT;
    RAISE WARNING
      'notify_on_user_warning_issued: gagal membuat notifikasi untuk warning % (user %, sqlstate %, pesan: %)',
      NEW.id, NEW.user_id, v_sqlstate, v_message;
  END;

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS trg_warnings_notify_seller ON public.warnings;
DROP FUNCTION IF EXISTS public.notify_on_warning_issued();

DROP TRIGGER IF EXISTS trg_warnings_notify_user ON public.warnings;
CREATE TRIGGER trg_warnings_notify_user
  AFTER INSERT ON public.warnings
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_user_warning_issued();


CREATE OR REPLACE FUNCTION public.notify_on_sanction_issued()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_label text;
  v_sqlstate text;
  v_message text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_role := public.notification_role_for(NEW.user_id);
  IF v_role IS NULL THEN
    RETURN NEW;
  END IF;

  v_label := CASE NEW.sanction_type
    WHEN 'suspend' THEN 'Penangguhan'
    WHEN 'ban' THEN 'Pemblokiran'
    ELSE 'Catatan sanksi'
  END;

  BEGIN
    PERFORM 1
      FROM public.notifications
     WHERE user_id = NEW.user_id
       AND type = 'account_sanctioned'
       AND reference_id = NEW.id::text;
    IF FOUND THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, role, type, title, message, reference_id, href)
    VALUES (
      NEW.user_id,
      v_role,
      'account_sanctioned',
      'Sanksi Akun: ' || v_label,
      'Akun Anda dikenai ' || lower(v_label) || ' oleh admin ReBites. Alasan: ' || NEW.reason || '. ' ||
        CASE
          WHEN NEW.end_at IS NULL THEN 'Sanksi berlaku sampai dicabut admin.'
          ELSE 'Sanksi berlaku sampai ' || to_char(NEW.end_at, 'DD-MM-YYYY HH24:MI') ||
               ' (waktu server).'
        END,
      NEW.id::text,
      '/akun/sanksi'
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE,
                            v_message  = MESSAGE_TEXT;
    RAISE WARNING
      'notify_on_sanction_issued: gagal membuat notifikasi untuk sanction % (user %, sqlstate %, pesan: %)',
      NEW.id, NEW.user_id, v_sqlstate, v_message;
  END;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_on_sanction_issued() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_sanctions_notify_user ON public.sanctions;
CREATE TRIGGER trg_sanctions_notify_user
  AFTER INSERT ON public.sanctions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_sanction_issued();






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
    OR session_user IN ('postgres', 'supabase_admin')
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

  UPDATE public.profiles
     SET account_status = 'active'
   WHERE id = p_user
     AND account_status IN ('suspended', 'banned')
   RETURNING id INTO v_restored;

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

REVOKE EXECUTE ON FUNCTION public.restore_account_status_if_clear(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_account_status_if_clear(uuid) TO authenticated, service_role;


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
    OR session_user IN ('postgres', 'supabase_admin')
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

REVOKE EXECUTE ON FUNCTION public.release_expired_sanctions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_expired_sanctions() TO authenticated, service_role;


UPDATE public.notifications
   SET href = CASE role
                WHEN 'buyer' THEN '/notifikasi/pembeli'
                ELSE '/dashboard/penjual/notifikasi'
              END
 WHERE href = '/notifikasi';



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

COMMENT ON FUNCTION public.notification_role_for(uuid) IS
  'Pemetaan peran profil -> peran notifikasi (buyer->buyer, umkm->seller, lainnya NULL).';
COMMENT ON FUNCTION public.restore_account_status_if_clear(uuid) IS
  'Pulihkan account_status ke active bila tidak ada sanksi suspend/ban yang berlaku; kirim notifikasi account_restored. Fail-closed: admin/service_role/postgres saja.';
COMMENT ON FUNCTION public.release_expired_sanctions() IS
  'Sweep sanksi suspend/ban yang end_at-nya sudah lewat dan pulihkan status akun terkait. Fail-closed: admin/service_role/postgres saja.';
COMMENT ON FUNCTION public.notify_on_sanction_issued() IS
  'Beri tahu pengguna saat sanksi diterbitkan (account_sanctioned). Best-effort: kegagalan tercatat via RAISE WARNING.';
