




















CREATE TABLE IF NOT EXISTS public.store_visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.umkm_profiles(id) ON DELETE CASCADE,
  visitor_key text NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  visit_count integer NOT NULL DEFAULT 1 CHECK (visit_count > 0),
  UNIQUE (store_id, visitor_key)
);

CREATE TABLE IF NOT EXISTS public.store_visitor_days (
  visitor_id uuid NOT NULL REFERENCES public.store_visitors(id) ON DELETE CASCADE,
  day date NOT NULL,
  visits integer NOT NULL DEFAULT 1 CHECK (visits > 0),
  PRIMARY KEY (visitor_id, day)
);

CREATE INDEX IF NOT EXISTS idx_store_visitor_days_day
  ON public.store_visitor_days(day);
CREATE INDEX IF NOT EXISTS idx_store_visitors_store
  ON public.store_visitors(store_id);

ALTER TABLE public.store_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_visitor_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_visitors_select_owner_admin" ON public.store_visitors;
CREATE POLICY "store_visitors_select_owner_admin"
ON public.store_visitors FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.umkm_profiles up
    WHERE up.id = store_visitors.store_id
      AND up.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "store_visitor_days_select_owner_admin" ON public.store_visitor_days;
CREATE POLICY "store_visitor_days_select_owner_admin"
ON public.store_visitor_days FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.store_visitors sv
    JOIN public.umkm_profiles up ON up.id = sv.store_id
    WHERE sv.id = store_visitor_days.visitor_id
      AND up.user_id = auth.uid()
  )
);

GRANT SELECT ON public.store_visitors TO authenticated;
GRANT SELECT ON public.store_visitor_days TO authenticated;

CREATE OR REPLACE FUNCTION public.record_store_visit(
  p_store_id uuid, p_key text, p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_day date;
BEGIN
  IF p_store_id IS NULL OR p_key IS NULL OR btrim(p_key) = '' THEN
    RAISE EXCEPTION 'toko dan kunci pengunjung wajib diisi';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.umkm_profiles WHERE id = p_store_id) THEN
    RAISE EXCEPTION 'toko tidak ditemukan';
  END IF;

  v_day := ((now() + interval '7 hours') AT TIME ZONE 'UTC')::date;

  INSERT INTO public.store_visitors AS sv
    (store_id, visitor_key, user_id, first_seen_at, last_seen_at, visit_count)
  VALUES (p_store_id, btrim(p_key), p_user_id, now(), now(), 1)
  ON CONFLICT (store_id, visitor_key) DO UPDATE
    SET last_seen_at = now(),
        visit_count = sv.visit_count + 1,
        user_id = COALESCE(sv.user_id, EXCLUDED.user_id)
  RETURNING id INTO v_id;

  INSERT INTO public.store_visitor_days AS svd (visitor_id, day, visits)
  VALUES (v_id, v_day, 1)
  ON CONFLICT (visitor_id, day) DO UPDATE
    SET visits = svd.visits + 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_store_visit(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_store_visit(uuid, text, uuid) TO service_role;

COMMENT ON FUNCTION public.record_store_visit(uuid, text, uuid) IS
  'Mencatat satu kunjungan toko: dedup per (store_id, visitor_key) plus rekap harian WIB. Hanya service_role yang boleh memanggil.';

CREATE OR REPLACE FUNCTION public.get_store_visitor_stats(
  p_store_id uuid, p_days integer DEFAULT 14
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days integer;
  v_today date;
  v_from date;
  v_result jsonb;
  v_owner uuid;
BEGIN
  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'toko wajib diisi';
  END IF;

  SELECT user_id INTO v_owner FROM public.umkm_profiles WHERE id = p_store_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'toko tidak ditemukan';
  END IF;

  IF NOT public.is_admin() AND v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Akses ditolak. Hanya pemilik toko.' USING ERRCODE = '42501';
  END IF;

  v_days := GREATEST(1, LEAST(COALESCE(p_days, 14), 90));
  v_today := ((now() + interval '7 hours') AT TIME ZONE 'UTC')::date;
  v_from := v_today - (v_days - 1);

  SELECT jsonb_build_object(
    'total_visitors', (
      SELECT count(*) FROM public.store_visitors WHERE store_id = p_store_id
    ),
    'total_visits', (
      SELECT COALESCE(sum(visit_count), 0) FROM public.store_visitors WHERE store_id = p_store_id
    ),
    'today', (
      SELECT count(*) FROM public.store_visitor_days svd
      JOIN public.store_visitors sv ON sv.id = svd.visitor_id
      WHERE sv.store_id = p_store_id AND svd.day = v_today
    ),
    'yesterday', (
      SELECT count(*) FROM public.store_visitor_days svd
      JOIN public.store_visitors sv ON sv.id = svd.visitor_id
      WHERE sv.store_id = p_store_id AND svd.day = v_today - 1
    ),
    'range_days', v_days,
    'range_visitors', (
      SELECT count(*) FROM public.store_visitor_days svd
      JOIN public.store_visitors sv ON sv.id = svd.visitor_id
      WHERE sv.store_id = p_store_id AND svd.day >= v_from AND svd.day <= v_today
    ),
    'daily', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('day', d.day, 'visitors', d.visitors, 'visits', d.visits)
        ORDER BY d.day
      )
      FROM (
        SELECT svd.day, count(*) AS visitors, sum(svd.visits) AS visits
        FROM public.store_visitor_days svd
        JOIN public.store_visitors sv ON sv.id = svd.visitor_id
        WHERE sv.store_id = p_store_id AND svd.day >= v_from AND svd.day <= v_today
        GROUP BY svd.day
      ) d
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_store_visitor_stats(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_store_visitor_stats(uuid, integer) TO authenticated;

COMMENT ON FUNCTION public.get_store_visitor_stats(uuid, integer) IS
  'Rekap pengunjung toko untuk pemilik toko (atau admin). Menolak bukan pemilik (42501).';
