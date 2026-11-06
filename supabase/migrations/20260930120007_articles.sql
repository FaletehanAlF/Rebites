-- ============================================================================
-- 0024: Articles (Fase 1 - Database + RLS saja)
--
-- Tabel public.articles untuk fitur Artikel/Blog ReBites.
-- Fase 1: tulis hanya admin (via public.is_admin()).
-- Public hanya bisa SELECT published articles.
--
-- Idempoten: aman dijalankan berulang.
-- Tidak menyentuh tabel lain, role, policy tabel lain, atau trigger lain.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabel articles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL,
  excerpt text,
  content text NOT NULL,
  cover_image text,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  umkm_id uuid REFERENCES public.umkm_profiles(id) ON DELETE SET NULL,
  category text,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Constraint
-- ---------------------------------------------------------------------------
ALTER TABLE public.articles
  ADD CONSTRAINT articles_slug_unique UNIQUE (slug),
  ADD CONSTRAINT articles_status_check CHECK (status IN ('draft','published','archived'));

-- ---------------------------------------------------------------------------
-- 3. Index
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS articles_slug_idx ON public.articles(slug);
CREATE INDEX IF NOT EXISTS articles_status_idx ON public.articles(status);
CREATE INDEX IF NOT EXISTS articles_published_at_idx ON public.articles(published_at);
CREATE INDEX IF NOT EXISTS articles_author_id_idx ON public.articles(author_id);
CREATE INDEX IF NOT EXISTS articles_umkm_id_idx ON public.articles(umkm_id);

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Public: hanya baca artikel published yang sudah masuk masa publish
DROP POLICY IF EXISTS articles_select_public ON public.articles;
CREATE POLICY articles_select_public
ON public.articles FOR SELECT
TO anon, authenticated
USING (
  status = 'published'
  AND published_at IS NOT NULL
  AND published_at <= now()
);

-- Admin: full akses semua artikel
DROP POLICY IF EXISTS articles_admin_all ON public.articles;
CREATE POLICY articles_admin_all
ON public.articles FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Trigger updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_articles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_articles_updated_at ON public.articles;
CREATE TRIGGER trg_articles_updated_at
BEFORE UPDATE ON public.articles
FOR EACH ROW EXECUTE FUNCTION public.set_articles_updated_at();