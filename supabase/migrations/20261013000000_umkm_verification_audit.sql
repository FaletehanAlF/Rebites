-- ============================================================================
-- A: Audit perubahan verifikasi UMKM (umkm_profiles.is_verified)
--
-- MASALAH yang ditutup:
--   Toggle verifikasi UMKM (POST /api/admin/umkm/:id/verify) hanya mengubah
--   umkm_profiles.is_verified tanpa satu pun jejak audit — admin_audit_logs
--   tidak pernah punya baris target_type='umkm' (hasil audit read-only).
--   Akibatnya perubahan badge "Terverifikasi" tidak bisa ditelusuri.
--
-- KEPUTUSAN DESAIN:
--   1. Audit ditulis di DATABASE via trigger AFTER UPDATE (pola 9b-9e
--      20261001000000), bukan di API: satu transaksi dengan UPDATE-nya,
--      tidak bergantung pada kedisiplinan logging API layer.
--   2. Hanya TRANSISI is_verified yang dicatat:
--      WHEN (OLD.is_verified IS DISTINCT FROM NEW.is_verified).
--      Perubahan kolom lain (nama toko, kategori, kota, dll) tidak
--      menghasilkan baris audit.
--   3. Perubahan yang DIBATALKAN trigger proteksi trg_umkm_lock_sensitive
--      (20261007000000) TIDAK tercatat: trigger itu berjalan BEFORE UPDATE
--      dan mengembalikan NEW.is_verified := OLD.is_verified untuk non-admin.
--      Kondisi WHEN pada trigger AFTER dievaluasi setelah seluruh BEFORE
--      trigger berjalan, sehingga perubahan yang di-revert = tanpa perubahan
--      net -> tidak ada baris audit.
--   4. target_type='umkm', target_id=NEW.id (PK umkm_profiles). Index
--      idx_admin_audit_logs_target (target_type, target_id) sudah ada
--      (20261001000000) dan aplikasi sudah memetakan label 'umkm' -> 'UMKM'
--      (LABEL_TIPE_TARGET, admin-format.ts).
--   5. Action: 'verify_umkm' (false -> true) dan 'unverify_umkm' (true ->
--      false). Transisi lain (null -> x) tidak mungkin: kolom NOT NULL.
--   6. reason NULL + metadata.auto=true — mematuhi CHECK
--      admin_audit_logs_reason_or_auto_check
--      (reason IS NOT NULL OR (metadata ? 'auto')). Keputusan trigger DB
--      tidak punya alasan manusia; NULL = jujur, pola sama dengan
--      audit_report_resolution / audit_account_status_change.
--   7. admin_id = auth.uid(); NULL untuk service_role/system. Prinsip
--      20261001000000: service_role TIDAK dikecualikan dari pencatatan —
--      aksi server-side tetap tercatat dengan admin_id NULL.
--   8. actor_source: 'auth' bila auth.uid() ada, 'service_or_system' bila
--      NULL. UMKM/seller tidak bisa memalsukan aktor: nilai diambil
--      server-side, bukan payload client (trigger BEFORE penjaga juga
--      membuat non-admin tidak mungkin mengubah is_verified).
--   9. Metadata: old, new, business_name (snapshot), owner_user_id,
--      actor_source, auto. Snapshot business_name + owner_user_id agar
--      riwayat tetap terbaca walau toko berganti nama / kepemilikan.
--  10. TIDAK ada backfill/rekonstruksi riwayat lama: transisi lama tidak
--      punya waktu/pelaku yang terekam, mengarang riwayat dilarang.
--
-- KEAMANAN:
--   - SECURITY DEFINER + SET search_path = public (pola audit trigger
--     lain): INSERT audit melewati RLS sebagai owner; INSERT manual via
--     client tetap tunduk policy admin_audit_logs_insert_admin yang TIDAK
--     diubah.
--   - Tanpa trigger pada admin_audit_logs -> tanpa loop.
--   - Trigger hanya INSERT; tidak pernah UPDATE/DELETE baris audit lama.
--   - Tidak ada perubahan RLS, policy, grant, atau data.
--   - REVOKE EXECUTE dari PUBLIC/anon/authenticated (pola baru P0-B/P0-C/
--     P1-A): trigger tetap berjalan (eksekusi trigger tidak memakai
--     privilege EXECUTE pemanggil), tetapi fungsi tidak bisa dipanggil
--     langsung lewat RPC.
--
-- IDEMPOTEN: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS +
--   CREATE TRIGGER; aman dijalankan berulang.
--
-- ROLLBACK (manual, bila perlu membatalkan):
--   DROP TRIGGER IF EXISTS trg_umkm_verification_audit
--     ON public.umkm_profiles;
--   DROP FUNCTION IF EXISTS public.audit_umkm_verification_change();
--   (Baris audit yang sudah tertulis TIDAK dihapus — append-only.)
--
-- PRASYARAT (dibuktikan dari repo, tetap perlu dicek read-only di target):
--   - public.umkm_profiles: id uuid PK, user_id uuid NULL, business_name
--     text, is_verified boolean NOT NULL DEFAULT false
--     (20260806050337_0001 + 20260824120000_0003).
--   - public.admin_audit_logs + CHECK reason-or-auto + grant SELECT, INSERT
--     (20261001000000).
--   - trg_umkm_lock_sensitive BEFORE UPDATE (20261007000000).
--
-- JANGAN dijalankan ke Supabase V1 tanpa persetujuan eksplisit owner, dan
-- JANGAN pernah ke V2. Konfirmasi identitas project target dan status
-- migrasi (checklist verifikasi read-only) sebelum apply.
-- ============================================================================

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
