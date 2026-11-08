














































































DROP POLICY IF EXISTS "products_select_public" ON public.products;
CREATE POLICY "products_select_public"
ON public.products FOR SELECT
TO anon, authenticated
USING (products.verification_status = 'approved');




DROP POLICY IF EXISTS "products_select_admin" ON public.products;
CREATE POLICY "products_select_admin"
ON public.products FOR SELECT
TO authenticated
USING (public.is_admin());





DROP POLICY IF EXISTS "products_select_own" ON public.products;
CREATE POLICY "products_select_own"
ON public.products FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.umkm_profiles u
    WHERE u.id = products.umkm_id AND u.user_id = auth.uid()
  )
);










DROP POLICY IF EXISTS "products_select_any" ON public.products;
DROP POLICY IF EXISTS "products_select_all" ON public.products;
DROP POLICY IF EXISTS "products_select_buyer" ON public.products;

COMMENT ON POLICY "products_select_public" ON public.products IS
  'Hanya produk approved yang terlihat publik (anon + authenticated). Ditutup 20261011000000; sebelumnya USING (true) sehingga produk pending/rejected bocor lewat REST.';
COMMENT ON POLICY "products_select_admin" ON public.products IS
  'Admin membaca seluruh produk untuk moderasi, termasuk pending/rejected.';
COMMENT ON POLICY "products_select_own" ON public.products IS
  'Pemilik toko membaca semua status produknya sendiri (Menu Saya), termasuk rejected beserta rejection_reason.';