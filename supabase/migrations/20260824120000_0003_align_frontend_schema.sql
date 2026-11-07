











ALTER TABLE public.umkm_profiles ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.umkm_profiles
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS is_rescue_partner boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS open_hours text,
  ADD COLUMN IF NOT EXISTS distance_km double precision,
  ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS owner_name text,
  ADD COLUMN IF NOT EXISTS partner_tier text DEFAULT 'UMKM Partner',
  ADD COLUMN IF NOT EXISTS followers integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS member_since integer,
  ADD COLUMN IF NOT EXISTS response_time text,
  ADD COLUMN IF NOT EXISTS porsi_terselamatkan integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS co2e_saved_kg double precision NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS umkm_slug_key ON public.umkm_profiles(slug);
CREATE INDEX IF NOT EXISTS umkm_slug_idx ON public.umkm_profiles(slug);




ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS discount_percent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating numeric(2,1) NOT NULL DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS distance_km double precision,
  ADD COLUMN IF NOT EXISTS stock_label text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS slot text CHECK (slot IN ('09-12','12-15','15-18','18-21') OR slot IS NULL),
  ADD COLUMN IF NOT EXISTS all_day boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_surplus_today boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flash_sale_price integer,
  ADD COLUMN IF NOT EXISTS flash_sale_start timestamptz,
  ADD COLUMN IF NOT EXISTS flash_sale_end timestamptz,
  ADD COLUMN IF NOT EXISTS sold_count integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS products_slug_key ON public.products(slug);




ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS vendor_name text,
  ADD COLUMN IF NOT EXISTS vendor_slug text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS unit_price integer,
  ADD COLUMN IF NOT EXISTS address_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS payment_method_id text,
  ADD COLUMN IF NOT EXISTS subtotal integer,
  ADD COLUMN IF NOT EXISTS discount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_before_coin integer,
  ADD COLUMN IF NOT EXISTS coin_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coin_earned integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS lifecycle_status text CHECK (lifecycle_status IN ('ongoing','completed') OR lifecycle_status IS NULL),
  ADD COLUMN IF NOT EXISTS estimated_minutes integer,
  ADD COLUMN IF NOT EXISTS estimated_completion_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS distance_km double precision,
  ADD COLUMN IF NOT EXISTS vendor_address text,
  ADD COLUMN IF NOT EXISTS vendor_open_hours text,
  ADD COLUMN IF NOT EXISTS preparation_minutes integer,
  ADD COLUMN IF NOT EXISTS co2e_saved_kg double precision;

CREATE INDEX IF NOT EXISTS idx_orders_code ON public.orders(order_code);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_slug ON public.orders(vendor_slug);




ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS cta text;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing text CHECK (billing IN ('monthly','yearly') OR billing IS NULL),
  ADD COLUMN IF NOT EXISTS price_paid integer,
  ADD COLUMN IF NOT EXISTS payment_method_id text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();



DELETE FROM public.plans WHERE slug IS NULL;




CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  umkm_id uuid REFERENCES public.umkm_profiles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text,
  author_avatar text,
  menu_name text,
  kind text NOT NULL DEFAULT 'product' CHECK (kind IN ('product','service')),
  rating numeric(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviews_order_user_unique UNIQUE (order_id, user_id)
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_umkm ON public.reviews(umkm_id);

DROP POLICY IF EXISTS "reviews_select_public" ON public.reviews;
CREATE POLICY "reviews_select_public"
ON public.reviews FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;
CREATE POLICY "reviews_insert_own"
ON public.reviews FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_update_own" ON public.reviews;
CREATE POLICY "reviews_update_own"
ON public.reviews FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_delete_own" ON public.reviews;
CREATE POLICY "reviews_delete_own"
ON public.reviews FOR DELETE
TO authenticated
USING (auth.uid() = user_id);




CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('buyer','seller')),
  type text NOT NULL CHECK (type IN (
    'order_created','payment_success','order_delivering','order_completed',
    'promo','incoming_order','subscription_active','subscription_renewed',
    'subscription_expiring','subscription_changed','subscription_expired'
  )),
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  reference_id text,
  href text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, role, created_at DESC);

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);




DROP POLICY IF EXISTS "notifications_insert_any_authed" ON public.notifications;
CREATE POLICY "notifications_insert_any_authed"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own"
ON public.notifications FOR DELETE
TO authenticated
USING (auth.uid() = user_id);




CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Rumah' CHECK (label IN ('Rumah','Kos','Sekolah','Lainnya')),
  receiver_name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  province text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  district text NOT NULL DEFAULT '',
  full_address text NOT NULL,
  note text,
  is_selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS addresses_one_selected_per_user
  ON public.addresses(user_id) WHERE is_selected;

DROP POLICY IF EXISTS "addresses_all_own" ON public.addresses;
CREATE POLICY "addresses_all_own"
ON public.addresses FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);




CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_code text,
  type text NOT NULL CHECK (type IN ('earned','spent')),
  amount integer NOT NULL CHECK (amount > 0),
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON public.coin_transactions(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS coin_tx_once_per_order_type
  ON public.coin_transactions(user_id, order_code, type) WHERE order_code IS NOT NULL;

DROP POLICY IF EXISTS "coin_tx_select_own" ON public.coin_transactions;
CREATE POLICY "coin_tx_select_own"
ON public.coin_transactions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "coin_tx_insert_own" ON public.coin_transactions;
CREATE POLICY "coin_tx_insert_own"
ON public.coin_transactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);




CREATE TABLE IF NOT EXISTS public.promo_codes (
  code text PRIMARY KEY,
  percent_off integer NOT NULL CHECK (percent_off BETWEEN 1 AND 100),
  is_valid boolean NOT NULL DEFAULT true,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promo_codes_read_public" ON public.promo_codes;
CREATE POLICY "promo_codes_read_public"
ON public.promo_codes FOR SELECT
TO anon, authenticated USING (is_valid = true);

DROP POLICY IF EXISTS "promo_codes_admin_write" ON public.promo_codes;
CREATE POLICY "promo_codes_admin_write"
ON public.promo_codes FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));




CREATE OR REPLACE FUNCTION public.reserve_stock(p_product_id uuid, p_quantity integer)
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
   WHERE id = p_product_id
     AND stock >= p_quantity;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated = 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_stock(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.reserve_stock(uuid, integer) TO authenticated;




DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;




INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true), ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "rebites_public_read_media" ON storage.objects;
CREATE POLICY "rebites_public_read_media"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id IN ('product-images','avatars'));

DROP POLICY IF EXISTS "rebites_auth_upload_media" ON storage.objects;
CREATE POLICY "rebites_auth_upload_media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('product-images','avatars'));

DROP POLICY IF EXISTS "rebites_auth_update_media" ON storage.objects;
CREATE POLICY "rebites_auth_update_media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id IN ('product-images','avatars'))
WITH CHECK (bucket_id IN ('product-images','avatars'));

DROP POLICY IF EXISTS "rebites_auth_delete_media" ON storage.objects;
CREATE POLICY "rebites_auth_delete_media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id IN ('product-images','avatars'));
