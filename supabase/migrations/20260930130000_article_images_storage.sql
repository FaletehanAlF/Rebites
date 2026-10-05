-- ============================================================================
-- 0025: Articles Storage (Fase 2A - Storage saja)
--
-- Bucket article-images untuk cover image artikel.
-- Fase 2A: storage bucket + policies saja.
--
-- Audit pola project (0003, 0005, 0014):
--   - bucket dibuat via INSERT INTO storage.buckets (id, name, public)
--     ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public
--   - policy di storage.objects per operasi:
--     SELECT TO anon, authenticated USING (bucket_id ...)
--     INSERT TO authenticated WITH CHECK (bucket_id ...)
--     UPDATE/DELETE TO authenticated USING/WITH CHECK (bucket_id ...)
--   - admin ditentukan via public.is_admin() (SECURITY DEFINER,
--     baca profiles.role tanpa recursion, pola 0020/0022).
--   - kolom ownership storage.objects adalah "owner" (uuid),
--     BUKAN "owner_id". Perbandingan: auth.uid() = owner.
--
-- Kepemilikan: memakai kolom owner (diset otomatis Supabase saat
-- upload via authenticated client), bukan asumsi path/nama file,
-- sehingga user tidak bisa UPDATE/DELETE object milik user lain
-- hanya dengan menebak path. Tidak ada konvensi path <uid>/...
-- yang dipaksakan pada INSERT agar upload cover fleksibel.
--
-- Idempoten: aman dijalankan berulang.
-- Tidak menyentuh tabel lain, bucket lain (product-images, avatars,
-- umkm-logos), policy bucket lain, atau RLS tabel lain.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Bucket article-images (public read)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('article-images', 'article-images', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- ---------------------------------------------------------------------------
-- 2. Storage policies
-- ---------------------------------------------------------------------------
-- Public: baca semua object artikel (bucket public)
DROP POLICY IF EXISTS "articles_public_read" ON storage.objects;
CREATE POLICY "articles_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'article-images');

-- Authenticated: upload object artikel
DROP POLICY IF EXISTS "articles_auth_upload" ON storage.objects;
CREATE POLICY "articles_auth_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'article-images');

-- Owner: update object sendiri, admin bisa update semua
DROP POLICY IF EXISTS "articles_owner_update" ON storage.objects;
CREATE POLICY "articles_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'article-images' AND (auth.uid() = owner OR public.is_admin()))
WITH CHECK (bucket_id = 'article-images' AND (auth.uid() = owner OR public.is_admin()));

-- Owner: delete object sendiri, admin bisa delete semua
DROP POLICY IF EXISTS "articles_owner_delete" ON storage.objects;
CREATE POLICY "articles_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'article-images' AND (auth.uid() = owner OR public.is_admin()));