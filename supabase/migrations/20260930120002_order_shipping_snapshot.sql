




















ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipping_snapshot jsonb;

COMMENT ON COLUMN public.orders.shipping_snapshot IS '7B-2D-5: snapshot imut {origin, package} saat checkout (server-side dari DB). NULL untuk order legacy. Tanpa courier/tracking.';









