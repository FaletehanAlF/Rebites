-- ============================================================================
-- P0-A.1: Tutup celah PUBLIC EXECUTE pada reserve_stock / release_stock
--
-- CREATE FUNCTION memberikan EXECUTE kepada PUBLIC secara default.
-- Revoke sebelumnya hanya dari anon/authenticated, tidak dari PUBLIC,
-- sehingga anon/authenticated masih bisa mengeksekusi via privilege PUBLIC.
-- Setelah migration ini hanya role yang membutuhkan (service_role, pola
-- checkout server) yang tetap memiliki EXECUTE eksplisit.
--
-- Tidak mengubah function body/parameter, RLS, atau kode aplikasi.
-- Idempotent.
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.reserve_stock(text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_stock(text, integer) FROM PUBLIC;
