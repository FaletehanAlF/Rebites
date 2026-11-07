

















































































CREATE OR REPLACE FUNCTION public.audit_umkm_verification_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_source text;
BEGIN
  v_actor_source := CASE
    WHEN auth.uid() IS NOT NULL THEN 'auth'
    ELSE 'service_or_system'
  END;

  INSERT INTO public.admin_audit_logs
    (admin_id, action, target_type, target_id, reason, metadata)
  VALUES (
    auth.uid(),
    CASE
      WHEN NEW.is_verified THEN 'verify_umkm'
      ELSE 'unverify_umkm'
    END,
    'umkm',
    NEW.id,
    NULL,
    jsonb_build_object(
      'auto', true,
      'old', OLD.is_verified,
      'new', NEW.is_verified,
      'business_name', NEW.business_name,
      'owner_user_id', NEW.user_id,
      'actor_source', v_actor_source
    )
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_umkm_verification_change()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_umkm_verification_audit ON public.umkm_profiles;
CREATE TRIGGER trg_umkm_verification_audit
  AFTER UPDATE ON public.umkm_profiles
  FOR EACH ROW
  WHEN (OLD.is_verified IS DISTINCT FROM NEW.is_verified)
  EXECUTE FUNCTION public.audit_umkm_verification_change();

COMMENT ON FUNCTION public.audit_umkm_verification_change() IS
  'Audit transisi umkm_profiles.is_verified ke admin_audit_logs (action verify_umkm/unverify_umkm, target umkm). Hanya perubahan net yang tercatat; perubahan yang dikembalikan trg_umkm_lock_sensitive tidak menghasilkan baris. Tanpa backfill.';
