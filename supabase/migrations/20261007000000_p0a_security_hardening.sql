-- ============================================================================
-- P0-A SECURITY HARDENING (database & authorization)
--
-- 1. reserve_stock / release_stock: hanya untuk service_role.
-- 2. profiles: is_verified, role, account_status tidak bisa diset user.
-- 3. umkm_profiles: is_verified, rating tidak bisa diset owner.
-- 4. subscriptions: user tidak bisa insert/update aktivasi sendiri.
-- 5. orders: INSERT client dipaksa ke nilai default yang aman.
--
-- Semua perubahan idempotent, tidak menghapus/mengubah data existing.
-- service_role (checkout server, webhook, verify) selalu diizinkan
-- melewati trigger fail-safe dengan pola yang sama seperti
-- guard_order_payment_status / lock_profiles_account_status_on_update.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. reserve_stock / release_stock: cabut dari anon & authenticated
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.reserve_stock(text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_stock(text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_stock(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_stock(text, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. profiles: kunci is_verified (UPDATE) + paksa default aman (INSERT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lock_profiles_is_verified_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_admin() THEN
    NEW.is_verified := OLD.is_verified;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_lock_is_verified ON public.profiles;
CREATE TRIGGER trg_profiles_lock_is_verified
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.lock_profiles_is_verified_on_update();

CREATE OR REPLACE FUNCTION public.guard_profiles_insert_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_admin() THEN
    NEW.role := 'buyer';
    NEW.account_status := 'active';
    NEW.is_verified := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard_insert ON public.profiles;
CREATE TRIGGER trg_profiles_guard_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_insert_defaults();

-- ---------------------------------------------------------------------------
-- 3. umkm_profiles: is_verified & rating hanya admin/service_role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lock_umkm_sensitive_columns_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_admin() THEN
    NEW.is_verified := OLD.is_verified;
    NEW.rating := OLD.rating;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_umkm_lock_sensitive ON public.umkm_profiles;
CREATE TRIGGER trg_umkm_lock_sensitive
  BEFORE UPDATE ON public.umkm_profiles
  FOR EACH ROW EXECUTE FUNCTION public.lock_umkm_sensitive_columns_on_update();

CREATE OR REPLACE FUNCTION public.guard_umkm_insert_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_admin() THEN
    NEW.is_verified := false;
    NEW.rating := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_umkm_guard_insert ON public.umkm_profiles;
CREATE TRIGGER trg_umkm_guard_insert
  BEFORE INSERT ON public.umkm_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_umkm_insert_defaults();

-- ---------------------------------------------------------------------------
-- 4. subscriptions: user biasa tidak bisa insert/update aktivasi
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "subs_insert_own" ON public.subscriptions;
DROP POLICY IF EXISTS "subs_update_own_or_admin" ON public.subscriptions;

CREATE POLICY "subs_update_admin"
ON public.subscriptions FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.lock_subscriptions_sensitive_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_admin() THEN
    NEW.plan_id := OLD.plan_id;
    NEW.status := OLD.status;
    NEW.billing := OLD.billing;
    NEW.price_paid := OLD.price_paid;
    NEW.payment_method_id := OLD.payment_method_id;
    NEW.current_period_start := OLD.current_period_start;
    NEW.current_period_end := OLD.current_period_end;
    NEW.umkm_id := OLD.umkm_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscriptions_lock_sensitive ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_lock_sensitive
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.lock_subscriptions_sensitive_on_update();

-- Tanpa policy INSERT untuk authenticated, insert user langsung ditolak
-- RLS. Flow subscription sah (Xendit) memakai service_role.

-- ---------------------------------------------------------------------------
-- 5. orders: INSERT dari client dipaksa ke nilai default yang aman
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_orders_insert_client_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_admin() THEN
    NEW.payment_status := 'unpaid';
    NEW.order_status := 'pending';
    NEW.lifecycle_status := 'ongoing';
    NEW.progress_status := 'disiapkan';
    NEW.xendit_invoice_id := NULL;
    NEW.payment_method_id := NULL;
    NEW.discount := 0;
    NEW.promo_code := NULL;
    NEW.coin_used := 0;
    NEW.coin_earned := 0;
    NEW.shipping_rate := NULL;
    NEW.courier_code := NULL;
    NEW.courier_service_code := NULL;
    NEW.courier_service_name := NULL;
    NEW.shipping_snapshot := NULL;
    NEW.estimated_minutes := NULL;
    NEW.estimated_completion_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_guard_insert ON public.orders;
CREATE TRIGGER trg_orders_guard_insert
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_orders_insert_client_defaults();
