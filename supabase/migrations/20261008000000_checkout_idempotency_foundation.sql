-- ============================================================================
-- Checkout idempotency foundation (Tahap 2D-E)
--
-- 1. orders.idempotency_key (nullable): kunci idempotensi per niat checkout,
--    di-scope per buyer (buyer_id + kunci) di logika API DAN di index.
--    NULL = order lama / jalur legacy tanpa kunci (tidak terdampak).
-- 2. orders.invoice_state (nullable): kondisi pembuatan invoice Xendit.
--    Nilai: not_started, inflight, unknown, attached, failed.
--    NULL = order lama / jalur legacy (diperlakukan seperti attached bila
--    xendit_invoice_id terisi, seperti not_started bila kosong).
-- 3. Partial UNIQUE index komposit (buyer_id, idempotency_key): satu kunci
--    hanya dapat menunjuk satu baris order PER BUYER — sama dengan cakupan
--    seluruh query API (selalu menyertakan buyer_id dari JWT). Konflik 23505
--    karena itu selalu berarti retry buyer yang sama (replay), bukan tabrakan
--    antar-buyer. Kunci dipakai ulang hanya untuk niat baru setelah baris lama
--    terminal dan kedaluwarsa (ditegakkan di API, bukan di constraint ini).
--
-- Kompatibilitas (diverifikasi terhadap migration existing):
-- - Baris lama: kedua kolom NULL -> CHECK/UNIQUE tidak tersentuh (partial
--   index mengabaikan NULL; CHECK lolos untuk NULL).
-- - Trigger P0-B (guard_orders_update + pelepasan stok tepat-1x) dan P1-A
--   (refund koin saat transisi ke buruk) bereaksi pada order_status /
--   payment_status, BUKAN pada kolom baru -> tidak ada pemicu palsu.
-- - RLS: kolom baru mengikuti policy baris yang sudah ada; service_role
--   (jalur checkout server) bypass seperti kolom lain.
-- - Query riwayat (select * / kolom eksplisit) tetap jalan; UI mengabaikan
--   kolom yang tidak dikenal.
--
-- URUTAN DEPLOY WAJIB: jalankan migration ini DAHULU di staging/prod,
-- baru deploy kode API yang membaca/menulis kolom baru. Kode API yang
-- menyertakan kolom ini akan ERROR terhadap database yang belum migrasi
-- (PostgREST unknown column).
--
-- Rollback migration: DROP INDEX + DROP COLUMN (kehilangan data kunci
-- idempotensi; baris order sendiri tidak berubah). Idempotent.
-- ============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS invoice_state text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.orders'::regclass
       AND conname = 'orders_invoice_state_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_invoice_state_check
      CHECK (invoice_state IS NULL OR invoice_state IN (
        'not_started', 'inflight', 'unknown', 'attached', 'failed'
      ));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_buyer_idempotency_key
  ON public.orders(buyer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.orders.idempotency_key IS
  'Tahap 2D-E: kunci idempotensi checkout per buyer (UUID dari client). NULL = legacy.';
COMMENT ON COLUMN public.orders.invoice_state IS
  'Tahap 2D-E: not_started/inflight/unknown/attached/failed. NULL = legacy. NULL + xendit_invoice_id NULL TIDAK berarti belum terbit.';
