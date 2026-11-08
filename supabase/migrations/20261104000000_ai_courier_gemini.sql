-- =============================================================================
-- Kurir AI (Gemini) -- balasan otomatis untuk pesanan DEMO saja
-- =============================================================================
--
-- APA YANG DIUBAH
-- 1. `courier_messages.sender_kind` kini menerima nilai `ai_courier`.
-- 2. Constraint pengirim `courier_messages_sender_required` diperluas:
--      user         -> sender_user_id WAJIB diisi
--      demo_courier -> sender_user_id NULL
--      ai_courier   -> sender_user_id NULL
-- 3. Komentar kolom diperbarui agar makna ai_courier terbaca jelas.
--
-- TIDAK DIUBAH
-- - RLS courier_messages_insert_participants TETAP hanya menerima
--   baris dengan sender_kind = 'user' dan sender_user_id = auth.uid().
--   Baris ai_courier HANYA dapat dibuat lewat service client di server.
--   Pengguna TIDAK dapat menyamar sebagai Kurir AI.
-- - Trigger/constraint courier_messages_sender_kind_check versi lama
--   digantikan versi yang memuat 'ai_courier'. Data lama (user/demo_courier)
--   tetap valid.
-- - Realtime (supabase_realtime) sudah memuat courier_messages; tidak perlu
--   diubah. Pesan ai_courier terlihat oleh peserta lewat policy SELECT yang
--   sudah ada.
--
-- ROLLBACK (dijalankan owner):
--   DROP POLICY IF EXISTS "courier_messages_insert_participants" ON public.courier_messages;
--   (buat ulang policy versi 20261031020000_demo_courier.sql)
--   ALTER TABLE public.courier_messages
--     DROP CONSTRAINT IF EXISTS courier_messages_sender_required,
--     DROP CONSTRAINT IF EXISTS courier_messages_sender_kind_check,
--     ADD CONSTRAINT courier_messages_sender_kind_check CHECK (sender_kind IN ('user', 'demo_courier')),
--     ADD CONSTRAINT courier_messages_sender_required CHECK (
--       (sender_kind = 'user' AND sender_user_id IS NOT NULL)
--       OR (sender_kind = 'demo_courier' AND sender_user_id IS NULL)
--     );
-- =============================================================================

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
