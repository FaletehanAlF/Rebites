ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS scheduled_start timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_end timestamptz;

CREATE INDEX IF NOT EXISTS idx_products_scheduled_start ON public.products(scheduled_start) WHERE scheduled_start IS NOT NULL;
