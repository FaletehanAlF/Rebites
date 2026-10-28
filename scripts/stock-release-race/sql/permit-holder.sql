-- ============================================================================
-- TC-03 (harness) — Sesi "izin commit" / permit holder.
--
-- Peran dalam protokol gate (revisi):
--   - Memegang advisory SESSION lock (778001, 7) = "izin commit". Sesi A
--     memblokir di pg_advisory_xact_lock(778001, 7) setelah sinyal selesai
--     (778001, 1), sehingga A tidak dapat commit sampai harness melepas izin.
--   - Harness melepas izin dengan pg_terminate_backend() pada sesi ini
--     (lock sesi otomatis lepas saat backend berhenti), ATAU otomatis jika
--     pg_sleep(1800) habis (jaring pengaman bila harness mati).
--
-- Status: BELUM DIJALANKAN.
--
-- Pengaman:
--   - DITOLAK bila dijalankan langsung dengan psql: blok guard di bawah
--     mensyaratkan GUC `rebitess.race.harness = on` yang HANYA dipasang
--     harness run-race.mjs via PGOPTIONS.
--   - Penolakan koneksi nonlokal + validasi fixture + cleanup berada di
--     harness (sisi klien), bukan di file ini.
-- ============================================================================

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

-- Jaring pengaman: bila harness tidak sempat terminate, lepas otomatis.
SELECT pg_sleep(1800);

\echo permit_holder_done=t
