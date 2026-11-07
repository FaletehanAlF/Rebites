





























ALTER TABLE public.delivery_assignments
  ALTER COLUMN courier_user_id DROP NOT NULL;

ALTER TABLE public.delivery_assignments
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'delivery_assignments_courier_required'
  ) THEN
    ALTER TABLE public.delivery_assignments
      ADD CONSTRAINT delivery_assignments_courier_required
      CHECK (is_demo OR courier_user_id IS NOT NULL);
  END IF;
END $$;

COMMENT ON COLUMN public.delivery_assignments.is_demo IS
  'Kurir demo untuk pengujian alur; BUKAN orang sungguhan. UI wajib melabelinya.';




ALTER TABLE public.courier_messages
  ALTER COLUMN sender_user_id DROP NOT NULL;

ALTER TABLE public.courier_messages
  ADD COLUMN IF NOT EXISTS sender_kind text NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courier_messages_sender_kind_check'
  ) THEN
    ALTER TABLE public.courier_messages
      ADD CONSTRAINT courier_messages_sender_kind_check
      CHECK (sender_kind IN ('user', 'demo_courier'));
  END IF;

  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'courier_messages_sender_required'
  ) THEN
    ALTER TABLE public.courier_messages
      ADD CONSTRAINT courier_messages_sender_required
      CHECK (
        (sender_kind = 'user' AND sender_user_id IS NOT NULL)
        OR (sender_kind = 'demo_courier' AND sender_user_id IS NULL)
      );
  END IF;
END $$;

COMMENT ON COLUMN public.courier_messages.sender_kind IS
  'user = pengguna sungguhan; demo_courier = balasan otomatis kurir demo.';







DROP POLICY IF EXISTS "courier_messages_insert_participants" ON public.courier_messages;
CREATE POLICY "courier_messages_insert_participants"
ON public.courier_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_kind = 'user'
  AND sender_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.id = courier_messages.order_id
       AND (
         o.buyer_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM public.delivery_assignments a
            WHERE a.order_id = courier_messages.order_id
              AND a.courier_user_id = auth.uid()
         )
       )
  )
);













