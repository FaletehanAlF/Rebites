



















DELETE FROM public.umkm_profiles a
USING public.umkm_profiles b
WHERE a.user_id = b.user_id
  AND a.id <> b.id
  AND (a.created_at, a.id) < (b.created_at, b.id);


ALTER TABLE public.umkm_profiles
  DROP CONSTRAINT IF EXISTS umkm_profiles_user_id_key;
ALTER TABLE public.umkm_profiles
  ADD CONSTRAINT umkm_profiles_user_id_key UNIQUE (user_id);
