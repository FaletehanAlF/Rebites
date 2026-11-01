-- Tambahkan 'product_approved' dan 'product_rejected' ke constraint notifications.type
-- untuk notifikasi hasil moderasi produk ke seller (Tahap 3).
-- Mengikuti pola 20260928120002_fix_notifications_new_review.sql.
-- Semua type lama dipertahankan agar data existing tetap valid.
DO $$
BEGIN
  ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'order_created','payment_success','order_delivering','order_completed',
    'promo','incoming_order','new_review','subscription_active','subscription_renewed',
    'subscription_expiring','subscription_changed','subscription_expired',
    'product_approved','product_rejected'
  ));
