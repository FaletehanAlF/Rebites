-- ============================================================================
-- 0021: Product Verification foundation (Fase 2, tahap 1)
--
-- Menambahkan ke public.products:
--   - verification_status ('pending' | 'approved' | 'rejected'), default 'pending'
--   - rejection_reason (nullable text)
--   - reviewed_at (nullable timestamptz)
--   - reviewed_by (nullable uuid -> profiles(id))
--
-- Tujuan:
--   - products.status = status operasional ('available' | 'sold_out' | 'hidden')
--   - products.verification_status = status pemeriksaan admin
--   - Keduanya dipertahankan terpisah; migration ini TIDAK mengubah
--     products.status yang sudah ada.
--
-- Membuat tabel public.moderation_logs untuk riwayat pemeriksaan produk.
--
-- Keamanan (client memakai anon key langsung dari browser):
--   - sellerProductToRow() di lib/product-storage.ts tidak pernah memetakan
--     kolom verifikasi dari input client (whitelist).
--   - Policy products_insert_own mewajibkan verification_status='pending'
--     dan reviewed_*/rejection_reason NULL.
--   - Trigger BEFORE INSERT memaksa nilai tersebut bila bukan admin
--     (fail-safe ke pending, bukan reject).
--   - Trigger BEFORE UPDATE mengembalikan kolom verifikasi ke OLD bila
--     bukan admin, sehingga seller tetap bisa update stok/harga/deskripsi
--     pada produk approved tanpa bisa mengubah hasil moderasi.
--   - Semua pengecekan admin memakai public.is_admin() (SECURITY DEFINER,
--     pola Fase 1) agar tidak recursion.
--
-- Backfill: produk lama yang sudah live di-grandfather menjadi 'approved'
-- agar tidak tiba-tiba hilang dari marketplace. Hanya baris yang dibuat
-- sebelum migration ini (cutoff created_at) yang di-update, sehingga
-- rerun migration tidak akan meng-approve produk pending baru.
--
-- Idempoten: aman dijalankan berulang (IF NOT EXISTS / OR REPLACE /
-- DROP IF EXISTS).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Kolom verifikasi di products
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS rejection_reason text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_verification_status
  ON public.products(verification_status);

-- Grandfather produk lama: semua yang dibuat sebelum migration ini dianggap
-- sudah live dan diberi 'approved' agar marketplace tidak kosong tiba-tiba.
-- Produk baru (created_at >= cutoff) tidak tersentuh bila migration di-rerun.
UPDATE public.products
SET verification_status = 'approved'
WHERE verification_status = 'pending'
  AND created_at < '2026-09-28T12:00:01Z'::timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Tabel moderation_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  moderator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('approve', 'reject')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_moderation_logs_product_id
  ON public.moderation_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_moderation_logs_moderator_id
  ON public.moderation_logs(moderator_id);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.moderation_logs TO authenticated, service_role;

-- Admin melihat semua log; seller hanya log produk miliknya (join lewat
-- umkm_profiles, bukan subquery langsung ke profiles agar tidak recursion);
-- buyer/anon tidak mendapat akses baca.
DROP POLICY IF EXISTS "moderation_logs_select_admin_or_owner" ON public.moderation_logs;
CREATE POLICY "moderation_logs_select_admin_or_owner"
ON public.moderation_logs FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.umkm_profiles u ON u.id = p.umkm_id
    WHERE p.id = moderation_logs.product_id
      AND u.user_id = auth.uid()
  )
);

-- Tulis log hanya admin. Insert normal dilakukan server-side (service_role
-- bypass RLS); policy ini menjaga bila admin memakai anon key dari client.
DROP POLICY IF EXISTS "moderation_logs_admin_insert" ON public.moderation_logs;
CREATE POLICY "moderation_logs_admin_insert"
ON public.moderation_logs FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "moderation_logs_admin_update" ON public.moderation_logs;
CREATE POLICY "moderation_logs_admin_update"
ON public.moderation_logs FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "moderation_logs_admin_delete" ON public.moderation_logs;
CREATE POLICY "moderation_logs_admin_delete"
ON public.moderation_logs FOR DELETE
TO authenticated
USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3. INSERT products: seller hanya boleh masuk sebagai pending
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "products_insert_own" ON public.products;
CREATE POLICY "products_insert_own"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.umkm_profiles u
    WHERE u.id = products.umkm_id AND u.user_id = auth.uid()
  )
  AND products.verification_status = 'pending'
  AND products.reviewed_at IS NULL
  AND products.reviewed_by IS NULL
  AND products.rejection_reason IS NULL
);

-- ---------------------------------------------------------------------------
-- 4. Trigger: paksa kolom verifikasi (BEFORE INSERT / BEFORE UPDATE)
--
-- RLS di atas memblokir payload nakal dengan error; trigger di bawah
-- membuat perilaku fail-safe: bila bukan admin, nilai verifikasi dipaksa
-- kembali (insert -> pending/NULL, update -> OLD) sehingga update
-- stok/harga/deskripsi seller tidak gagal hanya karena payload lama
-- mengandung field verifikasi.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_product_verification_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.verification_status := 'pending';
    NEW.reviewed_at := NULL;
    NEW.reviewed_by := NULL;
    NEW.rejection_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_verification_insert ON public.products;
CREATE TRIGGER trg_products_verification_insert
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_verification_on_insert();

CREATE OR REPLACE FUNCTION public.enforce_product_verification_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.verification_status := OLD.verification_status;
    NEW.reviewed_at := OLD.reviewed_at;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.rejection_reason := OLD.rejection_reason;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_verification_update ON public.products;
CREATE TRIGGER trg_products_verification_update
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_verification_on_update();

-- ---------------------------------------------------------------------------
-- Catatan yang SENGAJA tidak diubah pada tahap ini:
--   - products_select_public tetap USING (true); filter approved dilakukan
--     di lapisan aplikasi (lib/catalog.ts) agar dashboard seller (yang
--     memakai select own tanpa filter) dan halaman detail tidak pecah.
--     Pengetatan SELECT via RLS dijadwalkan pada tahap Admin API.
--   - products_update_own_or_admin (Fase 1) tetap; proteksi kolom ditangani
--     trigger di atas agar seller tetap bisa update stok/harga produk
--     approved tanpa bisa mengubah hasil moderasi.
--   - products.status tidak disentuh sama sekali.
-- ---------------------------------------------------------------------------
