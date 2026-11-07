












ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS xendit_invoice_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_xendit_invoice
  ON public.orders(xendit_invoice_id)
  WHERE xendit_invoice_id IS NOT NULL;







ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS xendit_invoice_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subs_xendit_invoice
  ON public.subscriptions(xendit_invoice_id)
  WHERE xendit_invoice_id IS NOT NULL;


ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS xendit_status text;



DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.subscriptions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%trial%'
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.subscriptions DROP CONSTRAINT %I', cname);
  END IF;
END $$;


DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.subscriptions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%pending%'
  LIMIT 1;

  IF cname IS NULL THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_status_check
      CHECK (status IN ('trial','active','expired','cancelled','pending'));
  END IF;
END $$;





DROP FUNCTION IF EXISTS public.release_stock(text, integer);

CREATE OR REPLACE FUNCTION public.release_stock(p_slug text, p_quantity integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN false;
  END IF;

  UPDATE public.products
     SET stock = stock + p_quantity,
         sold_count = GREATEST(0, sold_count - p_quantity),
         status = CASE
           WHEN stock + p_quantity > 0 AND status = 'sold_out' THEN 'available'
           ELSE status
         END
   WHERE slug = p_slug;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.release_stock(text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.release_stock(text, integer) TO authenticated, service_role;











DROP TRIGGER IF EXISTS orders_guard_payment_status ON public.orders;
DROP FUNCTION IF EXISTS public.orders_guard_payment_status();

CREATE OR REPLACE FUNCTION public.orders_guard_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  
  IF NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status THEN
    RETURN NEW;
  END IF;

  
  IF current_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  
  RAISE EXCEPTION 'payment_status hanya dapat diubah oleh sistem pembayaran (Xendit webhook). Hubungi admin jika ini kesalahan.';
END;
$$;

CREATE TRIGGER orders_guard_payment_status
BEFORE UPDATE OF payment_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.orders_guard_payment_status();
