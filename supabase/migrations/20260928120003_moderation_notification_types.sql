



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
