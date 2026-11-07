









UPDATE storage.buckets SET public = true WHERE id = 'product-images' AND public = false;
UPDATE storage.buckets SET public = true WHERE id = 'avatars' AND public = false;
UPDATE storage.buckets SET public = true WHERE id = 'umkm-logos' AND public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true),
       ('avatars', 'avatars', true),
       ('umkm-logos', 'umkm-logos', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;


DROP POLICY IF EXISTS "rebites_public_read_media" ON storage.objects;
CREATE POLICY "rebites_public_read_media"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id IN ('product-images','avatars','umkm-logos'));

DROP POLICY IF EXISTS "rebites_auth_upload_media" ON storage.objects;
CREATE POLICY "rebites_auth_upload_media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('product-images','avatars','umkm-logos'));

DROP POLICY IF EXISTS "rebites_auth_update_media" ON storage.objects;
CREATE POLICY "rebites_auth_update_media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id IN ('product-images','avatars','umkm-logos'))
WITH CHECK (bucket_id IN ('product-images','avatars','umkm-logos'));

DROP POLICY IF EXISTS "rebites_auth_delete_media" ON storage.objects;
CREATE POLICY "rebites_auth_delete_media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id IN ('product-images','avatars','umkm-logos'));



DROP POLICY IF EXISTS "Anyone can view umkm logos" ON storage.objects;
CREATE POLICY "Anyone can view umkm logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'umkm-logos');

DROP POLICY IF EXISTS "Authenticated users can upload umkm logos" ON storage.objects;
CREATE POLICY "Authenticated users can upload umkm logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'umkm-logos');

DROP POLICY IF EXISTS "Users can update own umkm logos" ON storage.objects;
CREATE POLICY "Users can update own umkm logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'umkm-logos')
WITH CHECK (bucket_id = 'umkm-logos');

DROP POLICY IF EXISTS "Users can delete own umkm logos" ON storage.objects;
CREATE POLICY "Users can delete own umkm logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'umkm-logos');
