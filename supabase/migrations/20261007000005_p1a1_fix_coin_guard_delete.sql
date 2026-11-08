


















CREATE OR REPLACE FUNCTION public.guard_coin_transactions_no_client_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  IF session_user IN ('postgres', 'supabase_admin') THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  IF COALESCE(public.is_admin(), false) THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  
  RAISE EXCEPTION 'coin_transactions hanya dapat ditulis oleh sistem (user %, order %)',
    COALESCE((CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END).user_id::text, '?'),
    COALESCE((CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END).order_code, '?')
    USING ERRCODE = '42501';
END;
$$;
