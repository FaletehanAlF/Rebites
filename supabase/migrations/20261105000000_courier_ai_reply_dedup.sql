-- =============================================================================
-- Dedup balasan otomatis + integritas rujukan - reply_to_message_id
-- =============================================================================
--
-- MASALAH
-- Pembeli menekan kirim / retry / dua tab; polling & realtime tidak memanggil
-- ulang insert; tapi dua POST paralel untuk SATU pesan yang sama berpotensi
-- memunculkan DUA balasan Kurir AI untuk satu pertanyaan yang sama.
--
-- SOLUSI (3 lapis)
-- 1. Kolom `reply_to_message_id` menunjuk pesan user pemicu.
-- 2. Komposit FK `(reply_to_message_id, order_id) -> courier_messages(id,
--    order_id)`: rujukan WAJIB berada di pesanan yang sama. Versi awal
--    migrasi ini hanya FK ke `id`, yang secara schema masih memungkinkan
--    rujukan lintas pesanan; kini ditutup di level database.
-- 3. CHECK `courier_messages_reply_to_automated_check`: HANYA balasan
--    otomatis (ai_courier / demo_courier) yang boleh mengisi kolom ini - pesan
--    `user` tidak bisa memalsukan tautan balikan (melalui REST Supabase pun).
-- 4. Unique partial index: satu balasan otomatis per pesan pemicu. Insert
--    kedua (retry / dua request bersamaan) GAGAL di database (23505); server
--    menangkapnya dan TIDAK menyisipkan balasan kedua.
--
-- KOMPATIBILITAS POSTGRES (Supabase)
-- Komposit FK sendiri didukung sejak lama. Yang memerlukan PostgreSQL 15+
-- hanyalah `ON DELETE SET NULL (reply_to_message_id)` - varian "nolkan kolom
-- tertentu" yang dibutuhkan agar menghapus pesan pemicu TIDAK ikut menolkan
-- `order_id` milik baris balasan (organic NOT NULL). Supabase menjalankan
-- PostgreSQL 15/17 (2024-2026). Blok di bawah menolak dengan pesan jelas bila
-- engine lebih tua dari PG 15, bukan gagal semu.
--
-- TIDAK DIUBAH
-- - RLS insert `courier_messages_insert_participants` tetap hanya 'user' +
--   peserta pesanan; tidak ada policy yang dilonggarkan di file ini.
-- - Pesan ai_courier / demo_courier hanya dibuat service client (server).
-- - Pesan user lama tidak terpengaruh (reply_to_message_id NULL diizinkan).
--
-- ROLLBACK (owner):
--   DROP INDEX IF EXISTS courier_messages_ai_reply_unique;
--   DROP INDEX IF EXISTS courier_messages_id_order_id_key;
--   ALTER TABLE public.courier_messages
--     DROP CONSTRAINT IF EXISTS courier_messages_reply_same_order_fkey,
--     DROP CONSTRAINT IF EXISTS courier_messages_reply_to_automated_check,
--     DROP COLUMN IF EXISTS reply_to_message_id;
-- =============================================================================

-- 1. Kolom rujukan.
ALTER TABLE public.courier_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid;

-- 2. FK komposit + prasyarat unique (id, order_id). Wajib PG 15+.
DO $$
BEGIN
  IF current_setting('server_version_num')::int < 150000 THEN
    RAISE EXCEPTION
      'Migrasi 20261105000000 butuh PostgreSQL 15+ (ON DELETE SET NULL dengan daftar kolom). Engine ini %.',
      current_setting('server_version_num')::int;
  END IF;

  -- Prasyarat FK komposit: keunikan (id, order_id). id sudah PK, jadi indeks
  -- ini tidak mengubah keunikan apa pun - hanya memenuhi sisi REFERENCED.
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

-- 3. Hanya balasan otomatis yang boleh mengisi reply_to_message_id.
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

-- 4. Dedup: maksimal SATU balasan otomatis per pesan pemicu (ai ATAU demo).
CREATE UNIQUE INDEX IF NOT EXISTS courier_messages_ai_reply_unique
  ON public.courier_messages (reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL
    AND sender_kind IN ('ai_courier', 'demo_courier');

COMMENT ON COLUMN public.courier_messages.reply_to_message_id IS
  'Pesan user yang memicu balasan otomatis (ai_courier/demo_courier); WAJIB dalam pesanan yang sama dan HANYA diisi balasan otomatis. NULL untuk pesan biasa.';
