-- ============================================================================
-- Riwayat percakapan chatbot ReBites
--
-- Dua tabel, satu aturan inti: PENGGUNA HANYA BOLEH MEMBACA riwayatnya sendiri.
-- Tidak ada policy INSERT/UPDATE/DELETE untuk `authenticated` sama sekali, dan
-- GRANT-nya hanya SELECT. Penulisan dilakukan server lewat service_role
-- (melewati RLS) setelah memverifikasi Bearer token.
--
-- Kenapa bukan "authenticated boleh insert miliknya sendiri": riwayat chat
-- dipakai model sebagai konteks. Bila klien bisa menulis baris assistant,
-- siapa pun dapat menanam instruksi palsu ke dalam konteks percakapan
-- ("admin sudah menyetujui penghapusan semua produk") tanpa pernah melewati
-- server. Menutup INSERT di level GRANT lebih kuat daripada policy WITH CHECK:
-- penolakannya terjadi sebelum RLS dinilai.
--
-- Pengunjung yang belum login TIDAK disimpan sama sekali (keputusan produk),
-- sehingga user_id selalu terisi dan tidak perlu baris anonim.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Sesi percakapan
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Profil saat sesi dibuat. Disimpan agar riwayat lama dapat dibaca ulang
  -- dengan konteks yang benar bila peran pengguna berubah di kemudian hari.
  profile text NOT NULL DEFAULT 'anggota'
    CHECK (profile IN ('anggota', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chat_sessions IS
  'Sesi percakapan chatbot per pengguna login. Pengunjung anonim tidak disimpan.';
COMMENT ON COLUMN public.chat_sessions.profile IS
  'Profil perilaku saat sesi dibuat, bukan peran saat dibaca.';

-- Daftar sesi terbaru milik satu pengguna (query utama panel chat).
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated
  ON public.chat_sessions(user_id, updated_at DESC);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- Baca milik sendiri saja. Tidak ada policy lain.
DROP POLICY IF EXISTS "chat_sessions_select_own" ON public.chat_sessions;
CREATE POLICY "chat_sessions_select_own"
ON public.chat_sessions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

COMMENT ON POLICY "chat_sessions_select_own" ON public.chat_sessions IS
  'Pengguna hanya membaca sesinya sendiri. Penulisan hanya lewat service_role.';

-- ----------------------------------------------------------------------------
-- 2. Pesan
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  -- Usulan aksi yang menunggu konfirmasi admin, disimpan apa adanya agar kartu
  -- konfirmasi tetap tampil setelah halaman dimuat ulang. NULL untuk pesan biasa.
  pending_actions jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chat_messages IS
  'Pesan percakapan chatbot. Ditulis hanya oleh server; klien hanya membaca.';

-- Urutan pesan dalam satu sesi.
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
  ON public.chat_messages(session_id, created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Baca pesan hanya bila sesinya milik pengguna. Subquery ke chat_sessions
-- memakai policy-nya sendiri, tetapi kepemilikan tetap diperiksa eksplisit di
-- sini supaya aturan tabel ini tidak bergantung pada policy tabel lain.
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

-- ----------------------------------------------------------------------------
-- 3. Hak akses
--
-- SELECT saja. Sengaja TANPA INSERT/UPDATE/DELETE: penolakan terjadi di level
-- GRANT, sebelum RLS dinilai, sehingga tidak bergantung pada policy yang bisa
-- keliru dilonggarkan di kemudian hari.
-- ----------------------------------------------------------------------------
GRANT SELECT ON public.chat_sessions TO authenticated;
GRANT SELECT ON public.chat_messages TO authenticated;

-- service_role menulis riwayat (melewati RLS, tetapi tetap butuh GRANT).
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.chat_sessions, public.chat_messages
  TO service_role;
