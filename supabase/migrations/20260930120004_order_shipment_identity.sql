-- ============================================================================
-- 7C-3C-1: Shipment Database Foundation (identitas/status shipment Biteship)
-- TUJUAN:
--   Menyimpan identitas dan status shipment Biteship per order.
--   Kolom operasional (mutable via shipment service / webhook), BUKAN
--   snapshot imut (lihat shipping_snapshot 7B-2D-5).
-- SCOPE:
--   - orders: + biteship_order_id, biteship_tracking_id, biteship_waybill_id,
--               shipment_status, shipment_created_at, shipment_error
-- PRINSIP:
--   - additive, tidak menghapus/mengubah kolom/data/RLS/policy/trigger lama
--   - semua kolom baru NULLABLE (order legacy/pickup tetap valid)
--   - tanpa default, tanpa backfill
--   - tanpa CHECK status (nilai status mengikuti API Biteship; validasi di app)
--   - tanpa UNIQUE constraint pada tahap ini (kebutuhan recovery duplikat
--     via reference_id + guard kolom dibahas saat shipment service)
--   - tidak menyentuh order_status / lifecycle / progress_status
--   - tidak menyentuh courier selection / snapshot / address / pricing
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Kolom identitas/status shipment (NULL = belum ada shipment)
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS biteship_order_id text,
  ADD COLUMN IF NOT EXISTS biteship_tracking_id text,
  ADD COLUMN IF NOT EXISTS biteship_waybill_id text,
  ADD COLUMN IF NOT EXISTS shipment_status text,
  ADD COLUMN IF NOT EXISTS shipment_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipment_error text;

COMMENT ON COLUMN public.orders.biteship_order_id IS '7C-3C-1: ID order Biteship (response POST /v1/orders). NULL bila shipment belum dibuat. Guard idempotency create shipment.';
COMMENT ON COLUMN public.orders.biteship_tracking_id IS '7C-3C-1: tracking ID Biteship (courier.tracking_id). Dipakai GET /v1/trackings/:id.';
COMMENT ON COLUMN public.orders.biteship_waybill_id IS '7C-3C-1: nomor AWB/waybill (courier.waybill_id). NULL hingga tersedia.';
COMMENT ON COLUMN public.orders.shipment_status IS '7C-3C-1: status shipment Biteship terakhir (mis. confirmed/delivered). Tanpa CHECK; validasi di app.';
COMMENT ON COLUMN public.orders.shipment_created_at IS '7C-3C-1: waktu shipment berhasil dibuat di Biteship.';
COMMENT ON COLUMN public.orders.shipment_error IS '7C-3C-1: pesan error terakhir create/update shipment (untuk bedakan gagal vs belum dibuat).';

-- ----------------------------------------------------------------------------
-- 2. SENGAJA tidak diubah pada tahap ini:
--    - kolom existing (order_status, lifecycle, snapshot, kurir, dsb.): utuh
--    - RLS / policy / trigger: tidak diubah (table-level, kolom baru ikut)
--    - backfill: tidak ada
--    - UNIQUE constraint biteship_order_id: ditunda (lihat header)
--    - shipment service / webhook / tracking UI: tahap berikutnya
-- ----------------------------------------------------------------------------
-- (Sengaja tidak ada CREATE POLICY / TRIGGER / UPDATE backfill baru.)
