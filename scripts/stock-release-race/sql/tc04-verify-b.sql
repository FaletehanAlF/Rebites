-- ============================================================================
-- TC-04 W4 (harness) — Sesi B: statement terminal VERIFY asli.
--
-- Statement disalin dari app/api/checkout/xendit/verify/route.ts:143-148
-- (blok EXPIRED/FAILED/VOIDED; TANPA kolom xendit_invoice_id):
--   UPDATE orders SET payment_status='failed', order_status='cancelled',
--          invoice_state='failed'
--    WHERE order_code=<code> AND payment_status='unpaid'
--   RETURNING order_code
-- RETURNING diganti count(*) lewat CTE (efek trigger identik).
--
-- Ekspektasi (gate G1): B memblokir pada XID transaksi A → setelah A commit,
-- requalifikasi WHERE payment_status='unpaid' gagal → 0 baris. Pemenang harus
-- tepat satu (tidak boleh dua-duanya 1 atau dua-duanya 0), Δstok tepat +q
-- satu kali, marker terisi.
--
-- Status: BELUM DIJALANKAN. Pengaman sama dengan tc03-b.sql.
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
\echo b_iso=:iso

WITH upd AS (
  UPDATE public.orders
     SET payment_status = 'failed',
         order_status = 'cancelled',
         invoice_state = 'failed'
   WHERE order_code = :'order_code'
     AND payment_status = 'unpaid'
  RETURNING order_code
)
SELECT count(*)::text AS rc FROM upd \gset
\echo b_rowcount=:rc

COMMIT;

\echo b_committed=t
