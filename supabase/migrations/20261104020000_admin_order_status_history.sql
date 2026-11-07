














DROP POLICY IF EXISTS "osh_select_admin" ON public.order_status_history;
CREATE POLICY "osh_select_admin"
ON public.order_status_history FOR SELECT
TO authenticated
USING (public.is_admin());

COMMENT ON POLICY "osh_select_admin" ON public.order_status_history IS
  'Admin dapat membaca seluruh riwayat status pesanan untuk penelusuran dan kontrol penuh.';
