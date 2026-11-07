


















ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS weight_gram integer,
  ADD COLUMN IF NOT EXISTS length_cm integer,
  ADD COLUMN IF NOT EXISTS width_cm integer,
  ADD COLUMN IF NOT EXISTS height_cm integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_weight_gram_positive'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_weight_gram_positive
      CHECK (weight_gram IS NULL OR weight_gram > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_length_cm_positive'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_length_cm_positive
      CHECK (length_cm IS NULL OR length_cm > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_width_cm_positive'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_width_cm_positive
      CHECK (width_cm IS NULL OR width_cm > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_height_cm_positive'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_height_cm_positive
      CHECK (height_cm IS NULL OR height_cm > 0);
  END IF;
END
$$;

COMMENT ON COLUMN public.products.weight_gram IS '7B-2A: berat produk gram, NULL untuk produk legacy. Tanpa default/fallback.';
COMMENT ON COLUMN public.products.length_cm IS '7B-2A: panjang kemasan cm, NULL untuk produk legacy.';
COMMENT ON COLUMN public.products.width_cm IS '7B-2A: lebar kemasan cm, NULL untuk produk legacy.';
COMMENT ON COLUMN public.products.height_cm IS '7B-2A: tinggi kemasan cm, NULL untuk produk legacy.';




DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_original_price_non_negative'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_original_price_non_negative
      CHECK (original_price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_surplus_price_non_negative'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_surplus_price_non_negative
      CHECK (surplus_price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_stock_non_negative'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_stock_non_negative
      CHECK (stock >= 0);
  END IF;
END
$$;







