



















ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS estimated_arrival_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_distance_km double precision,
  ADD COLUMN IF NOT EXISTS estimated_delivery_minutes integer;

COMMENT ON COLUMN public.orders.delivery_started_at IS '7B-2D-4: waktu kurir berangkat (dicatat saat out_for_delivery). NULL untuk order lama/belum diantar.';
COMMENT ON COLUMN public.orders.estimated_arrival_at IS '7B-2D-4: estimasi tiba dari distance_km valid. NULL jika jarak unknown (jangan karang ETA).';
COMMENT ON COLUMN public.orders.delivery_distance_km IS '7B-2D-4: jarak aktual saat out_for_delivery (salinan distance_km). NULL jika jarak unknown.';
COMMENT ON COLUMN public.orders.estimated_delivery_minutes IS '7B-2D-4: menit perjalanan dari calculateTravelMinutes. NULL jika jarak unknown.';









