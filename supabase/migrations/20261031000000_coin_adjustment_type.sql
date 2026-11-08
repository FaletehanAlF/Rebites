


















DO $$
DECLARE
  cname text;
BEGIN
  
  
  
  SELECT conname INTO cname
    FROM pg_constraint
   WHERE conrelid = 'public.coin_transactions'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%earned%'
     AND pg_get_constraintdef(oid) LIKE '%spent%'
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
      CHECK (type IN ('earned', 'spent', 'refund', 'adjustment'));
  END IF;
END $$;

COMMENT ON CONSTRAINT coin_transactions_type_check ON public.coin_transactions IS
  'earned/refund/adjustment menambah saldo; spent mengurangi. amount SELALU positif.';
