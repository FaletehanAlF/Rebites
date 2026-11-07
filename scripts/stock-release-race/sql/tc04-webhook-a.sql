






















\set ON_ERROR_STOP on

DO $guard$
BEGIN
  IF current_setting('rebitess.race.harness', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'DITOLAK: skrip sesi race hanya boleh dijalankan oleh harness scripts/stock-release-race/run-race.mjs (GUC rebitess.race.harness tidak aktif).';
  END IF;
END $guard$;

SET lock_timeout = 0;
SET statement_timeout = '600s';

BEGIN;

SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

SELECT replace(current_setting('transaction_isolation'), ' ', '_') AS iso \gset
\echo a_iso=:iso

WITH upd AS (
  UPDATE public.orders
     SET payment_status = 'failed',
         order_status = 'cancelled',
         invoice_state = 'failed',
         xendit_invoice_id = :'invoice_id'
   WHERE order_code = :'order_code'
     AND payment_status = 'unpaid'
  RETURNING order_code
)
SELECT count(*)::text AS rc FROM upd \gset
\echo a_rowcount=:rc

SELECT pg_advisory_xact_lock(778001, 1) AS sig \gset
\echo a_signal1=granted

SELECT pg_advisory_xact_lock(778001, 7) AS permit \gset
\echo a_permit=acquired

COMMIT;

\echo a_committed=t
