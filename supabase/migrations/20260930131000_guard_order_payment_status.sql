











CREATE OR REPLACE FUNCTION public.guard_order_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.payment_status IS NOT DISTINCT FROM NEW.payment_status THEN
    RETURN NEW;
  END IF;

  
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'payment_status hanya boleh diubah server/admin (order %)', OLD.order_code
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_order_payment_status ON public.orders;
CREATE TRIGGER trg_guard_order_payment_status
  BEFORE UPDATE OF payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_payment_status();
