









CREATE TABLE IF NOT EXISTS public.store_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  umkm_id uuid NOT NULL REFERENCES public.umkm_profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT store_follows_user_umkm_unique UNIQUE (user_id, umkm_id)
);

ALTER TABLE public.store_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_follows_select_own" ON public.store_follows;
CREATE POLICY "store_follows_select_own"
ON public.store_follows FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "store_follows_insert_own" ON public.store_follows;
CREATE POLICY "store_follows_insert_own"
ON public.store_follows FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "store_follows_delete_own" ON public.store_follows;
CREATE POLICY "store_follows_delete_own"
ON public.store_follows FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
