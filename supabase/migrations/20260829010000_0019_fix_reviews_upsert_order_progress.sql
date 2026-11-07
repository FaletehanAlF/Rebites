













DROP INDEX IF EXISTS public.reviews_once_per_user_order;

CREATE UNIQUE INDEX IF NOT EXISTS reviews_user_order_code_once
  ON public.reviews(user_id, order_code);


ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS progress_status text
  CHECK (
    progress_status IN ('disiapkan', 'siap-diambil', 'diantar')
    OR progress_status IS NULL
  );

CREATE INDEX IF NOT EXISTS idx_orders_progress_status
  ON public.orders(progress_status);
