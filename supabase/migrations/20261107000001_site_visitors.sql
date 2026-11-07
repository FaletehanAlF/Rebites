























CREATE TABLE IF NOT EXISTS public.site_visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_key text NOT NULL UNIQUE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  visit_count integer NOT NULL DEFAULT 1 CHECK (visit_count > 0)
);

CREATE TABLE IF NOT EXISTS public.site_visitor_days (
  visitor_id uuid NOT NULL REFERENCES public.site_visitors(id) ON DELETE CASCADE,
  day date NOT NULL,
  visits integer NOT NULL DEFAULT 1 CHECK (visits > 0),
  PRIMARY KEY (visitor_id, day)
);

CREATE INDEX IF NOT EXISTS idx_site_visitor_days_day
  ON public.site_visitor_days(day);

ALTER TABLE public.site_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_visitor_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_visitors_select_admin" ON public.site_visitors;
CREATE POLICY "site_visitors_select_admin"
ON public.site_visitors FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "site_visitor_days_select_admin" ON public.site_visitor_days;
CREATE POLICY "site_visitor_days_select_admin"
ON public.site_visitor_days FOR SELECT
TO authenticated
USING (public.is_admin());

GRANT SELECT ON public.site_visitors TO authenticated;
GRANT SELECT ON public.site_visitor_days TO authenticated;



CREATE OR REPLACE FUNCTION public.record_site_visit(p_key text, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_day date;
BEGIN
  IF p_key IS NULL OR btrim(p_key) = '' THEN
    RAISE EXCEPTION 'visitor key wajib diisi';
  END IF;

  v_day := ((now() + interval '7 hours') AT TIME ZONE 'UTC')::date;

  INSERT INTO public.site_visitors AS sv
    (visitor_key, user_id, first_seen_at, last_seen_at, visit_count)
  VALUES (btrim(p_key), p_user_id, now(), now(), 1)
  ON CONFLICT (visitor_key) DO UPDATE
    SET last_seen_at = now(),
        visit_count = sv.visit_count + 1,
        user_id = COALESCE(sv.user_id, EXCLUDED.user_id)
  RETURNING id INTO v_id;

  INSERT INTO public.site_visitor_days AS svd (visitor_id, day, visits)
  VALUES (v_id, v_day, 1)
  ON CONFLICT (visitor_id, day) DO UPDATE
    SET visits = svd.visits + 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_site_visit(text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_site_visit(text, uuid) TO service_role;

COMMENT ON FUNCTION public.record_site_visit(text, uuid) IS
  'Mencatat satu kunjungan: dedup per visitor_key (UNIQUE) plus rekap harian WIB. Hanya service_role yang boleh memanggil.';



CREATE OR REPLACE FUNCTION public.get_visitor_stats(p_days integer DEFAULT 14)
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
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak. Hanya admin.' USING ERRCODE = '42501';
  END IF;

  v_days := GREATEST(1, LEAST(COALESCE(p_days, 14), 90));
  v_today := ((now() + interval '7 hours') AT TIME ZONE 'UTC')::date;
  v_from := v_today - (v_days - 1);

  SELECT jsonb_build_object(
    'total_visitors', (SELECT count(*) FROM public.site_visitors),
    'total_visits', (SELECT COALESCE(sum(visit_count), 0) FROM public.site_visitors),
    'anonymous_visitors', (SELECT count(*) FROM public.site_visitors WHERE user_id IS NULL),
    'registered_visitors', (SELECT count(*) FROM public.site_visitors WHERE user_id IS NOT NULL),
    'today', (SELECT count(*) FROM public.site_visitor_days WHERE day = v_today),
    'yesterday', (SELECT count(*) FROM public.site_visitor_days WHERE day = v_today - 1),
    'range_days', v_days,
    'range_visitors', (
      SELECT count(*) FROM public.site_visitor_days
      WHERE day >= v_from AND day <= v_today
    ),
    'daily', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('day', d.day, 'visitors', d.visitors, 'visits', d.visits)
        ORDER BY d.day
      )
      FROM (
        SELECT day, count(*) AS visitors, sum(visits) AS visits
        FROM public.site_visitor_days
        WHERE day >= v_from AND day <= v_today
        GROUP BY day
      ) d
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_visitor_stats(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_visitor_stats(integer) TO authenticated;

COMMENT ON FUNCTION public.get_visitor_stats(integer) IS
  'Rekap pengunjung unik untuk dashboard admin. Menolak pemanggil non-admin (42501); hanya authenticated yang boleh mencoba memanggil.';
