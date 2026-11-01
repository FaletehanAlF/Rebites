-- ============================================================================
-- TC-03 (harness) — Sesi A: melepas stok lewat wrapper + memegang sinyal.
--
-- Alur (verbatim terhadap spesifikasi gate G0/G1 final):
--   1. BEGIN; pin READ COMMITTED (di bawah REPEATABLE READ, panggilan kedua
--      akan gagal serialisasi 40001 — wajib READ COMMITTED).
--   2. Panggil public.release_order_stock(:order_code) → tangkap nilai balik.
--   3. SETELAH panggilan: advisory XACT lock (778001, 1) = sinyal "wrapper A
--      selesai" (dipegang sampai COMMIT; menandai transaksi A masih hidup).
--   4. Blokir di pg_advisory_xact_lock(778001, 7) = menunggu "izin commit"
--      dari permit-holder sampai harness melepasnya.
--   5. COMMIT.
--
-- Status: BELUM DIJALANKAN.
--
-- Pengaman:
--   - DITOLAK bila dijalankan langsung dengan psql: blok guard di bawah
--     mensyaratkan GUC `rebitess.race.harness = on` (dipasang harness via
--     PGOPTIONS). Host nonlokal & fixture divalidasi di harness.
--   - Sesi ini TIDAK menghapus/mengubah baris lain di luar order fixture
--     (wrapper hanya menargetkan :order_code).
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

SELECT public.release_order_stock(:'order_code') AS released \gset
\echo a_released=:released

SELECT pg_advisory_xact_lock(778001, 1) AS sig \gset
\echo a_signal1=granted

SELECT pg_advisory_xact_lock(778001, 7) AS permit \gset
\echo a_permit=acquired

COMMIT;

\echo a_committed=t
