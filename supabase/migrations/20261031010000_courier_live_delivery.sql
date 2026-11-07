

























































DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_type_check'
  ) THEN
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_type_check
      CHECK (type IN (
        'order_created','payment_success','order_delivering','order_completed',
        'promo','incoming_order','new_review','subscription_active','subscription_renewed',
        'subscription_expiring','subscription_changed','subscription_expired',
        'product_approved','product_rejected','product_warning',
        'report_received',
        'courier_assigned'
      ));
  END IF;
END $$;












CREATE TABLE IF NOT EXISTS public.couriers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  vehicle_type text NOT NULL DEFAULT 'motor'
    CHECK (vehicle_type IN ('motor', 'mobil', 'sepeda')),
  is_active boolean NOT NULL DEFAULT true,
  
  is_available boolean NOT NULL DEFAULT true,
  
  
  last_latitude double precision,
  last_longitude double precision,
  last_seen_at timestamptz,
  rating numeric(2,1) NOT NULL DEFAULT 5.0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.couriers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'couriers_latitude_range'
  ) THEN
    ALTER TABLE public.couriers
      ADD CONSTRAINT couriers_latitude_range
      CHECK (last_latitude IS NULL OR (last_latitude >= -90 AND last_latitude <= 90));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'couriers_longitude_range'
  ) THEN
    ALTER TABLE public.couriers
      ADD CONSTRAINT couriers_longitude_range
      CHECK (last_longitude IS NULL OR (last_longitude >= -180 AND last_longitude <= 180));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_couriers_available
  ON public.couriers(is_active, is_available)
  WHERE is_active;



DROP POLICY IF EXISTS "couriers_select_own_or_admin" ON public.couriers;
CREATE POLICY "couriers_select_own_or_admin"
ON public.couriers FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_admin()
);

DROP POLICY IF EXISTS "couriers_insert_own" ON public.couriers;
CREATE POLICY "couriers_insert_own"
ON public.couriers FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "couriers_update_own_or_admin" ON public.couriers;
CREATE POLICY "couriers_update_own_or_admin"
ON public.couriers FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.is_admin())
WITH CHECK (auth.uid() = user_id OR public.is_admin());



DROP POLICY IF EXISTS "couriers_insert_service" ON public.couriers;
CREATE POLICY "couriers_insert_service"
ON public.couriers FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());






CREATE TABLE IF NOT EXISTS public.delivery_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  courier_user_id uuid NOT NULL REFERENCES public.couriers(user_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'assigned'
    CHECK (status IN ('assigned', 'picked_up', 'delivering', 'completed', 'cancelled')),
  
  
  distance_km numeric(8,3),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  picked_up_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT delivery_assignments_order_unique UNIQUE (order_id)
);

ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_delivery_assignments_courier
  ON public.delivery_assignments(courier_user_id, status);

DROP POLICY IF EXISTS "delivery_assignments_select_participants" ON public.delivery_assignments;
CREATE POLICY "delivery_assignments_select_participants"
ON public.delivery_assignments FOR SELECT
TO authenticated
USING (
  courier_user_id = auth.uid()
  OR public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.id = delivery_assignments.order_id
       AND (
         o.buyer_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM public.umkm_profiles u
            WHERE u.id = o.umkm_id AND u.user_id = auth.uid()
         )
       )
  )
);



DROP POLICY IF EXISTS "delivery_assignments_update_courier" ON public.delivery_assignments;
CREATE POLICY "delivery_assignments_update_courier"
ON public.delivery_assignments FOR UPDATE
TO authenticated
USING (courier_user_id = auth.uid() OR public.is_admin())
WITH CHECK (courier_user_id = auth.uid() OR public.is_admin());








CREATE TABLE IF NOT EXISTS public.delivery_locations (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  courier_user_id uuid NOT NULL REFERENCES public.couriers(user_id) ON DELETE CASCADE,
  latitude double precision NOT NULL
    CHECK (latitude >= -90 AND latitude <= 90),
  longitude double precision NOT NULL
    CHECK (longitude >= -180 AND longitude <= 180),
  accuracy_m real,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_locations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_delivery_locations_courier
  ON public.delivery_locations(courier_user_id);

DROP POLICY IF EXISTS "delivery_locations_select_participants" ON public.delivery_locations;
CREATE POLICY "delivery_locations_select_participants"
ON public.delivery_locations FOR SELECT
TO authenticated
USING (
  courier_user_id = auth.uid()
  OR public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.id = delivery_locations.order_id
       AND (
         o.buyer_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM public.umkm_profiles u
            WHERE u.id = o.umkm_id AND u.user_id = auth.uid()
         )
       )
  )
);




DROP POLICY IF EXISTS "delivery_locations_upsert_courier" ON public.delivery_locations;
CREATE POLICY "delivery_locations_upsert_courier"
ON public.delivery_locations FOR INSERT
TO authenticated
WITH CHECK (
  courier_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.delivery_assignments a
     WHERE a.order_id = delivery_locations.order_id
       AND a.courier_user_id = auth.uid()
       AND a.status IN ('assigned', 'picked_up', 'delivering')
  )
);

DROP POLICY IF EXISTS "delivery_locations_update_courier" ON public.delivery_locations;
CREATE POLICY "delivery_locations_update_courier"
ON public.delivery_locations FOR UPDATE
TO authenticated
USING (courier_user_id = auth.uid())
WITH CHECK (
  courier_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.delivery_assignments a
     WHERE a.order_id = delivery_locations.order_id
       AND a.courier_user_id = auth.uid()
       AND a.status IN ('assigned', 'picked_up', 'delivering')
  )
);







