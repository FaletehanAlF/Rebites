






DROP SCHEMA public CASCADE;
CREATE SCHEMA public;


GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;


DELETE FROM supabase_migrations.schema_migrations;


DELETE FROM storage.objects WHERE bucket_id IN ('product-images','avatars');
DELETE FROM storage.buckets WHERE id IN ('product-images','avatars');
