-- =============================================================================
-- Kurir DEMO — untuk menguji alur pesanan sampai selesai
-- =============================================================================
--
-- MASALAH
-- Alur pesanan berhenti di "Pembayaran dikonfirmasi". Penugasan kurir otomatis
-- tidak menemukan kandidat karena belum ada satu pun kurir terdaftar, dan chat
-- "Chat dengan Kurir" tidak pernah dibalas karena tidak ada kurir yang
-- ditugaskan.
--
-- APA YANG DIUBAH
-- 1. `delivery_assignments.courier_user_id` boleh NULL, ditandai `is_demo`.
--    Kurir demo BUKAN akun pengguna: tidak ada auth.users di belakangnya.
-- 2. `courier_messages.sender_user_id` boleh NULL, dengan `sender_kind`
--    membedakan pesan pengguna dari balasan kurir demo.
--
-- KEJUJURAN
-- Baris demo SELALU `is_demo = true` / `sender_kind = 'demo_courier'`, dan UI
-- WAJIB memberi label "Kurir Demo" pada pesan maupun penugasannya. Membiarkan
-- pembeli mengira sedang mengobrol dengan orang sungguhan adalah kebohongan
-- yang tidak boleh disembunyikan di balik kolom database.
--
-- Jalankan: MIGRASI LOKAL. Belum diterapkan sampai pemanggil memutuskan.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Penugasan kurir demo
-- -----------------------------------------------------------------------------
-- `courier_user_id` menjadi NULL hanya untuk baris demo; penugasan nyata tetap
-- wajib mengisi kolom itu.
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

-- -----------------------------------------------------------------------------
-- 2. Pesan dari kurir demo
-- -----------------------------------------------------------------------------
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

  -- Pesan pengguna wajib punya pengirim; balasan demo tidak.
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

-- -----------------------------------------------------------------------------
-- 3. RLS: baris demo tidak boleh ditulis pengguna biasa
-- -----------------------------------------------------------------------------
-- Penulisan balasan demo hanya lewat service client di server. Policy INSERT
-- yang ada mensyaratkan `sender_user_id = auth.uid()`, dan itu tetap berlaku
-- untuk pesan pengguna — bukan untuk baris demo (yang sender_user_id-nya NULL).
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

-- -----------------------------------------------------------------------------
-- ROLLBACK (bila diperlukan, dijalankan owner):
--   DROP POLICY IF EXISTS "courier_messages_insert_participants" ON public.courier_messages;
--   (buat ulang policy versi 20261031010000)
--   ALTER TABLE public.courier_messages
--     DROP CONSTRAINT IF EXISTS courier_messages_sender_required,
--     DROP CONSTRAINT IF EXISTS courier_messages_sender_kind_check,
--     DROP COLUMN IF EXISTS sender_kind;
--   ALTER TABLE public.delivery_assignments
--     DROP CONSTRAINT IF EXISTS delivery_assignments_courier_required,
--     DROP COLUMN IF EXISTS is_demo;
-- =============================================================================
