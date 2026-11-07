





















































































ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';



UPDATE public.profiles
SET account_status = 'active'
WHERE account_status IS NULL;



DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'profiles_account_status_check'
      AND n.nspname = 'public'
      AND t.relname = 'profiles'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_status_check
      CHECK (account_status IN ('active', 'suspended', 'banned'));
  END IF;
END
$$;


DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'profiles'
      AND a.attname = 'account_status'
      AND NOT a.attnotnull
  ) THEN
    ALTER TABLE public.profiles
      ALTER COLUMN account_status SET NOT NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_profiles_account_status
  ON public.profiles(account_status);




CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  activity_type text NOT NULL CHECK (activity_type IN (
    'login',
    'register',
    'product_created',
    'product_updated',
    'product_deleted',
    'order_created',
    'order_cancelled',
    'store_updated',
    'subscription_changed',
    'report_received',
    'warning_received'
  )),
  description text NOT NULL,
  target_type text,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id
  ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_activity_type
  ON public.activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON public.activity_logs(created_at DESC);




GRANT SELECT, INSERT
  ON public.activity_logs TO authenticated, service_role;


DROP POLICY IF EXISTS "activity_logs_select_own_or_admin" ON public.activity_logs;
CREATE POLICY "activity_logs_select_own_or_admin"
ON public.activity_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin());



DROP POLICY IF EXISTS "activity_logs_insert_own_or_admin" ON public.activity_logs;
CREATE POLICY "activity_logs_insert_own_or_admin"
ON public.activity_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR public.is_admin());




CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  activity_id uuid REFERENCES public.activity_logs(id) ON DELETE SET NULL,
  category text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_reports_reported_user_id
  ON public.reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_by
  ON public.reports(reported_by);
CREATE INDEX IF NOT EXISTS idx_reports_status
  ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_activity_id
  ON public.reports(activity_id);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.reports TO authenticated, service_role;



DROP POLICY IF EXISTS "reports_select_involved_or_admin" ON public.reports;
CREATE POLICY "reports_select_involved_or_admin"
ON public.reports FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR auth.uid() = reported_by
  OR auth.uid() = reported_user_id
);


DROP POLICY IF EXISTS "reports_insert_own_or_admin" ON public.reports;
CREATE POLICY "reports_insert_own_or_admin"
ON public.reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reported_by OR public.is_admin());




DROP POLICY IF EXISTS "reports_update_admin" ON public.reports;
CREATE POLICY "reports_update_admin"
ON public.reports FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());















CREATE OR REPLACE FUNCTION public.enforce_report_insert_defaults()
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
    NEW.reported_by := auth.uid();
  END IF;
  NEW.status := 'open';
  NEW.resolved_by := NULL;
  NEW.resolved_at := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reports_insert_defaults ON public.reports;
CREATE TRIGGER trg_reports_insert_defaults
  BEFORE INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_report_insert_defaults();




CREATE TABLE IF NOT EXISTS public.warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  report_id uuid REFERENCES public.reports(id) ON DELETE SET NULL,
  issued_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  warning_level smallint NOT NULL CHECK (warning_level IN (1, 2, 3)),
  category text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.warnings ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_warnings_user_id
  ON public.warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_warnings_report_id
  ON public.warnings(report_id);
CREATE INDEX IF NOT EXISTS idx_warnings_warning_level
  ON public.warnings(warning_level);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.warnings TO authenticated, service_role;


DROP POLICY IF EXISTS "warnings_select_own_or_admin" ON public.warnings;
CREATE POLICY "warnings_select_own_or_admin"
ON public.warnings FOR SELECT
TO authenticated
USING (public.is_admin() OR auth.uid() = user_id);



DROP POLICY IF EXISTS "warnings_insert_admin" ON public.warnings;
CREATE POLICY "warnings_insert_admin"
ON public.warnings FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() AND issued_by = auth.uid());

DROP POLICY IF EXISTS "warnings_update_admin" ON public.warnings;
CREATE POLICY "warnings_update_admin"
ON public.warnings FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());








CREATE TABLE IF NOT EXISTS public.sanctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  warning_id uuid REFERENCES public.warnings(id) ON DELETE SET NULL,
  issued_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sanction_type text NOT NULL CHECK (sanction_type IN ('suspend', 'ban', 'delete')),
  reason text NOT NULL,
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at IS NULL OR end_at > start_at)
);

ALTER TABLE public.sanctions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_sanctions_user_id
  ON public.sanctions(user_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_warning_id
  ON public.sanctions(warning_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_sanction_type
  ON public.sanctions(sanction_type);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.sanctions TO authenticated, service_role;


DROP POLICY IF EXISTS "sanctions_select_own_or_admin" ON public.sanctions;
CREATE POLICY "sanctions_select_own_or_admin"
ON public.sanctions FOR SELECT
TO authenticated
USING (public.is_admin() OR auth.uid() = user_id);



DROP POLICY IF EXISTS "sanctions_insert_admin" ON public.sanctions;
CREATE POLICY "sanctions_insert_admin"
ON public.sanctions FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() AND issued_by = auth.uid());

DROP POLICY IF EXISTS "sanctions_update_admin" ON public.sanctions;
CREATE POLICY "sanctions_update_admin"
ON public.sanctions FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());









CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id
  ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target
  ON public.admin_audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
  ON public.admin_audit_logs(created_at DESC);


GRANT SELECT, INSERT
  ON public.admin_audit_logs TO authenticated, service_role;

DROP POLICY IF EXISTS "admin_audit_logs_select_admin" ON public.admin_audit_logs;
CREATE POLICY "admin_audit_logs_select_admin"
ON public.admin_audit_logs FOR SELECT
TO authenticated
USING (public.is_admin());



DROP POLICY IF EXISTS "admin_audit_logs_insert_admin" ON public.admin_audit_logs;
CREATE POLICY "admin_audit_logs_insert_admin"
ON public.admin_audit_logs FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() AND admin_id = auth.uid());










DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());







CREATE OR REPLACE FUNCTION public.lock_profiles_account_status_on_update()
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
    NEW.account_status := OLD.account_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_lock_account_status ON public.profiles;
CREATE TRIGGER trg_profiles_lock_account_status
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.lock_profiles_account_status_on_update();




















CREATE OR REPLACE FUNCTION public.enforce_report_resolution_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('resolved', 'dismissed') THEN
    IF OLD.status IN ('resolved', 'dismissed') THEN
      NEW.resolved_by := OLD.resolved_by;
    ELSE
      NEW.resolved_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reports_resolution_attribution ON public.reports;
CREATE TRIGGER trg_reports_resolution_attribution
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_report_resolution_attribution();


























ALTER TABLE public.admin_audit_logs ALTER COLUMN reason DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'admin_audit_logs_reason_or_auto_check'
      AND n.nspname = 'public'
      AND t.relname = 'admin_audit_logs'
  ) THEN
    ALTER TABLE public.admin_audit_logs
      ADD CONSTRAINT admin_audit_logs_reason_or_auto_check
      CHECK (reason IS NOT NULL OR (metadata ? 'auto'));
  END IF;
END
$$;






CREATE OR REPLACE FUNCTION public.audit_report_resolution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IN ('resolved', 'dismissed')
     OR NEW.status NOT IN ('resolved', 'dismissed') THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.admin_audit_logs
    (admin_id, action, target_type, target_id, reason, metadata)
  VALUES (
    auth.uid(),
    CASE NEW.status WHEN 'resolved' THEN 'resolve_report' ELSE 'dismiss_report' END,
    'report',
    NEW.id,
    NULL,
    jsonb_build_object(
      'auto', true,
      'from_status', OLD.status,
      'to_status', NEW.status,
      'reported_user_id', NEW.reported_user_id,
      'category', NEW.category
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_report_resolution ON public.reports;
CREATE TRIGGER trg_audit_report_resolution
  AFTER UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.audit_report_resolution();



CREATE OR REPLACE FUNCTION public.audit_warning_issued()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_logs
    (admin_id, action, target_type, target_id, reason, metadata)
  VALUES (
    auth.uid(),
    'issue_warning',
    'user',
    NEW.user_id,
    NEW.reason,
    jsonb_build_object(
      'auto', true,
      'warning_level', NEW.warning_level,
      'report_id', NEW.report_id,
      'issued_by', NEW.issued_by
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_warning_issued ON public.warnings;
CREATE TRIGGER trg_audit_warning_issued
  AFTER INSERT ON public.warnings
  FOR EACH ROW EXECUTE FUNCTION public.audit_warning_issued();



CREATE OR REPLACE FUNCTION public.audit_sanction_issued()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_audit_logs
    (admin_id, action, target_type, target_id, reason, metadata)
  VALUES (
    auth.uid(),
    'issue_sanction',
    'user',
    NEW.user_id,
    NEW.reason,
    jsonb_build_object(
      'auto', true,
      'sanction_type', NEW.sanction_type,
      'warning_id', NEW.warning_id,
      'start_at', NEW.start_at,
      'end_at', NEW.end_at,
      'issued_by', NEW.issued_by
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_sanction_issued ON public.sanctions;
CREATE TRIGGER trg_audit_sanction_issued
  AFTER INSERT ON public.sanctions
  FOR EACH ROW EXECUTE FUNCTION public.audit_sanction_issued();






CREATE OR REPLACE FUNCTION public.audit_account_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.account_status IS NOT DISTINCT FROM NEW.account_status THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.admin_audit_logs
    (admin_id, action, target_type, target_id, reason, metadata)
  VALUES (
    auth.uid(),
    CASE NEW.account_status
      WHEN 'suspended' THEN 'suspend_user'
      WHEN 'banned' THEN 'ban_user'
      ELSE 'activate_user'
    END,
    'user',
    NEW.id,
    NULL,
    jsonb_build_object(
      'auto', true,
      'old_status', OLD.account_status,
      'new_status', NEW.account_status
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_account_status_change ON public.profiles;
CREATE TRIGGER trg_audit_account_status_change
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_account_status_change();
