-- ============================================================================
-- 0023: Role change audit log (Admin User Management)
--
-- Tabel public.role_change_logs mencatat setiap perubahan profiles.role
-- yang dilakukan admin via PATCH /api/admin/users/[id]/role.
--
-- Alasan tabel baru (bukan reuse moderation_logs):
--   - moderation_logs.product_id NOT NULL REFERENCES products(id) dan
--     action CHECK ('approve','reject') — tidak cocok untuk perubahan role.
--
-- Sifat tabel: append-only. Tidak ada policy UPDATE/DELETE sehingga
-- riwayat tidak dapat diubah/dihapus via API. Tidak menyimpan
-- password/token dalam bentuk apa pun.
--
-- Idempoten: aman dijalankan berulang (IF NOT EXISTS / DROP IF EXISTS).
-- Tidak menyentuh data existing.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.role_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_role text NOT NULL CHECK (old_role IN ('admin', 'umkm', 'buyer')),
  new_role text NOT NULL CHECK (new_role IN ('admin', 'umkm', 'buyer')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.role_change_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_role_change_logs_target_user_id
  ON public.role_change_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_role_change_logs_actor_admin_id
  ON public.role_change_logs(actor_admin_id);

GRANT SELECT, INSERT
  ON public.role_change_logs TO authenticated, service_role;

-- Baca riwayat hanya admin. Penulisan normal dilakukan server-side
-- (authed client admin); policy ini menjaga bila dipakai via API langsung.
DROP POLICY IF EXISTS "role_change_logs_select_admin" ON public.role_change_logs;
CREATE POLICY "role_change_logs_select_admin"
ON public.role_change_logs FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "role_change_logs_insert_admin" ON public.role_change_logs;
CREATE POLICY "role_change_logs_insert_admin"
ON public.role_change_logs FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());
