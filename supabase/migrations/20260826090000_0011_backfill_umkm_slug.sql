



DO $$
DECLARE
  row_record RECORD;
  base_slug TEXT;
  new_slug TEXT;
BEGIN
  FOR row_record IN
    SELECT id, business_name
    FROM public.umkm_profiles
    WHERE slug IS NULL OR slug = ''
  LOOP
    base_slug := lower(
      regexp_replace(
        coalesce(nullif(trim(row_record.business_name), ''), 'toko'),
        '[^a-zA-Z0-9]+', '-', 'g'
      )
    );
    base_slug := trim(both '-' from base_slug);
    IF base_slug IS NULL OR base_slug = '' THEN
      base_slug := 'toko';
    END IF;
    base_slug := left(base_slug, 48);

    new_slug := base_slug || '-' || substr(md5(random()::text), 1, 6);
    WHILE EXISTS (SELECT 1 FROM public.umkm_profiles WHERE slug = new_slug) LOOP
      new_slug := base_slug || '-' || substr(md5(random()::text), 1, 6);
    END LOOP;

    UPDATE public.umkm_profiles
    SET slug = new_slug
    WHERE id = row_record.id;
  END LOOP;
END $$;


ALTER TABLE public.umkm_profiles
  ALTER COLUMN slug SET NOT NULL;
