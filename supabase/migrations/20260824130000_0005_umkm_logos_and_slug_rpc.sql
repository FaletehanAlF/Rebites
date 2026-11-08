




INSERT INTO storage.buckets (id, name, public)
VALUES ('umkm-logos', 'umkm-logos', true)
ON CONFLICT (id) DO NOTHING;

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
GRANT EXECUTE ON FUNCTION public.reserve_stock(text, integer) TO authenticated;
