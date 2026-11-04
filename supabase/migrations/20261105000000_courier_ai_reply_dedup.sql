-- =============================================================================
-- Dedup balasan otomatis — reply_to_message_id
-- =============================================================================
--
-- MASALAH
-- Pembeli menekan kirim / retry / dua tab; polling & realtime tidak memanggil
-- ulang insert; tapi dua POST paralel untuk SATU pesan yang sama (atau dua
-- pesan double-submit) berpotensi memunculkan DUA balasan Kurir AI
-- untuk satu pertanyaan yang sama.
--
-- SOLUSI
-- 1. Kolom `reply_to_message_id` menunjuk pesan user pemicu (self-FK).
-- 2. Unique partial index: satu balasan otomatis (ai_courier / demo_courier)
--    per pesan pemicu. Insert kedua (retry/kebingungan klien) GAGAL di
--    database — server menangkap pelanggaran unik dan TIDAK menyisipkan
--    balasan kedua. Realtime/polling tidak menyisipkan apa pun.
--
-- TIDAK DIUBAH
-- - RLS insert courier_messages_insert_participants tetap hanya 'user'.
-- - Pesan ai_courier / demo_courier hanya bisa dibuat service client.
-- - Pesan user lama tidak terpengaruh (reply_to_message_id NULL diizinkan).
--
-- ROLLBACK (owner):
--   DROP INDEX IF EXISTS courier_messages_ai_reply_unique;
--   ALTER TABLE public.courier_messages DROP COLUMN IF EXISTS reply_to_message_id;
-- =============================================================================

ALTER TABLE public.courier_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid
    REFERENCES public.courier_messages(id) ON DELETE SET NULL;

-- Satu balasan otomatis per pesan pemicu (untuk baris yang baru saja dibuat).
CREATE UNIQUE INDEX IF NOT EXISTS courier_messages_ai_reply_unique
  ON public.courier_messages (reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL
    AND sender_kind IN ('ai_courier', 'demo_courier');

COMMENT ON COLUMN public.courier_messages.reply_to_message_id IS
  'Pesan user yang memicu balasan otomatis (ai_courier/demo_courier). NULL untuk pesan biasa.';
