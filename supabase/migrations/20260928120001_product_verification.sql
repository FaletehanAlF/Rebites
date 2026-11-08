









































ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_verification_status
  ON public.products(verification_status);




UPDATE public.products
SET verification_status = 'approved'
WHERE verification_status = 'pending'
  AND created_at < '2026-09-28T12:00:01Z'::timestamptz;




CREATE TABLE IF NOT EXISTS public.moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  moderator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('approve', 'reject')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_moderation_logs_product_id
  ON public.moderation_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_moderator_id
  ON public.moderation_logs(moderator_id);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.moderation_logs TO authenticated, service_role;




DROP POLICY IF EXISTS "moderation_logs_select_admin_or_owner" ON public.moderation_logs;
CREATE POLICY "moderation_logs_select_admin_or_owner"
ON public.moderation_logs FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.umkm_profiles u ON u.id = p.umkm_id
    WHERE p.id = moderation_logs.product_id
      AND u.user_id = auth.uid()
  )
);



DROP POLICY IF EXISTS "moderation_logs_admin_insert" ON public.moderation_logs;
CREATE POLICY "moderation_logs_admin_insert"
ON public.moderation_logs FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "moderation_logs_admin_update" ON public.moderation_logs;
CREATE POLICY "moderation_logs_admin_update"
ON public.moderation_logs FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "moderation_logs_admin_delete" ON public.moderation_logs;
CREATE POLICY "moderation_logs_admin_delete"
ON public.moderation_logs FOR DELETE
TO authenticated
USING (public.is_admin());




DROP POLICY IF EXISTS "products_insert_own" ON public.products;
CREATE POLICY "products_insert_own"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.umkm_profiles u
    WHERE u.id = products.umkm_id AND u.user_id = auth.uid()
  )
  AND products.verification_status = 'pending'
  AND products.reviewed_at IS NULL
  AND products.reviewed_by IS NULL
  AND products.rejection_reason IS NULL
);










CREATE OR REPLACE FUNCTION public.enforce_product_verification_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.verification_status := 'pending';
    NEW.reviewed_at := NULL;
    NEW.reviewed_by := NULL;
    NEW.rejection_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_verification_insert ON public.products;
CREATE TRIGGER trg_products_verification_insert
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_verification_on_insert();

CREATE OR REPLACE FUNCTION public.enforce_product_verification_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.verification_status := OLD.verification_status;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.rejection_reason := OLD.rejection_reason;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_verification_update ON public.products;
CREATE TRIGGER trg_products_verification_update
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_verification_on_update();












