



















































































ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coin_debit_status text,
  ADD COLUMN IF NOT EXISTS coin_debit_reason text,
  ADD COLUMN IF NOT EXISTS coin_debit_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.orders'::regclass
       AND conname = 'orders_coin_debit_status_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_coin_debit_status_check
      CHECK (coin_debit_status IS NULL OR coin_debit_status IN ('pending', 'insufficient'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.orders'::regclass
       AND conname = 'orders_coin_debit_reason_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_coin_debit_reason_check
      CHECK (coin_debit_reason IS NULL OR coin_debit_reason IN ('rpc_error', 'insufficient_balance'));
  END IF;
END $$;

COMMENT ON COLUMN public.orders.coin_debit_status IS
  'P1-C: utang debit Coin yang tercatat. NULL = tidak ada utang; pending = debit tidak dapat dipastikan (retryable); insufficient = saldo tidak cukup saat itu (butuh top-up/keputusan bisnis). orders.coin_used TIDAK diubah oleh status ini.';
COMMENT ON COLUMN public.orders.coin_debit_reason IS
  'P1-C: alasan utang debit Coin: rpc_error (gangguan/ambig) atau insufficient_balance (saldo kurang).';
COMMENT ON COLUMN public.orders.coin_debit_updated_at IS
  'P1-C: waktu pencatatan/perbaruan terakhir utang debit Coin.';




CREATE OR REPLACE FUNCTION public.refund_order_coins_on_terminal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_bad boolean;
  v_is_bad boolean;
  v_spent integer;
BEGIN
  IF NEW.order_code IS NULL OR NEW.buyer_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_was_bad := (OLD.order_status IN ('cancelled', 'failed', 'refunded')
                OR OLD.payment_status IN ('failed', 'refunded'));
  v_is_bad := (NEW.order_status IN ('cancelled', 'failed', 'refunded')
               OR NEW.payment_status IN ('failed', 'refunded'));

  
  
  IF NOT v_is_bad OR v_was_bad THEN
    RETURN NEW;
  END IF;

  
  
  
  
  
  PERFORM pg_advisory_xact_lock(hashtext('rebites-coin:' || NEW.buyer_id::text));

  
  
  
  
  SELECT amount INTO v_spent
    FROM public.coin_transactions
   WHERE user_id = NEW.buyer_id
     AND order_code = NEW.order_code
     AND type = 'spent';

  IF v_spent IS NOT NULL AND v_spent > 0 THEN
    
    
    
    
    
    PERFORM 1 FROM public.coin_transactions
     WHERE user_id = NEW.buyer_id
       AND order_code = NEW.order_code
       AND type = 'refund';
    IF NOT FOUND THEN
      INSERT INTO public.coin_transactions(user_id, order_code, type, amount, description)
      VALUES (NEW.buyer_id, NEW.order_code, 'refund', v_spent,
              'Pengembalian koin ' || NEW.order_code)
        ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  
  
  
  DELETE FROM public.coin_transactions
   WHERE user_id = NEW.buyer_id
     AND order_code = NEW.order_code
     AND type = 'earned';

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_order_coins_on_terminal() FROM PUBLIC, anon, authenticated;

















CREATE OR REPLACE FUNCTION public.spend_order_coins(p_user_id uuid, p_order_code text, p_amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_earned bigint := 0;
  v_spent bigint := 0;
  v_order_found boolean := false;
  v_order_payment_status text;
  v_order_status text;
  v_order_buyer_id uuid;
  v_order_is_terminal boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;
  IF p_order_code IS NULL OR btrim(p_order_code) = '' THEN
    RETURN false;
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN false;
  END IF;

  
  
  
  
  SELECT o.payment_status, o.order_status, o.buyer_id
    INTO v_order_payment_status, v_order_status, v_order_buyer_id
    FROM public.orders o
   WHERE o.order_code = p_order_code
     FOR NO KEY UPDATE;
  v_order_found := FOUND;

  
  
  
  
  
  
  
  
  IF v_order_found AND (v_order_buyer_id IS NULL OR v_order_buyer_id <> p_user_id) THEN
    RETURN false;
  END IF;

  
  
  PERFORM pg_advisory_xact_lock(hashtext('rebites-coin:' || p_user_id::text));

  
  PERFORM 1 FROM public.coin_transactions
   WHERE user_id = p_user_id AND order_code = p_order_code AND type = 'spent';
  IF FOUND THEN
    RETURN true;
  END IF;

  
  
  
  
  IF NOT v_order_found THEN
    RETURN false;
  END IF;
  v_order_is_terminal := (v_order_status IN ('cancelled', 'failed', 'refunded')
                          OR v_order_payment_status IN ('failed', 'refunded'));
  IF v_order_is_terminal THEN
    RETURN false;
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN type IN ('earned', 'refund') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'spent' THEN amount ELSE 0 END), 0)
    INTO v_earned, v_spent
    FROM public.coin_transactions
   WHERE user_id = p_user_id;

  IF (v_earned - v_spent) < p_amount THEN
    RETURN false;
  END IF;

  BEGIN
    INSERT INTO public.coin_transactions(user_id, order_code, type, amount, description)
    VALUES (p_user_id, p_order_code, 'spent', p_amount, 'Potongan pesanan');
  EXCEPTION WHEN unique_violation THEN
    
    RETURN true;
  END;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.spend_order_coins(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_order_coins(uuid, text, integer) TO service_role;



























CREATE OR REPLACE FUNCTION public.guard_orders_insert_coin_debit_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_admin() THEN
    NEW.coin_debit_status := NULL;
    NEW.coin_debit_reason := NULL;
    NEW.coin_debit_updated_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_guard_insert_coin_debit ON public.orders;
CREATE TRIGGER trg_orders_guard_insert_coin_debit
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_orders_insert_coin_debit_defaults();





