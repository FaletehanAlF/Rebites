


























































DROP POLICY IF EXISTS "reports_insert_requires_order_relation" ON public.reports;

CREATE POLICY "reports_insert_requires_order_relation"
ON public.reports
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR (
    auth.uid() = reported_by
    AND reports.reported_user_id IS NOT NULL
    AND reports.reported_user_id <> auth.uid()
    AND (
      
      EXISTS (
        SELECT 1
          FROM public.orders o
          JOIN public.umkm_profiles u ON u.id = o.umkm_id
         WHERE o.buyer_id = auth.uid()
           AND u.user_id = reports.reported_user_id
      )
      
      OR EXISTS (
        SELECT 1
          FROM public.orders o
          JOIN public.umkm_profiles u ON u.slug = o.vendor_slug
         WHERE o.buyer_id = auth.uid()
           AND u.user_id = reports.reported_user_id
      )
    )
  )
);

COMMENT ON POLICY "reports_insert_requires_order_relation" ON public.reports IS
  'NOTIF-1H: non-admin hanya boleh membuat laporan terhadap pemilik toko yang punya pesanan dengan pelapor (umkm_id atau vendor_slug). Admin dikecualikan. Policy RESTRICTIVE, di-AND dengan reports_insert_own_or_admin yang tidak diubah.';
