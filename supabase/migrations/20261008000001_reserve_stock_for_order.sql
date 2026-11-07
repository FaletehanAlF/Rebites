













































CREATE OR REPLACE FUNCTION public.reserve_stock_for_order(
  p_order_code text,
  p_buyer_id uuid,
  p_slug text,
  p_quantity integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_products_updated integer;
  v_orders_updated integer;
BEGIN
  IF p_order_code IS NULL OR btrim(p_order_code) = '' THEN
    RETURN false;
  END IF;
  IF p_buyer_id IS NULL THEN
    RETURN false;
  END IF;
  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RETURN false;
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN false;
  END IF;

  
  UPDATE public.products
     SET stock = stock - p_quantity,
         sold_count = sold_count + p_quantity,
         status = CASE WHEN stock - p_quantity <= 0 THEN 'sold_out' ELSE status END
   WHERE slug = p_slug
     AND stock >= p_quantity;
  GET DIAGNOSTICS v_products_updated = ROW_COUNT;
  IF v_products_updated <> 1 THEN
    
    RETURN false;
  END IF;

  
  
  
  
  
  UPDATE public.orders
     SET stock_reserved_at = now()
   WHERE order_code = p_order_code
     AND buyer_id = p_buyer_id
     AND quantity = p_quantity
     AND payment_status = 'unpaid'
     AND order_status = 'pending'
     AND stock_reserved_at IS NULL
     AND stock_released_at IS NULL;
  GET DIAGNOSTICS v_orders_updated = ROW_COUNT;
  IF v_orders_updated <> 1 THEN
    RAISE EXCEPTION 'reserve_stock_for_order: klaim marker gagal untuk order % (0 = terminal/tak-valid/sudah-bertanda, >1 = ambigu)',
      p_order_code;
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_stock_for_order(text, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_stock_for_order(text, uuid, text, integer) TO service_role;

COMMENT ON FUNCTION public.reserve_stock_for_order(text, uuid, text, integer) IS
  'Tahap 2D-J: decrement stok + marker stock_reserved_at atomik per order; replay-aman via marker (Desain B audit 2D-I).';
