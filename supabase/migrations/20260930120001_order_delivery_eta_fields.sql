-- ============================================================================
-- 7B-2D-4: Order Delivery ETA Fields (perbaikan schema mismatch)
-- TEMUAN 7B-2D-3:
--   - lib/order-state-machine.ts saat out_for_delivery menulis:
--       delivery_started_at, estimated_arrival_at,
--       delivery_distance_km, estimated_delivery_minutes
--   - keempat kolom tersebut BELUM ADA di public.orders (remote),
--     sehingga transisi ke out_for_delivery berpotensi gagal via PostgREST.
-- SCOPE:
--   - orders: + 4 kolom ETA (nullable, tanpa default, tanpa backfill)
-- PRINSIP:
--   - additive, tidak menghapus/mengubah kolom/data/RLS/policy yang ada
--   - semua kolom baru NULLABLE (order lama tetap valid, tanpa angka palsu)
--   - tidak menyentuh lifecycle, payment, shipment, courier, tracking
-- STATUS: dibuat saja, JANGAN db push tanpa review (7B-2D-4).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Kolom ETA delivery (NULL = belum ada pengiriman / jarak unknown)
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS estimated_arrival_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_distance_km double precision,
  ADD COLUMN IF NOT EXISTS estimated_delivery_minutes integer;

COMMENT ON COLUMN public.orders.delivery_started_at IS '7B-2D-4: waktu kurir berangkat (dicatat saat out_for_delivery). NULL untuk order lama/belum diantar.';
COMMENT ON COLUMN public.orders.estimated_arrival_at IS '7B-2D-4: estimasi tiba dari distance_km valid. NULL jika jarak unknown (jangan karang ETA).';
COMMENT ON COLUMN public.orders.delivery_distance_km IS '7B-2D-4: jarak aktual saat out_for_delivery (salinan distance_km). NULL jika jarak unknown.';
COMMENT ON COLUMN public.orders.estimated_delivery_minutes IS '7B-2D-4: menit perjalanan dari calculateTravelMinutes. NULL jika jarak unknown.';

-- ----------------------------------------------------------------------------
-- 2. SENGAJA tidak diubah pada tahap ini:
--    - kolom existing (order_status, distance_km, dsb.): tidak disentuh
--    - RLS / policy: tidak diubah (table-level, kolom baru otomatis ikut)
--    - backfill: tidak ada (order lama tetap NULL, reader sudah NULL-safe)
--    - courier / tracking / shipment / shipping_snapshot: di luar scope
-- ----------------------------------------------------------------------------
-- (Sengaja tidak ada CREATE POLICY / TRIGGER / UPDATE backfill baru.)
