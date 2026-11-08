



























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

    IF NEW.name IS DISTINCT FROM OLD.name THEN v_changed := v_changed || ARRAY['name']; END IF;
    IF NEW.description IS DISTINCT FROM OLD.description THEN v_changed := v_changed || ARRAY['description']; END IF;
    IF NEW.image_url IS DISTINCT FROM OLD.image_url THEN v_changed := v_changed || ARRAY['image_url']; END IF;
    IF NEW.original_price IS DISTINCT FROM OLD.original_price THEN v_changed := v_changed || ARRAY['original_price']; END IF;
    IF NEW.surplus_price IS DISTINCT FROM OLD.surplus_price THEN v_changed := v_changed || ARRAY['surplus_price']; END IF;
    IF NEW.stock IS DISTINCT FROM OLD.stock THEN v_changed := v_changed || ARRAY['stock']; END IF;
    IF NEW.category IS DISTINCT FROM OLD.category THEN v_changed := v_changed || ARRAY['category']; END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN v_changed := v_changed || ARRAY['status']; END IF;
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN v_changed := v_changed || ARRAY['verification_status']; END IF;
    IF NEW.is_delivery IS DISTINCT FROM OLD.is_delivery THEN v_changed := v_changed || ARRAY['is_delivery']; END IF;
    IF NEW.is_pickup IS DISTINCT FROM OLD.is_pickup THEN v_changed := v_changed || ARRAY['is_pickup']; END IF;
    IF NEW.weight_gram IS DISTINCT FROM OLD.weight_gram THEN v_changed := v_changed || ARRAY['weight_gram']; END IF;
    IF NEW.length_cm IS DISTINCT FROM OLD.length_cm THEN v_changed := v_changed || ARRAY['length_cm']; END IF;
    IF NEW.width_cm IS DISTINCT FROM OLD.width_cm THEN v_changed := v_changed || ARRAY['width_cm']; END IF;
    IF NEW.height_cm IS DISTINCT FROM OLD.height_cm THEN v_changed := v_changed || ARRAY['height_cm']; END IF;

    
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

COMMENT ON FUNCTION public.log_product_activity() IS
  'Trigger activity log untuk public.products. Konkatenasi kolom perubahan memakai ARRAY[...] karena `text[] || ''literal''` ditafsirkan sebagai `anyarray || anyarray` dan gagal dengan "malformed array literal".';