CREATE TABLE IF NOT EXISTS public.courier_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

ALTER TABLE public.courier_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_courier_messages_order
  ON public.courier_messages(order_id, created_at);

DROP POLICY IF EXISTS "courier_messages_select_participants" ON public.courier_messages;
CREATE POLICY "courier_messages_select_participants"
ON public.courier_messages FOR SELECT
TO authenticated
USING (
  sender_user_id = auth.uid()
  OR public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.id = courier_messages.order_id
       AND (
         o.buyer_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM public.umkm_profiles u
            WHERE u.id = o.umkm_id AND u.user_id = auth.uid()
         )
         OR EXISTS (
           SELECT 1 FROM public.delivery_assignments a
            WHERE a.order_id = courier_messages.order_id
              AND a.courier_user_id = auth.uid()
         )
       )
  )
);


DROP POLICY IF EXISTS "courier_messages_insert_participants" ON public.courier_messages;
CREATE POLICY "courier_messages_insert_participants"
ON public.courier_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.id = courier_messages.order_id
       AND (
         o.buyer_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM public.delivery_assignments a
            WHERE a.order_id = courier_messages.order_id
              AND a.courier_user_id = auth.uid()
         )
       )
  )
);


DROP POLICY IF EXISTS "courier_messages_update_sender" ON public.courier_messages;
CREATE POLICY "courier_messages_update_sender"
ON public.courier_messages FOR UPDATE
TO authenticated
USING (sender_user_id = auth.uid())
WITH CHECK (sender_user_id = auth.uid());







DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'delivery_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_locations;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'delivery_assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_assignments;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND tablename = 'courier_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.courier_messages;
  END IF;
END $$;







CREATE OR REPLACE FUNCTION public.cleanup_delivery_location_on_terminal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_status IN ('completed', 'cancelled', 'refunded', 'failed') THEN
    DELETE FROM public.delivery_locations WHERE order_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_cleanup_location ON public.orders;
CREATE TRIGGER trg_orders_cleanup_location
  AFTER UPDATE OF order_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_delivery_location_on_terminal();




















CREATE OR REPLACE FUNCTION public.auto_assign_courier_to_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_courier uuid;
  v_distance numeric(8,3);
  v_origin_lat double precision;
  v_origin_lng double precision;
  v_max_age interval := interval '15 minutes';
BEGIN
  
  IF NEW.order_status IS DISTINCT FROM OLD.order_status
     AND NEW.order_status = 'out_for_delivery' THEN

    
    IF EXISTS (
      SELECT 1 FROM public.delivery_assignments a WHERE a.order_id = NEW.id
    ) THEN
      RETURN NEW;
    END IF;

    
    SELECT u.latitude, u.longitude
      INTO v_origin_lat, v_origin_lng
      FROM public.umkm_profiles u
     WHERE u.id = NEW.umkm_id;

    
    IF v_origin_lat IS NULL OR v_origin_lng IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT c.user_id,
           sqrt(
             power((c.last_latitude - v_origin_lat) * 111.32, 2)
             + power(
                 (c.last_longitude - v_origin_lng) * 111.32
                   * cos(radians(v_origin_lat)),
                 2
               )
           )::numeric(8,3)
      INTO v_courier, v_distance
      FROM public.couriers c
     WHERE c.is_active
       AND c.is_available
       AND c.last_latitude IS NOT NULL
       AND c.last_longitude IS NOT NULL
       AND c.last_seen_at IS NOT NULL
       AND c.last_seen_at >= now() - v_max_age
       
       AND NOT EXISTS (
         SELECT 1 FROM public.delivery_assignments a2
          WHERE a2.courier_user_id = c.user_id
            AND a2.status IN ('assigned', 'picked_up', 'delivering')
       )
     ORDER BY 1 ASC
     LIMIT 1;

    IF v_courier IS NOT NULL THEN
      INSERT INTO public.delivery_assignments
        (order_id, courier_user_id, status, distance_km)
      VALUES (NEW.id, v_courier, 'assigned', v_distance)
      ON CONFLICT (order_id) DO NOTHING;

      
      
      
      
      
      
      
      
      
      
      
      INSERT INTO public.notifications (user_id, role, type, title, message, reference_id, href)
      SELECT c.user_id, 'buyer', 'courier_assigned',
        'Pesanan needing diantar',
        'Pesanan #' || NEW.order_code || ' needing diantar ke pembeli. Buka dashboard kurir.',
        NEW.order_code, '/dashboard/kurir'
      FROM public.couriers c WHERE c.user_id = v_courier;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_auto_assign_courier ON public.orders;
CREATE TRIGGER trg_orders_auto_assign_courier
  AFTER UPDATE OF order_status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_courier_to_delivery();







CREATE OR REPLACE FUNCTION public.guard_delivery_location_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_status text;
BEGIN
  SELECT o.order_status INTO v_order_status
    FROM public.orders o WHERE o.id = NEW.order_id;

  IF v_order_status IS NULL
     OR v_order_status NOT IN ('processing', 'out_for_delivery') THEN
    RAISE EXCEPTION 'Posisi kurir hanya boleh ditulis saat pesanan sedang diantar'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_locations_guard ON public.delivery_locations;
CREATE TRIGGER trg_delivery_locations_guard
  BEFORE INSERT OR UPDATE ON public.delivery_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_delivery_location_write();














