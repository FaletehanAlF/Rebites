




















CREATE OR REPLACE FUNCTION public.guard_subscriptions_state_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  
  
  IF NEW.status = 'expired' AND OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'Transisi % -> expired tidak diizinkan (order sub %)', OLD.status, OLD.id
      USING ERRCODE = '42501';
  END IF;

  
  IF NEW.status = 'active' AND OLD.status NOT IN ('pending', 'trial', 'expired', 'cancelled', 'active') THEN
    RAISE EXCEPTION 'Transisi % -> active tidak diizinkan', OLD.status
      USING ERRCODE = '42501';
  END IF;

  
  IF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Subscription yang sudah cancelled tidak dapat diubah'
      USING ERRCODE = '42501';
  END IF;

  
  IF OLD.status = 'active'
     AND OLD.current_period_end IS NOT NULL
     AND NEW.current_period_end IS NOT NULL
     AND NEW.current_period_end < OLD.current_period_end THEN
    RAISE EXCEPTION 'current_period_end tidak boleh dipersingkat'
      USING ERRCODE = '42501';
  END IF;

  
  IF NEW.status = 'pending' AND OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'Transisi % -> pending tidak diizinkan', OLD.status
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_subscriptions_state_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_subscriptions_state_guard ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_state_guard
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.guard_subscriptions_state_update();
