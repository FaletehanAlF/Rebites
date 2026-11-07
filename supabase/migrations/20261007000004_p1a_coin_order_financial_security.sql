
































































DROP POLICY IF EXISTS "coin_tx_insert_own" ON public.coin_transactions;
DROP POLICY IF EXISTS "coin_tx_update_own" ON public.coin_transactions;
DROP POLICY IF EXISTS "coin_tx_delete_own" ON public.coin_transactions;
DROP POLICY IF EXISTS "coin_tx_insert_any" ON public.coin_transactions;
DROP POLICY IF EXISTS "coin_tx_update_any" ON public.coin_transactions;
DROP POLICY IF EXISTS "coin_tx_delete_any" ON public.coin_transactions;




DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
    FROM pg_constraint
   WHERE conrelid = 'public.coin_transactions'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%earned%'
   LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.coin_transactions DROP CONSTRAINT %I', cname);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.coin_transactions'::regclass
       AND conname = 'coin_transactions_type_check'
  ) THEN
    ALTER TABLE public.coin_transactions
      ADD CONSTRAINT coin_transactions_type_check
      CHECK (type IN ('earned', 'spent', 'refund'));
  END IF;
END $$;




CREATE OR REPLACE FUNCTION public.guard_coin_transactions_no_client_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF session_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF COALESCE(public.is_admin(), false) THEN
    RETURN NEW;
  END IF;
  
  RAISE EXCEPTION 'coin_transactions hanya dapat ditulis oleh sistem (user %, order %)',
    COALESCE((CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END).user_id::text, '?'),
    COALESCE((CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END).order_code, '?')
    USING ERRCODE = '42501';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_coin_transactions_no_client_write() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_coin_tx_no_client_write ON public.coin_transactions;
CREATE TRIGGER trg_coin_tx_no_client_write
  BEFORE INSERT OR UPDATE OR DELETE ON public.coin_transactions
  FOR EACH ROW EXECUTE FUNCTION public.guard_coin_transactions_no_client_write();




CREATE OR REPLACE FUNCTION public.spend_order_coins(p_user_id uuid, p_order_code text, p_amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_earned bigint := 0;
  v_spent bigint := 0;
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

  
  
  PERFORM pg_advisory_xact_lock(hashtext('rebites-coin:' || p_user_id::text));

  
  PERFORM 1 FROM public.coin_transactions
   WHERE user_id = p_user_id AND order_code = p_order_code AND type = 'spent';
  IF FOUND THEN
    RETURN true;
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




CREATE OR REPLACE FUNCTION public.refund_order_coins(p_user_id uuid, p_order_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spent integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;
  IF p_order_code IS NULL OR btrim(p_order_code) = '' THEN
    RETURN false;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('rebites-coin:' || p_user_id::text));

  SELECT amount INTO v_spent FROM public.coin_transactions
   WHERE user_id = p_user_id AND order_code = p_order_code AND type = 'spent';

  IF NOT FOUND THEN
    
    RETURN false;
  END IF;

  PERFORM 1 FROM public.coin_transactions
   WHERE user_id = p_user_id AND order_code = p_order_code AND type = 'refund';
  IF FOUND THEN
    RETURN true;
  END IF;

  BEGIN
    INSERT INTO public.coin_transactions(user_id, order_code, type, amount, description)
    VALUES (p_user_id, p_order_code, 'refund', v_spent, 'Pengembalian koin ' || p_order_code);
  EXCEPTION WHEN unique_violation THEN
    RETURN true;
  END;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_order_coins(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_order_coins(uuid, text) TO service_role;




CREATE OR REPLACE FUNCTION public.refund_order_coins_on_terminal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_bad boolean;
  v_is_bad boolean;
BEGIN
  IF NEW.order_code IS NULL OR NEW.buyer_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.coin_used IS NULL OR NEW.coin_used <= 0 THEN
    
    
    NULL;
  END IF;

  v_was_bad := (OLD.order_status IN ('cancelled', 'failed', 'refunded')
                OR OLD.payment_status IN ('failed', 'refunded'));
  v_is_bad := (NEW.order_status IN ('cancelled', 'failed', 'refunded')
               OR NEW.payment_status IN ('failed', 'refunded'));

  
  
  IF NOT v_is_bad OR v_was_bad THEN
    RETURN NEW;
  END IF;

  IF NEW.coin_used IS NOT NULL AND NEW.coin_used > 0 THEN
    INSERT INTO public.coin_transactions(user_id, order_code, type, amount, description)
    VALUES (NEW.buyer_id, NEW.order_code, 'refund', NEW.coin_used,
            'Pengembalian koin ' || NEW.order_code)
    ON CONFLICT DO NOTHING;
  END IF;

  
  DELETE FROM public.coin_transactions
   WHERE user_id = NEW.buyer_id
     AND order_code = NEW.order_code
     AND type = 'earned';

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_order_coins_on_terminal() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_orders_refund_coins ON public.orders;
CREATE TRIGGER trg_orders_refund_coins
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.refund_order_coins_on_terminal();





CREATE OR REPLACE FUNCTION public.guard_orders_insert_client_defaults()
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
    NEW.payment_status := 'unpaid';
    NEW.order_status := 'pending';
    NEW.lifecycle_status := 'ongoing';
    NEW.progress_status := 'disiapkan';
    NEW.xendit_invoice_id := NULL;
    NEW.payment_method_id := NULL;
    
    
    NEW.unit_price := NULL;
    NEW.subtotal := NULL;
    NEW.discount := 0;
    NEW.service_fee := 0;
    NEW.delivery_fee := 0;
    NEW.total_before_coin := NULL;
    NEW.total_price := 0;
    NEW.promo_code := NULL;
    NEW.coin_used := 0;
    NEW.coin_earned := 0;
    NEW.shipping_rate := NULL;
    NEW.courier_code := NULL;
    NEW.courier_service_code := NULL;
    NEW.courier_service_name := NULL;
    NEW.shipping_snapshot := NULL;
    NEW.estimated_minutes := NULL;
    NEW.estimated_completion_at := NULL;
    NEW.biteship_order_id := NULL;
    NEW.biteship_tracking_id := NULL;
    NEW.biteship_waybill_id := NULL;
    NEW.shipment_status := NULL;
    NEW.shipment_created_at := NULL;
    NEW.shipment_error := NULL;
    NEW.completed_at := NULL;
    NEW.delivery_started_at := NULL;
    NEW.estimated_arrival_at := NULL;
    NEW.stock_reserved_at := NULL;
    NEW.stock_released_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;




CREATE OR REPLACE FUNCTION public.consume_promo(p_code text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_pct integer;
BEGIN
  v_code := UPPER(btrim(COALESCE(p_code, '')));
  IF v_code = '' THEN
    RETURN NULL;
  END IF;

  
  
  UPDATE public.promo_codes
     SET used_count = used_count + 1
   WHERE code = v_code
     AND is_valid = true
     AND (expires_at IS NULL OR expires_at > now())
     AND percent_off BETWEEN 1 AND 100
     AND (max_uses IS NULL OR used_count < max_uses)
  RETURNING percent_off INTO v_pct;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  RETURN v_pct;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_promo(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_promo(text) TO service_role;

CREATE OR REPLACE FUNCTION public.release_promo(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := UPPER(btrim(COALESCE(p_code, '')));
BEGIN
  IF v_code = '' THEN
    RETURN false;
  END IF;
  UPDATE public.promo_codes
     SET used_count = GREATEST(0, used_count - 1)
   WHERE code = v_code;
  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.release_promo(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_promo(text) TO service_role;
