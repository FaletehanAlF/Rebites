





ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_slug text;

CREATE INDEX IF NOT EXISTS idx_orders_product_slug ON public.orders(product_slug);

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS order_code text;


CREATE UNIQUE INDEX IF NOT EXISTS reviews_once_per_user_order
  ON public.reviews(user_id, order_code) WHERE order_code IS NOT NULL;
