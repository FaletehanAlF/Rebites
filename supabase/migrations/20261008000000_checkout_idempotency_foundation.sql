




































ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS invoice_state text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.orders'::regclass
       AND conname = 'orders_invoice_state_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_invoice_state_check
      CHECK (invoice_state IS NULL OR invoice_state IN (
        'not_started', 'inflight', 'unknown', 'attached', 'failed'
      ));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_buyer_idempotency_key
  ON public.orders(buyer_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.orders.idempotency_key IS
  'Tahap 2D-E: kunci idempotensi checkout per buyer (UUID dari client). NULL = legacy.';
COMMENT ON COLUMN public.orders.invoice_state IS
  'Tahap 2D-E: not_started/inflight/unknown/attached/failed. NULL = legacy. NULL + xendit_invoice_id NULL TIDAK berarti belum terbit.';
