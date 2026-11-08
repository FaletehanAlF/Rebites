















ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS severity text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = 'reports_severity_check'
      AND n.nspname = 'public' AND t.relname = 'reports'
  ) THEN
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_severity_check
      CHECK (severity IS NULL OR severity IN ('low', 'medium', 'high', 'critical'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_reports_severity ON public.reports(severity);

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_assigned_to ON public.reports(assigned_to);

CREATE TABLE IF NOT EXISTS public.report_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note text NOT NULL CHECK (length(btrim(note)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_notes_report_id
  ON public.report_notes(report_id);
CREATE INDEX IF NOT EXISTS idx_report_notes_created_at
  ON public.report_notes(created_at DESC);

ALTER TABLE public.report_notes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.report_notes TO authenticated, service_role;

DROP POLICY IF EXISTS "report_notes_select_admin" ON public.report_notes;
CREATE POLICY "report_notes_select_admin"
ON public.report_notes FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "report_notes_insert_admin" ON public.report_notes;
CREATE POLICY "report_notes_insert_admin"
ON public.report_notes FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() AND admin_id = auth.uid());





CREATE OR REPLACE VIEW public.warning_user_summary
WITH (security_invoker = true) AS
SELECT
  w.user_id,
  COUNT(*)::int AS warning_count,
  MAX(w.warning_level)::int AS max_level,
  MAX(w.created_at) AS last_warning_at
FROM public.warnings w
WHERE w.user_id IS NOT NULL
GROUP BY w.user_id;

GRANT SELECT ON public.warning_user_summary TO authenticated, service_role;
