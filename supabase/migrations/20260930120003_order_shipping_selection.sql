-- ============================================================================
-- 7C-1: Order Shipping Selection (pilihan kurir hasil rate Biteship)
-- TUJUAN:
--   Menyimpan pilihan courier/service/rate yang dipilih pembeli saat
--   checkout (hasil /api/shipping/rates, re-validasi server-side pada
--   tahap berikutnya). Kolom operasional, BUKAN snapshot imut.
-- SCOPE:
--   - orders: + courier_code, courier_service_code,
--               courier_service_name, shipping_rate (nullable)
-- PRINSIP:
--   - additive, tidak menghapus/mengubah kolom/data/RLS/policy/trigger lama
--   - semua kolom baru NULLABLE (order legacy/pickup tetap valid)
--   - tanpa default, tanpa backfill
--   - tracking/AWB/shipment_id/webhook: di luar scope (tahap berikutnya)
-- STATUS: dibuat saja, JANGAN db push tanpa review (7C-1).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Kolom pilihan kurir (NULL = belum memilih / pickup / order legacy)
-- ----------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_code text,
  ADD COLUMN IF NOT EXISTS courier_service_code text,
  ADD COLUMN IF NOT EXISTS courier_service_name text,
  ADD COLUMN IF NOT EXISTS shipping_rate integer;

COMMENT ON COLUMN public.orders.courier_code IS '7C-1: kode courier Biteship pilihan (mis. jne). NULL bila belum memilih/pickup/legacy.';
COMMENT ON COLUMN public.orders.courier_service_code IS '7C-1: kode service courier pilihan (mis. reg). NULL bila belum memilih/pickup/legacy.';
COMMENT ON COLUMN public.orders.courier_service_name IS '7C-1: nama service courier pilihan. NULL bila belum memilih/pickup/legacy.';
COMMENT ON COLUMN public.orders.shipping_rate IS '7C-1: ongkir pilihan (IDR, dari rate Biteship, re-validasi server). NULL bila belum memilih/pickup/legacy.';

-- ----------------------------------------------------------------------------
-- 2. SENGAJA tidak diubah pada tahap ini:
--    - kolom existing (delivery_fee flat, shipping_snapshot, dsb.): utuh
--    - RLS / policy / trigger: tidak diubah (table-level, kolom baru ikut)
--    - backfill: tidak ada
--    - tracking / AWB / shipment_id / webhook fields: tahap berikutnya
-- ----------------------------------------------------------------------------
-- (Sengaja tidak ada CREATE POLICY / TRIGGER / UPDATE backfill baru.)
