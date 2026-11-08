















DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.orders'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%order_status%'
  LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', cname);
  END IF;
END $$;


ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_status_check
  CHECK (order_status IN (
    'pending', 'paid', 'processing', 'ready_for_pickup',
    'out_for_delivery', 'preparing', 'ready', 'completed',
    'cancelled', 'refunded'
  ));





CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_osh_order ON public.order_status_history(order_id, created_at);


DROP POLICY IF EXISTS "osh_select_participants" ON public.order_status_history;
CREATE POLICY "osh_select_participants"
ON public.order_status_history FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_status_history.order_id
      AND (
        o.buyer_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.umkm_profiles u WHERE u.id = o.umkm_id AND u.user_id = auth.uid())
      )
  )
);


DROP POLICY IF EXISTS "osh_insert_service" ON public.order_status_history;
CREATE POLICY "osh_insert_service"
ON public.order_status_history FOR INSERT
TO authenticated
WITH CHECK (true);





CREATE TABLE IF NOT EXISTS public.seller_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_code text NOT NULL,
  type text NOT NULL DEFAULT 'sale' CHECK (type IN ('sale', 'refund', 'payout')),
  amount integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seller_transactions ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS idx_st_order_once ON public.seller_transactions(order_id) WHERE type = 'sale';
CREATE INDEX IF NOT EXISTS idx_st_seller ON public.seller_transactions(seller_id, created_at DESC);

DROP POLICY IF EXISTS "st_select_own" ON public.seller_transactions;
CREATE POLICY "st_select_own"
ON public.seller_transactions FOR SELECT
TO authenticated
USING (auth.uid() = seller_id);


DROP POLICY IF EXISTS "st_insert_own" ON public.seller_transactions;
CREATE POLICY "st_insert_own"
ON public.seller_transactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = seller_id);





DROP TRIGGER IF EXISTS orders_guard_order_status ON public.orders;
DROP FUNCTION IF EXISTS public.orders_guard_order_status();

CREATE OR REPLACE FUNCTION public.orders_guard_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  
  IF NEW.order_status IS NOT DISTINCT FROM OLD.order_status THEN
    RETURN NEW;
  END IF;

  
  IF current_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  
  
  CASE OLD.order_status
    WHEN 'paid' THEN
      IF NEW.order_status NOT IN ('processing', 'cancelled') THEN
        RAISE EXCEPTION 'Transisi tidak valid: % -> %', OLD.order_status, NEW.order_status;
      END IF;
    WHEN 'processing' THEN
      IF NEW.order_status NOT IN ('ready_for_pickup', 'out_for_delivery', 'cancelled') THEN
        RAISE EXCEPTION 'Transisi tidak valid: % -> %', OLD.order_status, NEW.order_status;
      END IF;
    WHEN 'ready_for_pickup' THEN
      IF NEW.order_status NOT IN ('completed') THEN
        RAISE EXCEPTION 'Transisi tidak valid: % -> %', OLD.order_status, NEW.order_status;
      END IF;
    WHEN 'out_for_delivery' THEN
      IF NEW.order_status NOT IN ('completed') THEN
        RAISE EXCEPTION 'Transisi tidak valid: % -> %', OLD.order_status, NEW.order_status;
      END IF;
    WHEN 'preparing' THEN
      
      IF NEW.order_status NOT IN ('completed', 'cancelled', 'ready') THEN
        RAISE EXCEPTION 'Transisi tidak valid: % -> %', OLD.order_status, NEW.order_status;
      END IF;
    WHEN 'ready' THEN
      IF NEW.order_status NOT IN ('completed', 'cancelled') THEN
        RAISE EXCEPTION 'Transisi tidak valid: % -> %', OLD.order_status, NEW.order_status;
      END IF;
    WHEN 'pending' THEN
      
      IF NEW.order_status NOT IN ('paid', 'cancelled', 'failed') THEN
        RAISE EXCEPTION 'Transisi tidak valid: % -> %', OLD.order_status, NEW.order_status;
      END IF;
    WHEN 'completed', 'cancelled', 'refunded' THEN
      RAISE EXCEPTION 'Tidak dapat mengubah status dari % ke %', OLD.order_status, NEW.order_status;
    ELSE
      
      RAISE EXCEPTION 'Status tidak dikenal: %', OLD.order_status;
  END CASE;

  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_guard_order_status
BEFORE UPDATE OF order_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.orders_guard_order_status();





DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'order_status_history') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history;
  END IF;
END $$;





INSERT INTO public.order_status_history (order_id, status, created_at)
SELECT o.id, o.order_status, o.created_at
FROM public.orders o
WHERE o.order_status IN ('paid', 'preparing', 'ready', 'completed', 'cancelled', 'refunded')
  AND NOT EXISTS (
    SELECT 1 FROM public.order_status_history h
    WHERE h.order_id = o.id AND h.status = o.order_status
  )
ON CONFLICT DO NOTHING;






UPDATE public.orders
SET order_status = 'processing'
WHERE order_status = 'preparing'
  AND lifecycle_status = 'ongoing'
  AND payment_status = 'paid';
