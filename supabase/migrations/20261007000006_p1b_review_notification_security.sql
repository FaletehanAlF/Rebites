-- ============================================================================
-- P1-B: Review & Notification Authorization
--
-- Tujuan:
--   1. Review hanya boleh dibuat oleh buyer pemilik order yang sudah
--      completed, dengan product_id/umkm_id yang konsisten dengan order.
--   2. Kolom identitas review (user_id/order_id/order_code/product_id/
--      umkm_id) tidak dapat diubah melalui client setelah insert.
--   3. notifications INSERT dari client dibatasi hanya untuk notifikasi
--      milik diri sendiri (user_id = auth.uid()). Notifikasi untuk pihak
--      lawan hanya dibuat oleh jalur terpercaya: service_role (server),
--      trigger DB di atas orders/reviews, atau admin.
--   4. UPDATE notifications dari client dibatasi hanya pada kolom `read`.
--   5. Notifikasi status order dan review baru dibuat oleh trigger DB
--      (SECURITY DEFINER) agar client tidak perlu (dan tidak boleh)
--      menyisipkan notifikasi untuk user lain.
--
-- Tidak mengubah schema lama; hanya mengganti policy/function/trigger.
-- Idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Helper validasi review: order ada, milik user, completed, konsisten.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_review_order(
  p_order_code text,
  p_order_id uuid,
  p_user_id uuid,
  p_product_id uuid,
  p_umkm_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.order_code = p_order_code
      AND o.buyer_id = p_user_id
      AND o.lifecycle_status = 'completed'
      AND o.product_id = p_product_id
      AND o.umkm_id = p_umkm_id
      AND (p_order_id IS NULL OR o.id = p_order_id)
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. reviews: policy INSERT/UPDATE ketat berbasis validasi order.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;
CREATE POLICY "reviews_insert_own"
ON public.reviews FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.can_review_order(order_code, order_id, user_id, product_id, umkm_id)
);

DROP POLICY IF EXISTS "reviews_update_own" ON public.reviews;
CREATE POLICY "reviews_update_own"
ON public.reviews FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND public.can_review_order(order_code, order_id, user_id, product_id, umkm_id)
);

-- ----------------------------------------------------------------------------
-- 3. reviews: freeze kolom identitas pada UPDATE.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_reviews_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.order_code IS DISTINCT FROM OLD.order_code
     OR NEW.product_id IS DISTINCT FROM OLD.product_id
     OR NEW.umkm_id IS DISTINCT FROM OLD.umkm_id THEN
    RAISE EXCEPTION 'Kolom identitas review tidak dapat diubah' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_guard_identity ON public.reviews;
CREATE TRIGGER trg_reviews_guard_identity
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.guard_reviews_identity();

