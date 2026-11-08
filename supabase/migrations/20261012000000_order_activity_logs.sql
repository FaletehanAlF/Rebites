






































































CREATE OR REPLACE FUNCTION public.log_order_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_source text;
  v_product_name text;
  v_order_code text;
  v_is_real_order boolean;
  v_metadata jsonb;
BEGIN
  
  
  
  IF TG_OP = 'INSERT' THEN
    v_product_name := NEW.product_name;
    v_order_code := NEW.order_code;
    
    IF v_product_name IS NULL THEN
      RETURN NEW;
    END IF;

    
    IF EXISTS (
      SELECT 1 FROM public.activity_logs a
       WHERE a.target_type = 'order'
         AND a.target_id = NEW.id
         AND a.activity_type = 'order_created'
    ) THEN
      RETURN NEW;
    END IF;

    
    
    
    v_actor := COALESCE(auth.uid(), NEW.buyer_id);
    v_source := CASE WHEN auth.uid() IS NOT NULL THEN 'auth' ELSE 'buyer_fallback' END;

    v_metadata := jsonb_build_object(
      'auto', true,
      'actor_source', v_source,
      'order_id', NEW.id,
      'order_code', v_order_code,
      'product_id', NEW.product_id,
      'product_name', v_product_name,
      'vendor_name', NEW.vendor_name,
      'quantity', NEW.quantity,
      'unit_price', NEW.unit_price,
      'total_price', NEW.total_price,
      'delivery_option', NEW.delivery_option,
      'order_status', NEW.order_status,
      'payment_status', NEW.payment_status
    );

    INSERT INTO public.activity_logs (user_id, activity_type, description, target_type, target_id, metadata)
    VALUES (
      v_actor,
      'order_created',
      'Pesanan dibuat: ' || COALESCE(NULLIF(btrim(v_order_code), ''), NEW.id::text)
        || ' · ' || COALESCE(v_product_name, '-'),
      'order',
      NEW.id,
      v_metadata
    );
    RETURN NEW;
  END IF;

  
  
  
  IF TG_OP = 'UPDATE' THEN
    
    IF NEW.product_name IS NOT NULL AND OLD.product_name IS NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.activity_logs a
         WHERE a.target_type = 'order'
           AND a.target_id = NEW.id
           AND a.activity_type = 'order_created'
      ) THEN
        v_actor := COALESCE(auth.uid(), NEW.buyer_id);
        v_source := CASE WHEN auth.uid() IS NOT NULL THEN 'auth' ELSE 'buyer_fallback' END;
        v_order_code := NEW.order_code;

        v_metadata := jsonb_build_object(
          'auto', true,
          'actor_source', v_source,
          'order_id', NEW.id,
          'order_code', v_order_code,
          'product_id', NEW.product_id,
          'product_name', NEW.product_name,
          'vendor_name', NEW.vendor_name,
          'quantity', NEW.quantity,
          'unit_price', NEW.unit_price,
          'total_price', NEW.total_price,
          'delivery_option', NEW.delivery_option,
          'order_status', NEW.order_status,
          'payment_status', NEW.payment_status
        );

        INSERT INTO public.activity_logs (user_id, activity_type, description, target_type, target_id, metadata)
        VALUES (
          v_actor,
          'order_created',
          'Pesanan dibuat: ' || COALESCE(NULLIF(btrim(v_order_code), ''), NEW.id::text)
            || ' · ' || COALESCE(NEW.product_name, '-'),
          'order',
          NEW.id,
          v_metadata
        );
      END IF;
    END IF;

    
    
    IF NEW.order_status = 'cancelled' AND OLD.order_status IS DISTINCT FROM 'cancelled' THEN
      
      
      
      
      v_actor := auth.uid();
      v_source := CASE WHEN v_actor IS NOT NULL THEN 'auth' ELSE 'service_or_system' END;
      v_order_code := NEW.order_code;

      v_metadata := jsonb_build_object(
        'auto', true,
        'actor_source', v_source,
        'order_id', NEW.id,
        'order_code', v_order_code,
        'product_id', NEW.product_id,
        'product_name', NEW.product_name,
        'vendor_name', NEW.vendor_name,
        'quantity', NEW.quantity,
        'total_price', NEW.total_price,
        'old_order_status', OLD.order_status,
        'new_order_status', NEW.order_status,
        'old_payment_status', OLD.payment_status,
        'new_payment_status', NEW.payment_status
      );

      INSERT INTO public.activity_logs (user_id, activity_type, description, target_type, target_id, metadata)
      VALUES (
        v_actor,
        'order_cancelled',
        'Pesanan dibatalkan: ' || COALESCE(NULLIF(btrim(v_order_code), ''), NEW.id::text),
        'order',
        NEW.id,
        v_metadata
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;








DROP TRIGGER IF EXISTS trg_orders_activity_insert ON public.orders;
CREATE TRIGGER trg_orders_activity_insert
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_activity();

DROP TRIGGER IF EXISTS trg_orders_activity_update ON public.orders;
CREATE TRIGGER trg_orders_activity_update
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_activity();


















CREATE OR REPLACE FUNCTION public.log_product_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_owner uuid;
  v_umkm uuid;
  v_name text;
  v_source text;
  v_changed text[] := '{}';
  v_verification_note text := NULL;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_umkm := NEW.umkm_id;
    v_name := NEW.name;
    SELECT u.user_id INTO v_owner FROM public.umkm_profiles u WHERE u.id = NEW.umkm_id;
    v_actor := COALESCE(auth.uid(), v_owner);
    v_source := CASE WHEN auth.uid() IS NOT NULL THEN 'auth' ELSE 'owner_fallback' END;

    INSERT INTO public.activity_logs (user_id, activity_type, description, target_type, target_id, metadata)
    VALUES (
      v_actor,
      'product_created',
      'Produk baru ditambahkan: ' || COALESCE(v_name, '(tanpa nama)'),
      'product',
      NEW.id,
      jsonb_build_object(
        'auto', true,
        'actor_source', v_source,
        'product_id', NEW.id,
        'umkm_id', v_umkm,
        'name', v_name,
        'category', NEW.category,
        'surplus_price', NEW.surplus_price,
        'original_price', NEW.original_price,
        'stock', NEW.stock,
        'status', NEW.status,
        'verification_status', NEW.verification_status,
        'image_present', (NEW.image_url IS NOT NULL AND btrim(NEW.image_url) <> '')
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_umkm := NEW.umkm_id;
    v_name := NEW.name;
    SELECT u.user_id INTO v_owner FROM public.umkm_profiles u WHERE u.id = NEW.umkm_id;
    v_actor := COALESCE(auth.uid(), v_owner);
    v_source := CASE WHEN auth.uid() IS NOT NULL THEN 'auth' ELSE 'owner_fallback' END;

    IF NEW.name IS DISTINCT FROM OLD.name THEN v_changed := v_changed || 'name'; END IF;
    IF NEW.description IS DISTINCT FROM OLD.description THEN v_changed := v_changed || 'description'; END IF;
    IF NEW.image_url IS DISTINCT FROM OLD.image_url THEN v_changed := v_changed || 'image_url'; END IF;
    IF NEW.original_price IS DISTINCT FROM OLD.original_price THEN v_changed := v_changed || 'original_price'; END IF;
    IF NEW.surplus_price IS DISTINCT FROM OLD.surplus_price THEN v_changed := v_changed || 'surplus_price'; END IF;
    IF NEW.stock IS DISTINCT FROM OLD.stock THEN v_changed := v_changed || 'stock'; END IF;
    IF NEW.category IS DISTINCT FROM OLD.category THEN v_changed := v_changed || 'category'; END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN v_changed := v_changed || 'status'; END IF;
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN v_changed := v_changed || 'verification_status'; END IF;
    IF NEW.is_delivery IS DISTINCT FROM OLD.is_delivery THEN v_changed := v_changed || 'is_delivery'; END IF;
    IF NEW.is_pickup IS DISTINCT FROM OLD.is_pickup THEN v_changed := v_changed || 'is_pickup'; END IF;
    IF NEW.weight_gram IS DISTINCT FROM OLD.weight_gram THEN v_changed := v_changed || 'weight_gram'; END IF;
    IF NEW.length_cm IS DISTINCT FROM OLD.length_cm THEN v_changed := v_changed || 'length_cm'; END IF;
    IF NEW.width_cm IS DISTINCT FROM OLD.width_cm THEN v_changed := v_changed || 'width_cm'; END IF;
    IF NEW.height_cm IS DISTINCT FROM OLD.height_cm THEN v_changed := v_changed || 'height_cm'; END IF;

    
    IF v_changed = '{}' THEN
      RETURN NEW;
    END IF;

    
    
    
    IF 'verification_status' = ANY (v_changed) THEN
      v_verification_note := 'Status moderasi: '
        || COALESCE(OLD.verification_status, '-')
        || ' -> '
        || COALESCE(NEW.verification_status, '-');
    END IF;

    INSERT INTO public.activity_logs (user_id, activity_type, description, target_type, target_id, metadata)
    VALUES (
      v_actor,
      'product_updated',
      'Produk diperbarui: ' || COALESCE(v_name, '(tanpa nama)')
        || ' (' || array_to_string(v_changed, ', ') || ')'
        || COALESCE(' — ' || v_verification_note, ''),
      'product',
      NEW.id,
      jsonb_build_object(
        'auto', true,
        'actor_source', v_source,
        'product_id', NEW.id,
        'umkm_id', v_umkm,
        'name', v_name,
        'changed_fields', v_changed,
        'old_surplus_price', OLD.surplus_price,
        'new_surplus_price', NEW.surplus_price,
        'old_stock', OLD.stock,
        'new_stock', NEW.stock,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'old_verification_status', OLD.verification_status,
        'new_verification_status', NEW.verification_status,
        
        'rejection_reason', NEW.rejection_reason,
        'old_rejection_reason', OLD.rejection_reason,
        'reviewed_by', NEW.reviewed_by,
        'reviewed_at', NEW.reviewed_at,
        'image_changed', ('image_url' = ANY (v_changed))
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_umkm := OLD.umkm_id;
    v_name := OLD.name;
    SELECT u.user_id INTO v_owner FROM public.umkm_profiles u WHERE u.id = OLD.umkm_id;
    v_actor := COALESCE(auth.uid(), v_owner);
    v_source := CASE WHEN auth.uid() IS NOT NULL THEN 'auth' ELSE 'owner_fallback' END;

    INSERT INTO public.activity_logs (user_id, activity_type, description, target_type, target_id, metadata)
    VALUES (
      v_actor,
      'product_deleted',
      'Produk dihapus: ' || COALESCE(v_name, '(tanpa nama)'),
      'product',
      OLD.id,
      jsonb_build_object(
        'auto', true,
        'actor_source', v_source,
        'product_id', OLD.id,
        'umkm_id', v_umkm,
        'name', v_name,
        'category', OLD.category,
        'surplus_price', OLD.surplus_price,
        'verification_status', OLD.verification_status
      )
    );
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.log_order_activity() IS
  'Trigger activity log untuk public.orders (order_created / order_cancelled). Aktor server-side; placeholder idempotensi (product_name NULL) tidak dicatat. Tanpa alamat, token, atau kredensial.';
COMMENT ON FUNCTION public.log_product_activity() IS
  'Trigger activity log untuk public.products. 20261012000000 menambah rejection_reason/reviewed_by/reviewed_at ke metadata serta keterangan eksplisit perubahan status moderasi.';