






















ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_products_deleted_at
  ON public.products(deleted_at);

COMMENT ON COLUMN public.products.deleted_at IS
  'NULL = produk aktif. Terisi = ditarik penjual (soft delete): disembunyikan dari pembeli dan dari daftar menu penjual, tetapi tetap terbaca admin untuk penelusuran.';




DROP POLICY IF EXISTS "products_select_public" ON public.products;
CREATE POLICY "products_select_public"
ON public.products FOR SELECT
TO anon, authenticated
USING (
  products.verification_status = 'approved'
  AND products.deleted_at IS NULL
);





DROP POLICY IF EXISTS "products_select_own" ON public.products;
CREATE POLICY "products_select_own"
ON public.products FOR SELECT
TO authenticated
USING (
  products.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.umkm_profiles u
    WHERE u.id = products.umkm_id AND u.user_id = auth.uid()
  )
);




COMMENT ON POLICY "products_select_public" ON public.products IS
  'Hanya produk approved dan belum dihapus yang terlihat publik (anon + authenticated).';
COMMENT ON POLICY "products_select_own" ON public.products IS
  'Pemilik toko membaca semua status produknya sendiri yang belum dihapus, termasuk rejected beserta rejection_reason.';
