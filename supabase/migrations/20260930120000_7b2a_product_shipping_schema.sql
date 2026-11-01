-- ============================================================================
-- 7B-2A: Product Shipping Schema (berat + dimensi + guard harga/stok)
-- SCOPE:
--   - products: + weight_gram, length_cm, width_cm, height_cm (nullable)
--   - CHECK positif untuk 4 kolom baru (NULL lolos untuk produk legacy)
--   - CHECK >= 0 untuk original_price, surplus_price, stock
--     (audit remote 2026-09-29: 50 produk, nihil nilai negatif -> aman)
-- PRINSIP:
--   - additive, tidak menghapus kolom/data lama
--   - semua kolom baru NULLABLE, tanpa DEFAULT, tanpa backfill buatan
--     (jangan isi 500 gram / angka buatan untuk data lama)
--   - tidak menyentuh RLS, verification, moderation, payment, address
--   - tidak menyentuh is_delivery/is_pickup behavior
-- STATUS: dibuat saja, JANGAN dijalankan ke Supabase remote dulu (7B-2A).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Kolom shipping baru (satuan gram / cm, NULL = belum diketahui)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 2. Guard harga/stok non-negatif (kolom NOT NULL, audit nihil negatif)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 3. discount_percent: SENGAJA tidak diubah pada tahap ini
--    (integer NOT NULL DEFAULT 0, tanpa CHECK; di luar scope 7B-2A).
-- 4. RLS / verification / moderation / payment / address: tidak diubah.
-- ----------------------------------------------------------------------------
-- (Sengaja tidak ada CREATE POLICY / TRIGGER baru.)
