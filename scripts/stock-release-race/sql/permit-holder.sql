




















\set ON_ERROR_STOP on

DO $guard$
BEGIN
  IF current_setting('rebitess.race.harness', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'DITOLAK: skrip sesi race hanya boleh dijalankan oleh harness scripts/stock-release-race/run-race.mjs (GUC rebitess.race.harness tidak aktif).';
  END IF;
END $guard$;

SET lock_timeout = 0;
SET statement_timeout = 0;

\echo session=permit

SELECT pg_advisory_lock(778001, 7) AS permit \gset
\echo permit_held=t


SELECT pg_sleep(1800);

\echo permit_holder_done=t
