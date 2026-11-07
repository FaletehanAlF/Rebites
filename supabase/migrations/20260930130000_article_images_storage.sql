































INSERT INTO storage.buckets (id, name, public)
VALUES ('article-images', 'article-images', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;





DROP POLICY IF EXISTS "articles_public_read" ON storage.objects;
CREATE POLICY "articles_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'article-images');


DROP POLICY IF EXISTS "articles_auth_upload" ON storage.objects;
CREATE POLICY "articles_auth_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'article-images');


DROP POLICY IF EXISTS "articles_owner_update" ON storage.objects;
CREATE POLICY "articles_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'article-images' AND (auth.uid() = owner OR public.is_admin()))
WITH CHECK (bucket_id = 'article-images' AND (auth.uid() = owner OR public.is_admin()));


DROP POLICY IF EXISTS "articles_owner_delete" ON storage.objects;
CREATE POLICY "articles_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'article-images' AND (auth.uid() = owner OR public.is_admin()));