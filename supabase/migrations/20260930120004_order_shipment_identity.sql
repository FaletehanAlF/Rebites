






















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










