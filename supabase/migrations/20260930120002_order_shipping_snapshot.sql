-- ============================================================================
-- 7B-2D-5: Order Shipping Snapshot (immutable, server-authoritative)
-- TUJUAN:
--   Menyimpan snapshot data pengiriman saat order dibuat, supaya perubahan
--   data UMKM/product/address setelah checkout tidak mengubah informasi
--   shipping order lama.
-- SCOPE:
--   - orders: + shipping_snapshot jsonb (nullable, tanpa default/backfill)
-- PRINSIP:
--   - additive, tidak menghapus/mengubah kolom/data/RLS/policy/trigger lama
--   - NULL untuk order legacy (reader sudah NULL-safe)
--   - destination TIDAK diduplikasi (tetap di address_snapshot)
--   - courier/service/tracking TIDAK masuk snapshot (tahap Biteship)
--   - snapshot dibangun server-side dari database (bukan dari client)
-- STATUS: dibuat saja, JANGAN db push tanpa review (7B-2D-5).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Kolom snapshot shipping (struktur { origin, package }, lihat tipe
--    ShippingSnapshot di lib/types.ts)
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_snapshot jsonb;

COMMENT ON COLUMN public.orders.shipping_snapshot IS '7B-2D-5: snapshot imut {origin, package} saat checkout (server-side dari DB). NULL untuk order legacy. Tanpa courier/tracking.';

-- ----------------------------------------------------------------------------
-- 2. SENGAJA tidak diubah pada tahap ini:
--    - kolom existing (address_snapshot, vendor_*, distance_km, dsb.): utuh
--    - RLS / policy / trigger: tidak diubah (table-level, kolom baru ikut)
--    - backfill: tidak ada (order lama tetap NULL)
--    - courier / service / rate / tracking / shipment: di luar scope
-- ----------------------------------------------------------------------------
-- (Sengaja tidak ada CREATE POLICY / TRIGGER / UPDATE backfill baru.)
