





























































































































DO $$
DECLARE
  
  v_expected text[] := ARRAY[
    'order_created','payment_success','order_delivering','order_completed',
    'promo','incoming_order','new_review','subscription_active','subscription_renewed',
    'subscription_expiring','subscription_changed','subscription_expired',
    'product_approved','product_rejected','product_warning',
    'report_received'
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
        'report_received'
      ));
  END IF;
END $$;




CREATE OR REPLACE FUNCTION public.notify_on_report_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_label text;
  v_sqlstate text;
  v_message text;
BEGIN
  
  
  IF NEW.reported_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  
  IF NEW.reported_by IS NOT NULL AND NEW.reported_by = NEW.reported_user_id THEN
    RETURN NEW;
  END IF;

  v_category_label := CASE NEW.category
    WHEN 'harassment' THEN 'pelecehan'
    WHEN 'spam' THEN 'spam'
    WHEN 'fraud' THEN 'penipuan'
    WHEN 'inappropriate_content' THEN 'konten tidak pantas'
    WHEN 'other' THEN 'lainnya'
    ELSE COALESCE(NEW.category, 'lainnya')
  END;

  BEGIN
    
    PERFORM 1
      FROM public.notifications
     WHERE user_id = NEW.reported_user_id
       AND type = 'report_received'
       AND reference_id = NEW.id::text;
    IF FOUND THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, role, type, title, message, reference_id, href)
    VALUES (
      NEW.reported_user_id,
      'seller',
      'report_received',
      'Laporan Baru untuk Toko Anda',
      'Ada laporan baru dengan kategori ' || v_category_label ||
        '. Tim ReBites akan meninjaunya. Pastikan informasi toko dan pesanan Anda akurat.',
      NEW.id::text,
      '/dashboard/penjual/notifikasi'
    );
  EXCEPTION WHEN OTHERS THEN
    
    
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE,
                            v_message  = MESSAGE_TEXT;
    RAISE WARNING
      'notify_on_report_created: gagal membuat notifikasi untuk report % (user %, sqlstate %, pesan: %)',
      NEW.id, NEW.reported_user_id, v_sqlstate, v_message;
  END;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_on_report_created() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reports_notify_store ON public.reports;
CREATE TRIGGER trg_reports_notify_store
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_report_created();

COMMENT ON FUNCTION public.notify_on_report_created() IS
  'NOTIF-1: memberi tahu pemilik toko (reports.reported_user_id) saat laporan dibuat. Best-effort: kegagalan dicatat via RAISE WARNING, tidak menggagalkan INSERT reports.';
