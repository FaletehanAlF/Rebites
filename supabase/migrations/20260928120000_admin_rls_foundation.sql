

















CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin()
  TO anon, authenticated, service_role;




DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_admin());




DROP POLICY IF EXISTS "products_update_own" ON public.products;
CREATE POLICY "products_update_own_or_admin"
ON public.products FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.umkm_profiles u
    WHERE u.id = products.umkm_id AND u.user_id = auth.uid()
  )
  OR public.is_admin()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.umkm_profiles u
    WHERE u.id = products.umkm_id AND u.user_id = auth.uid()
  )
  OR public.is_admin()
);

DROP POLICY IF EXISTS "products_delete_own" ON public.products;
CREATE POLICY "products_delete_own_or_admin"
ON public.products FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.umkm_profiles u
    WHERE u.id = products.umkm_id AND u.user_id = auth.uid()
  )
  OR public.is_admin()
);




DROP POLICY IF EXISTS "umkm_update_own" ON public.umkm_profiles;
CREATE POLICY "umkm_update_own_or_admin"
ON public.umkm_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());




DROP POLICY IF EXISTS "subs_select_own" ON public.subscriptions;
CREATE POLICY "subs_select_own_or_admin"
ON public.subscriptions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.umkm_profiles u
    WHERE u.id = subscriptions.umkm_id AND u.user_id = auth.uid()
  )
  OR public.is_admin()
);

DROP POLICY IF EXISTS "subs_update_own" ON public.subscriptions;
CREATE POLICY "subs_update_own_or_admin"
ON public.subscriptions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.umkm_profiles u
    WHERE u.id = subscriptions.umkm_id AND u.user_id = auth.uid()
  )
  OR public.is_admin()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.umkm_profiles u
    WHERE u.id = subscriptions.umkm_id AND u.user_id = auth.uid()
  )
  OR public.is_admin()
);




DROP POLICY IF EXISTS "orders_select_participants" ON public.orders;
CREATE POLICY "orders_select_participants"
ON public.orders FOR SELECT
TO authenticated
USING (
  auth.uid() = buyer_id
  OR EXISTS (
    SELECT 1 FROM public.umkm_profiles u
    WHERE u.id = orders.umkm_id AND u.user_id = auth.uid()
  )
  OR public.is_admin()
);

DROP POLICY IF EXISTS "orders_update_participants" ON public.orders;
CREATE POLICY "orders_update_participants"
ON public.orders FOR UPDATE
TO authenticated
USING (
  auth.uid() = buyer_id
  OR EXISTS (
    SELECT 1 FROM public.umkm_profiles u
    WHERE u.id = orders.umkm_id AND u.user_id = auth.uid()
  )
  OR public.is_admin()
)
WITH CHECK (
  auth.uid() = buyer_id
  OR EXISTS (
    SELECT 1 FROM public.umkm_profiles u
    WHERE u.id = orders.umkm_id AND u.user_id = auth.uid()
  )
  OR public.is_admin()
);




DROP POLICY IF EXISTS "plans_insert_admin" ON public.plans;
CREATE POLICY "plans_insert_admin"
ON public.plans FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "plans_update_admin" ON public.plans;
CREATE POLICY "plans_update_admin"
ON public.plans FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "plans_delete_admin" ON public.plans;
CREATE POLICY "plans_delete_admin"
ON public.plans FOR DELETE
TO authenticated
USING (public.is_admin());




DROP POLICY IF EXISTS "promo_codes_admin_write" ON public.promo_codes;
CREATE POLICY "promo_codes_admin_write"
ON public.promo_codes FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
