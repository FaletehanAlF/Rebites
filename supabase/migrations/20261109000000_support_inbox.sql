


























CREATE TABLE IF NOT EXISTS public.support_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  
  
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  
  
  origin text NOT NULL DEFAULT 'chat' CHECK (origin IN ('chat', 'banding')),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_sender_kind text CHECK (last_sender_kind IN ('user', 'admin', 'system')),
  
  
  last_message_preview text,
  
  
  admin_unread_count integer NOT NULL DEFAULT 0 CHECK (admin_unread_count >= 0),
  user_unread_count integer NOT NULL DEFAULT 0 CHECK (user_unread_count >= 0),
  admin_read_at timestamptz,
  user_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);




ALTER TABLE public.support_threads
  DROP CONSTRAINT IF EXISTS support_threads_profile_id_key;
ALTER TABLE public.support_threads
  ADD CONSTRAINT support_threads_profile_id_key UNIQUE (profile_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_threads_anon_email
  ON public.support_threads (lower(email))
  WHERE profile_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_support_threads_unread
  ON public.support_threads (admin_unread_count DESC, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_threads_activity
  ON public.support_threads (last_message_at DESC);

ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_threads_select_own_or_admin" ON public.support_threads;
CREATE POLICY "support_threads_select_own_or_admin"
ON public.support_threads FOR SELECT
TO authenticated
USING (profile_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "support_threads_update_admin" ON public.support_threads;
CREATE POLICY "support_threads_update_admin"
ON public.support_threads FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  sender_kind text NOT NULL CHECK (sender_kind IN ('user', 'admin', 'system')),
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  
  
  channel text NOT NULL CHECK (channel IN ('app', 'banding', 'admin', 'system')),
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_thread
  ON public.support_messages (thread_id, created_at);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_messages_select_participants" ON public.support_messages;
CREATE POLICY "support_messages_select_participants"
ON public.support_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
      FROM public.support_threads t
     WHERE t.id = support_messages.thread_id
       AND (t.profile_id = auth.uid() OR public.is_admin())
  )
);

CREATE TABLE IF NOT EXISTS public.support_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  
  
  
  code text NOT NULL UNIQUE CHECK (char_length(code) BETWEEN 8 AND 32),
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 2000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewing', 'approved', 'rejected')),
  decision_note text,
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at timestamptz,
  
  
  follow_up_count integer NOT NULL DEFAULT 0 CHECK (follow_up_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS idx_support_appeals_email_created
  ON public.support_appeals (lower(email), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_appeals_thread
  ON public.support_appeals (thread_id, created_at DESC);

ALTER TABLE public.support_appeals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_appeals_select_admin" ON public.support_appeals;
CREATE POLICY "support_appeals_select_admin"
ON public.support_appeals FOR SELECT
TO authenticated
USING (public.is_admin());






REVOKE ALL ON public.support_threads, public.support_messages, public.support_appeals
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.support_threads, public.support_messages, public.support_appeals
  TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.support_threads, public.support_messages, public.support_appeals
  TO service_role;

COMMENT ON TABLE public.support_threads IS
  'Percakapan pesan antara pengguna dan admin ReBites. Satu percakapan per akun; banding dari akun terblokir memakai percakapan yang sama.';
COMMENT ON TABLE public.support_messages IS
  'Pesan percakapan. Ditulis hanya oleh server; klien hanya membaca.';
COMMENT ON TABLE public.support_appeals IS
  'Banding akun terblokir beserta kode status yang disimpan pengaju. Terbaca admin saja.';


CREATE OR REPLACE FUNCTION public.apply_support_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sender_kind = 'user' THEN
    UPDATE public.support_threads
       SET last_message_at = NEW.created_at,
           last_sender_kind = NEW.sender_kind,
           last_message_preview = left(NEW.body, 140),
           admin_unread_count = admin_unread_count + 1,
           
           
           
           status = 'open',
           updated_at = now()
     WHERE id = NEW.thread_id;
  ELSIF NEW.sender_kind IN ('admin', 'system') THEN
    UPDATE public.support_threads
       SET last_message_at = NEW.created_at,
           last_sender_kind = NEW.sender_kind,
           last_message_preview = left(NEW.body, 140),
           user_unread_count = user_unread_count + 1,
           updated_at = now()
     WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_support_message_counters ON public.support_messages;
CREATE TRIGGER trg_support_message_counters
  AFTER INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.apply_support_message();



CREATE OR REPLACE FUNCTION public.mark_support_thread_read(p_thread uuid, p_side text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_thread IS NULL THEN
    RAISE EXCEPTION 'p_thread wajib diisi.' USING ERRCODE = '22023';
  END IF;

  IF p_side = 'user' THEN
    UPDATE public.support_threads
       SET user_unread_count = 0,
           user_read_at = now()
     WHERE id = p_thread
       AND profile_id = auth.uid();
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Percakapan tidak ditemukan.' USING ERRCODE = '42501';
    END IF;
    RETURN;
  END IF;

  IF p_side = 'admin' THEN
    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Akses ditolak: hanya admin yang dapat menandai baca sisi admin.'
        USING ERRCODE = '42501';
    END IF;
    UPDATE public.support_threads
       SET admin_unread_count = 0,
           admin_read_at = now()
     WHERE id = p_thread;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Percakapan tidak ditemukan.' USING ERRCODE = '42501';
    END IF;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Sisi tidak dikenal: %', p_side USING ERRCODE = '22023';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_support_thread_read(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_support_thread_read(uuid, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.mark_support_thread_read(uuid, text) IS
  'Menandai percakapan sudah dibaca pada satu sisi (user/admin) dan mengosongkan penghitung sisi itu.';




CREATE OR REPLACE FUNCTION public.create_support_appeal(
  p_email text,
  p_message text,
  p_profile_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(btrim(p_email));
  v_message text := btrim(p_message);
  v_thread_id uuid;
  v_code text;
  v_recent integer;
  v_appeal_id uuid;
  v_lock_key bigint;
BEGIN
  IF NOT (
    (auth.jwt() ->> 'role') = 'service_role'
    OR session_user LIKE 'postgres%'
    OR session_user LIKE 'supabase_admin%'
  ) THEN
    RAISE EXCEPTION 'Akses ditolak: banding hanya dapat dibuat server.'
      USING ERRCODE = '42501';
  END IF;

  IF v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN jsonb_build_object('result', 'invalid_email');
  END IF;
  IF char_length(v_message) = 0 OR char_length(v_message) > 2000 THEN
    RETURN jsonb_build_object('result', 'invalid_message');
  END IF;

  
  
  v_lock_key := ('x' || substr(md5('support_appeal:' || v_email), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT count(*) INTO v_recent
    FROM public.support_appeals a
   WHERE lower(a.email) = v_email
     AND a.created_at > now() - interval '1 hour';
  IF v_recent >= 3 THEN
    RETURN jsonb_build_object('result', 'rate_limited');
  END IF;

  
  
  IF p_profile_id IS NOT NULL THEN
    SELECT id INTO v_thread_id
      FROM public.support_threads t
     WHERE t.profile_id = p_profile_id;
  ELSE
    SELECT id INTO v_thread_id
      FROM public.support_threads t
     WHERE t.profile_id IS NULL
       AND lower(t.email) = v_email;
  END IF;

  IF v_thread_id IS NULL THEN
    INSERT INTO public.support_threads (profile_id, email, origin)
    VALUES (p_profile_id, v_email, 'banding')
    RETURNING id INTO v_thread_id;
  END IF;

  INSERT INTO public.support_messages (thread_id, sender_kind, channel, body)
  VALUES (v_thread_id, 'user', 'banding', v_message);

  
  
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  INSERT INTO public.support_appeals (thread_id, email, code, message)
  VALUES (v_thread_id, v_email, v_code, v_message)
  RETURNING id INTO v_appeal_id;

  RETURN jsonb_build_object(
    'result', 'created',
    'appeal_id', v_appeal_id,
    'thread_id', v_thread_id,
    'code', v_code
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_support_appeal(text, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_support_appeal(text, text, uuid)
  TO service_role;

COMMENT ON FUNCTION public.create_support_appeal(text, text, uuid) IS
  'Membuat banding akun terblokir: batas 3/email/jam, percakapan dipakai ulang, dan kode status dikembalikan. Hanya service_role.';



CREATE OR REPLACE FUNCTION public.append_appeal_followup(p_code text, p_message text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.support_appeals%ROWTYPE;
  v_message text := btrim(p_message);
BEGIN
  IF NOT (
    (auth.jwt() ->> 'role') = 'service_role'
    OR session_user LIKE 'postgres%'
    OR session_user LIKE 'supabase_admin%'
  ) THEN
    RAISE EXCEPTION 'Akses ditolak: hanya server yang dapat menambah pesan banding.'
      USING ERRCODE = '42501';
  END IF;

  IF char_length(v_message) = 0 OR char_length(v_message) > 2000 THEN
    RETURN 'invalid_message';
  END IF;

  SELECT * INTO v_row
    FROM public.support_appeals a
   WHERE a.code = upper(btrim(p_code))
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  IF v_row.follow_up_count >= 20 THEN
    RETURN 'limit';
  END IF;

  INSERT INTO public.support_messages (thread_id, sender_kind, channel, body)
  VALUES (v_row.thread_id, 'user', 'banding', v_message);

  UPDATE public.support_appeals
     SET follow_up_count = follow_up_count + 1,
         updated_at = now()
   WHERE id = v_row.id;

  RETURN 'ok';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.append_appeal_followup(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_appeal_followup(text, text)
  TO service_role;




DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'support_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'support_threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_threads;
  END IF;
END $$;
