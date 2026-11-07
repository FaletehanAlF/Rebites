










































ALTER TABLE public.courier_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid;


DO $$
BEGIN
  IF current_setting('server_version_num')::int < 150000 THEN
    RAISE EXCEPTION
      'Migrasi 20261105000000 butuh PostgreSQL 15+ (ON DELETE SET NULL dengan daftar kolom). Engine ini %.',
      current_setting('server_version_num')::int;
  END IF;

  
  
  CREATE UNIQUE INDEX IF NOT EXISTS courier_messages_id_order_id_key
    ON public.courier_messages (id, order_id);

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'courier_messages_reply_same_order_fkey'
       AND conrelid = 'public.courier_messages'::regclass
  ) THEN
    ALTER TABLE public.courier_messages
      ADD CONSTRAINT courier_messages_reply_same_order_fkey
      FOREIGN KEY (reply_to_message_id, order_id)
        REFERENCES public.courier_messages (id, order_id)
        ON DELETE SET NULL (reply_to_message_id);
  END IF;
END $$;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'courier_messages_reply_to_automated_check'
       AND conrelid = 'public.courier_messages'::regclass
  ) THEN
    ALTER TABLE public.courier_messages
      ADD CONSTRAINT courier_messages_reply_to_automated_check
      CHECK (
        reply_to_message_id IS NULL
        OR sender_kind IN ('ai_courier', 'demo_courier')
      );
  END IF;
END $$;


CREATE UNIQUE INDEX IF NOT EXISTS courier_messages_ai_reply_unique
  ON public.courier_messages (reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL
    AND sender_kind IN ('ai_courier', 'demo_courier');

COMMENT ON COLUMN public.courier_messages.reply_to_message_id IS
  'Pesan user yang memicu balasan otomatis (ai_courier/demo_courier); WAJIB dalam pesanan yang sama dan HANYA diisi balasan otomatis. NULL untuk pesan biasa.';
