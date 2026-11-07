








CREATE TABLE IF NOT EXISTS public.product_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_favorites_user_product_unique UNIQUE (user_id, product_id)
);

ALTER TABLE public.product_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_favorites_select_own" ON public.product_favorites;
CREATE POLICY "product_favorites_select_own"
ON public.product_favorites FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "product_favorites_insert_own" ON public.product_favorites;
CREATE POLICY "product_favorites_insert_own"
ON public.product_favorites FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "product_favorites_delete_own" ON public.product_favorites;
CREATE POLICY "product_favorites_delete_own"
ON public.product_favorites FOR DELETE
TO authenticated
USING (auth.uid() = user_id);


CREATE INDEX IF NOT EXISTS idx_product_favorites_user_id ON public.product_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_product_favorites_product_id ON public.product_favorites(product_id);