-- ----------------------------------------------------------------------------
-- 4. reviews -> notifikasi 'new_review' untuk penjual (trusted path).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_review_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_user_id uuid;
BEGIN
  SELECT u.user_id INTO v_seller_user_id
  FROM public.umkm_profiles u
  WHERE u.id = NEW.umkm_id;

  IF v_seller_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, role, type, title, message, reference_id, href)
  VALUES (
    v_seller_user_id,
    'seller',
    'new_review',
    'Ulasan Baru Diterima!',
    COALESCE(NEW.author_name, 'Pembeli ReBites')
      || ' memberi '
      || NEW.rating::text
      || '★ untuk '
      || COALESCE(NEW.menu_name, '')
      || ' (pesanan #'
      || COALESCE(NEW.order_code, '')
      || ')',
    NEW.order_code,
    '/dashboard/penjual/ulasan'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reviews_notify_new ON public.reviews;
CREATE TRIGGER trg_reviews_notify_new
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_review_insert();

-- ----------------------------------------------------------------------------
-- 5. notifications: INSERT hanya untuk diri sendiri; UPDATE hanya kolom read.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_insert_any_authed" ON public.notifications;
CREATE POLICY "notifications_insert_self"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.guard_notifications_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF session_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.message IS DISTINCT FROM OLD.message
     OR NEW.reference_id IS DISTINCT FROM OLD.reference_id
     OR NEW.href IS DISTINCT FROM OLD.href
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Notifikasi hanya dapat ditandai dibaca' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_guard_update ON public.notifications;
CREATE TRIGGER trg_notifications_guard_update
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.guard_notifications_update();

-- ----------------------------------------------------------------------------
-- 6. orders -> notifikasi status order untuk buyer & penjual (trusted path).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_user_id uuid;
  v_href text;
BEGIN
  v_href := '/riwayatPesanan?orderId=' || NEW.order_code;

  SELECT u.user_id INTO v_seller_user_id
  FROM public.umkm_profiles u
  WHERE u.id = NEW.umkm_id;

  IF NEW.order_status IS DISTINCT FROM OLD.order_status THEN
    CASE NEW.order_status
      WHEN 'processing' THEN
        IF NEW.buyer_id IS NOT NULL THEN
          INSERT INTO public.notifications (user_id, role, type, title, message, reference_id, href)
          VALUES (NEW.buyer_id, 'buyer', 'order_created', 'Pesanan Sedang Disiapkan',
            'Pesanan #' || NEW.order_code || ' (' || COALESCE(NEW.product_name, 'Pesanan') || ') dari ' || COALESCE(NEW.vendor_name, 'Toko') || ' sedang disiapkan.',
            NEW.order_code, v_href);
        END IF;
      WHEN 'ready_for_pickup' THEN
        IF NEW.buyer_id IS NOT NULL THEN
          INSERT INTO public.notifications (user_id, role, type, title, message, reference_id, href)
          VALUES (NEW.buyer_id, 'buyer', 'order_delivering', 'Pesanan Siap Diambil!',
            'Pesanan #' || NEW.order_code || ' (' || COALESCE(NEW.product_name, 'Pesanan') || ') dari ' || COALESCE(NEW.vendor_name, 'Toko') || ' sudah siap diambil di toko.',
            NEW.order_code, v_href);
        END IF;
      WHEN 'out_for_delivery' THEN
        IF NEW.buyer_id IS NOT NULL THEN
          INSERT INTO public.notifications (user_id, role, type, title, message, reference_id, href)
          VALUES (NEW.buyer_id, 'buyer', 'order_delivering', 'Pesanan Sedang Diantar!',
            'Pesanan #' || NEW.order_code || ' (' || COALESCE(NEW.product_name, 'Pesanan') || ') dari ' || COALESCE(NEW.vendor_name, 'Toko') || ' sedang menuju alamatmu.',
            NEW.order_code, v_href);
        END IF;
      WHEN 'completed' THEN
        IF NEW.buyer_id IS NOT NULL THEN
          INSERT INTO public.notifications (user_id, role, type, title, message, reference_id, href)
          VALUES (NEW.buyer_id, 'buyer', 'order_completed', 'Pesanan Selesai!',
            'Pesanan #' || NEW.order_code || ' (' || COALESCE(NEW.product_name, 'Pesanan') || ') dari ' || COALESCE(NEW.vendor_name, 'Toko') || ' telah selesai. Selamat menikmati!',
            NEW.order_code, v_href);
        END IF;
        IF v_seller_user_id IS NOT NULL THEN
          INSERT INTO public.notifications (user_id, role, type, title, message, reference_id, href)
          VALUES (v_seller_user_id, 'seller', 'order_completed', 'Pesanan Selesai!',
            'Pesanan #' || NEW.order_code || ' (' || COALESCE(NEW.product_name, 'Pesanan') || ') telah selesai. Dana akan dilepas ke saldo.',
            NEW.order_code, '/dashboard/penjual/pesanan');
        END IF;
      WHEN 'cancelled' THEN
        IF NEW.buyer_id IS NOT NULL THEN
          INSERT INTO public.notifications (user_id, role, type, title, message, reference_id, href)
          VALUES (NEW.buyer_id, 'buyer', 'order_completed', 'Pesanan Dibatalkan',
            'Pesanan #' || NEW.order_code || ' (' || COALESCE(NEW.product_name, 'Pesanan') || ') telah dibatalkan.',
            NEW.order_code, v_href);
        END IF;
      ELSE
        NULL;
    END CASE;
  ELSIF NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status
        AND NEW.lifecycle_status = 'completed' THEN
    IF NEW.buyer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, role, type, title, message, reference_id, href)
      VALUES (NEW.buyer_id, 'buyer', 'order_completed', 'Pesanan Selesai!',
        'Pesanan #' || NEW.order_code || ' (' || COALESCE(NEW.product_name, 'Pesanan') || ') dari ' || COALESCE(NEW.vendor_name, 'Toko') || ' telah selesai. Selamat menikmati!',
        NEW.order_code, v_href);
    END IF;
    IF v_seller_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, role, type, title, message, reference_id, href)
      VALUES (v_seller_user_id, 'seller', 'order_completed', 'Pesanan Selesai!',
        'Pesanan #' || NEW.order_code || ' (' || COALESCE(NEW.product_name, 'Pesanan') || ') telah selesai. Dana akan dilepas ke saldo.',
        NEW.order_code, '/dashboard/penjual/pesanan');
    END IF;
  ELSIF NEW.progress_status IS DISTINCT FROM OLD.progress_status
        AND NEW.progress_status IN ('diantar', 'siap-diambil') THEN
    IF NEW.buyer_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, role, type, title, message, reference_id, href)
      VALUES (NEW.buyer_id, 'buyer', 'order_delivering',
        CASE WHEN NEW.delivery_option = 'pickup' OR NEW.progress_status = 'siap-diambil'
             THEN 'Pesanan Siap Diambil!' ELSE 'Pesanan Sedang Diantar!' END,
        'Pesanan #' || NEW.order_code || ' (' || COALESCE(NEW.product_name, 'Pesanan') || ') dari ' || COALESCE(NEW.vendor_name, 'Toko')
        || CASE WHEN NEW.delivery_option = 'pickup' OR NEW.progress_status = 'siap-diambil'
             THEN ' sudah siap diambil di toko.' ELSE ' sedang diantar kurir ke alamatmu.' END,
        NEW.order_code, v_href);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_notify_status_change ON public.orders;
CREATE TRIGGER trg_orders_notify_status_change
  AFTER UPDATE OF order_status, lifecycle_status, progress_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_order_status_change();
