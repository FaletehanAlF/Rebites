-- ============================================================================
-- TC-04 W4 (harness) — Sesi A: statement terminal WEBHOOK asli.
--
-- Statement disalin dari app/api/webhooks/xendit/route.ts:164-174 (blok
-- transisi terminal EXPIRED/FAILED/VOIDED):
--   UPDATE orders SET payment_status='failed', order_status='cancelled',
--          invoice_state='failed', xendit_invoice_id=<invoiceId>
--    WHERE order_code=<code> AND payment_status='unpaid'
--   RETURNING order_code
-- Perbedaan yang disengaja (didokumentasikan):
--   - RETURNING diganti count(*) lewat CTE agar rowcount tertangkap presisi
--     (efek trigger/guard identik dengan RETURNING order_code).
--   - Dibungkus BEGIN…COMMIT eksplisit + izin commit (778001, 7) agar
--     transaksi A tetap terbuka setelah UPDATE → B dapat dijadwalkan
--     benar-benar berbarengan (PostgREST aslinya autocommit per statement;
--     yang diuji adalah efek kunci/trigger pada baris yang sama).
--
-- Alur: BEGIN; pin READ COMMITTED; UPDATE (rowcount) → sinyal (778001,1)
--       → tunggu izin (778001,7); COMMIT.
--
-- Status: BELUM DIJALANKAN. Pengaman sama dengan tc03-a.sql.
-- ============================================================================

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
