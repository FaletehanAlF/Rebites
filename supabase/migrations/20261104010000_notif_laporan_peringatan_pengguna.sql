































DO $$
DECLARE
  v_expected text[] := ARRAY[
    'order_created','payment_success','order_delivering','order_completed',
    'promo','incoming_order','new_review','subscription_active','subscription_renewed',
    'subscription_expiring','subscription_changed','subscription_expired',
    'product_approved','product_rejected','product_warning',
    'report_received','user_warning'
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
        'report_received','user_warning'
      ));
  END IF;
END $$;


CREATE OR REPLACE FUNCTION public.notify_on_report_received_by_reporter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sqlstate text;
  v_message text;
BEGIN
  
  IF NEW.reported_by IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.reported_by = NEW.reported_user_id THEN
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
      (SELECT p.role FROM public.profiles p WHERE p.id = NEW.reported_by LIMIT 1),
      'report_received',
      'Laporan Anda Diterima',
      'Laporan Anda telah diterima dan akan ditinjau oleh tim ReBites. Kami akan memberi tahu bila ada tindakan lanjutan.',
      NEW.id::text,
      '/notifikasi'
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

REVOKE EXECUTE ON FUNCTION public.notify_on_report_received_by_reporter() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reports_notify_reporter ON public.reports;
CREATE TRIGGER trg_reports_notify_reporter
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_report_received_by_reporter();


CREATE OR REPLACE FUNCTION public.notify_on_user_warning_issued()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_role text;
  v_sqlstate text;
  v_message text;
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  
  SELECT p.role INTO v_target_role
    FROM public.profiles p
   WHERE p.id = NEW.user_id
   LIMIT 1;

  IF v_target_role IS NULL THEN
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
      v_target_role,
      'user_warning',
      'Peringatan Admin (Level ' || NEW.warning_level::text || ')',
      'Anda menerima peringatan dari admin ReBites (level ' || NEW.warning_level::text || '). Alasan: ' ||
        COALESCE(NEW.reason, '-') || '. Kategori: ' || COALESCE(NEW.category, '-') ||
        '. Bila peringatan mencapai batas maksimum, akun Anda dapat dikenai sanksi.',
      NEW.id::text,
      '/notifikasi'
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

REVOKE EXECUTE ON FUNCTION public.notify_on_user_warning_issued() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_warnings_notify_user ON public.warnings;
CREATE TRIGGER trg_warnings_notify_user
  AFTER INSERT ON public.warnings
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_user_warning_issued();

COMMENT ON FUNCTION public.notify_on_report_received_by_reporter() IS
  'NOTIF-2: memberi tahu pelapor bahwa laporannya diterima. Best-effort.';
COMMENT ON FUNCTION public.notify_on_user_warning_issued() IS
  'NOTIF-2: memberi tahu pengguna yang diberikan peringatan admin, dengan level peringatan. Best-effort.';
