-- ============================================================================
-- TC-03 (harness) — Sesi B: pemanggil kedua wrapper (berlomba dengan A).
--
-- Alur:
--   1. BEGIN; pin READ COMMITTED (wajib; di bawah REPEATABLE READ panggilan
--      kedua error serialisasi 40001 — bukan skenario produksi PostgREST).
--   2. Panggil public.release_order_stock(:order_code) — diprediksi MEMBLOKIR
--      pada XID transaksi A (gate G1), lalu setelah A commit:
--      requalifikasi snapshot → 0 baris → wrapper mengembalikan false.
--   3. COMMIT.
--
-- Catatan epistemik (L1): nilai `false` dari B BUKAN sinyal independen —
-- wrapper mengembalikan false baik karena kalah balapan maupun karena order
-- memang belum/tidak layak rilis. Bukti utama tetap Δstok (L3) + marker (L2)
-- + katalog gate.
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
\echo b_iso=:iso

SELECT public.release_order_stock(:'order_code') AS released \gset
\echo b_released=:released

COMMIT;

\echo b_committed=t
