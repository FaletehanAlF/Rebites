-- ============================================================================
-- P1-A.1: Perbaiki guard_coin_transactions_no_client_write untuk DELETE
--
-- Temuan verifikasi P1-A.1 (TEST 1 cleanup): fungsi guard selalu
-- RETURN NEW. Pada trigger BEFORE DELETE, NEW bernilai NULL sehingga
-- RETURN NEW = RETURN NULL = operasi DELETE DIBATALKAN diam-diam, bahkan
-- untuk service_role. Dampak nyata:
--   1. DELETE maintenance/cleanup pada coin_transactions tidak pernah
--      berhasil (terbukti: tx_left = 2 setelah DELETE via service_role).
--   2. Clawback reward di refund_order_coins_on_terminal
--      (DELETE ... WHERE type = 'earned') tidak pernah menghapus baris
--      (no-op diam-diam) -> reward order gagal tetap dipertahankan.
-- INSERT/UPDATE tidak terdampak (RETURN NEW benar untuk keduanya).
--
-- Perbaikan: jalur izin mengembalikan OLD untuk DELETE, NEW untuk
-- INSERT/UPDATE. Tidak mengubah kebijakan akses, RLS, atau fungsi lain.
-- Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guard_coin_transactions_no_client_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  IF session_user IN ('postgres', 'supabase_admin') THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  IF COALESCE(public.is_admin(), false) THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  -- Trigger dipakai untuk DELETE: NEW bernilai NULL, pakai OLD untuk pesan.
  RAISE EXCEPTION 'coin_transactions hanya dapat ditulis oleh sistem (user %, order %)',
    COALESCE((CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END).user_id::text, '?'),
    COALESCE((CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END).order_code, '?')
    USING ERRCODE = '42501';
END;
$$;
