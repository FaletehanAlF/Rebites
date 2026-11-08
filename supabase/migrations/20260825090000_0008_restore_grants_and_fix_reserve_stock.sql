
















GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;





DROP FUNCTION IF EXISTS public.reserve_stock(uuid, integer);
DROP FUNCTION IF EXISTS public.reserve_stock(text, integer);

CREATE OR REPLACE FUNCTION public.reserve_stock(p_slug text, p_quantity integer)
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
     SET stock = stock - p_quantity,
         sold_count = sold_count + p_quantity,
         status = CASE WHEN stock - p_quantity <= 0 THEN 'sold_out' ELSE status END
   WHERE slug = p_slug
     AND stock >= p_quantity;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_stock(text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.reserve_stock(text, integer) TO authenticated, service_role;
