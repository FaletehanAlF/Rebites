

















































ALTER TABLE public.products
  ALTER COLUMN verification_status SET DEFAULT 'approved';




DROP POLICY IF EXISTS "products_insert_own" ON public.products;
CREATE POLICY "products_insert_own"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.umkm_profiles u
    WHERE u.id = products.umkm_id AND u.user_id = auth.uid()
  )
  AND products.verification_status = 'approved'
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
    NEW.verification_status := 'approved';
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



























































DO $do$
DECLARE
  v_pending integer;
  v_trg text;
  v_disabled text[] := ARRAY[]::text[];
BEGIN
  SELECT count(*) INTO v_pending
    FROM public.products
   WHERE verification_status = 'pending';

  IF v_pending = 0 THEN
    RAISE NOTICE 'product_auto_approve: tidak ada produk pending; backfill dilewati.';
    RETURN;
  END IF;

  IF current_setting('rebites.backfill_pending_products', true) IS DISTINCT FROM 'on' THEN
    RAISE NOTICE
      'product_auto_approve: % produk masih pending. Backfill TIDAK dijalankan (opt-in). '
      'Tinjau manual dengan SELECT, lalu jalankan blok SQL mandiri yang dijelaskan '
      'di blok komentar migration ini. JANGAN menjalankan ulang file migration.',
      v_pending;
    RETURN;
  END IF;

  
  
  FOREACH v_trg IN ARRAY ARRAY[
    'trg_products_verification_update',
    'trg_products_activity_update',
    'trg_products_notify_verification'
  ] LOOP
    IF EXISTS (
      SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = 'products'
         AND t.tgname = v_trg
    ) THEN
      EXECUTE format('ALTER TABLE public.products DISABLE TRIGGER %I', v_trg);
      v_disabled := array_append(v_disabled, v_trg);
    END IF;
  END LOOP;

  UPDATE public.products
     SET verification_status = 'approved'
   WHERE verification_status = 'pending';

  FOREACH v_trg IN ARRAY v_disabled LOOP
    EXECUTE format('ALTER TABLE public.products ENABLE TRIGGER %I', v_trg);
  END LOOP;
  v_disabled := ARRAY[]::text[];

  RAISE NOTICE 'product_auto_approve: % produk pending dipromosikan menjadi approved.', v_pending;
EXCEPTION
  WHEN OTHERS THEN
    
    
    FOREACH v_trg IN ARRAY v_disabled LOOP
      EXECUTE format('ALTER TABLE public.products ENABLE TRIGGER %I', v_trg);
    END LOOP;
    RAISE;
END;
$do$;

COMMENT ON COLUMN public.products.verification_status IS
  'Auto-approve: produk baru langsung approved (post-publish monitoring). pending = antrean lama; rejected = takedown admin.';
