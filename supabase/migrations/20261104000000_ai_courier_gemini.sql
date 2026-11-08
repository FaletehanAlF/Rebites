

































ALTER TABLE public.courier_messages
  DROP CONSTRAINT IF EXISTS courier_messages_sender_kind_check;

ALTER TABLE public.courier_messages
  ADD CONSTRAINT courier_messages_sender_kind_check
    CHECK (sender_kind IN ('user', 'demo_courier', 'ai_courier'));

ALTER TABLE public.courier_messages
  DROP CONSTRAINT IF EXISTS courier_messages_sender_required;

ALTER TABLE public.courier_messages
  ADD CONSTRAINT courier_messages_sender_required
    CHECK (
      (sender_kind = 'user' AND sender_user_id IS NOT NULL)
      OR (sender_kind IN ('demo_courier', 'ai_courier') AND sender_user_id IS NULL)
    );

COMMENT ON COLUMN public.courier_messages.sender_kind IS
  'user = pengguna sungguhan; demo_courier = balasan Kurir Demo (deterministik); ai_courier = balasan AI (Gemini) untuk pesanan demo.';
