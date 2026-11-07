

















CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  
  profile text NOT NULL DEFAULT 'anggota'
    CHECK (profile IN ('anggota', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chat_sessions IS
  'Sesi percakapan chatbot per pengguna login. Pengunjung anonim tidak disimpan.';
COMMENT ON COLUMN public.chat_sessions.profile IS
  'Profil perilaku saat sesi dibuat, bukan peran saat dibaca.';


CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated
  ON public.chat_sessions(user_id, updated_at DESC);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS "chat_sessions_select_own" ON public.chat_sessions;
CREATE POLICY "chat_sessions_select_own"
ON public.chat_sessions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

COMMENT ON POLICY "chat_sessions_select_own" ON public.chat_sessions IS
  'Pengguna hanya membaca sesinya sendiri. Penulisan hanya lewat service_role.';


CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  
  
  pending_actions jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chat_messages IS
  'Pesan percakapan chatbot. Ditulis hanya oleh server; klien hanya membaca.';


CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
  ON public.chat_messages(session_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;




DROP POLICY IF EXISTS "chat_messages_select_own" ON public.chat_messages;
CREATE POLICY "chat_messages_select_own"
ON public.chat_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chat_sessions s
    WHERE s.id = chat_messages.session_id
      AND s.user_id = auth.uid()
  )
);

COMMENT ON POLICY "chat_messages_select_own" ON public.chat_messages IS
  'Pengguna hanya membaca pesan dari sesi miliknya sendiri.';






GRANT SELECT ON public.chat_sessions TO authenticated;
GRANT SELECT ON public.chat_messages TO authenticated;


GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.chat_sessions, public.chat_messages
  TO service_role;
