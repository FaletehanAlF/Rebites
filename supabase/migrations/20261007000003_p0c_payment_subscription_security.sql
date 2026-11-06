-- ============================================================================
-- P0-C: PAYMENT & SUBSCRIPTION SECURITY (DB-LEVEL GUARD)
--
-- Temuan:
--   * Webhook EXPIRED/FAILED/VOIDED untuk subscription tidak memiliki guard
--     state: bisa menjatuhkan subscription 'active' menjadi 'expired'
--     (webhook lama/terlambat/replay). Di-handle di kode webhook (P0-C),
--     trigger ini menjadi pertahanan kedua di database.
--   * Subscription exploration probing: user tidak bisa INSERT/UPDATE karena
--     RLS (P0-A), trigger ini memastikan bahkan caller service_role pun
--     tidak bisa melakukan transisi state ilegal.
--
-- Yang dilakukan migration ini:
--   1. guard_subscriptions_state_update() — BEFORE UPDATE trigger:
--      - NEW.status='expired' hanya sah dari 'pending'
--      - NEW.status='active' hanya sah dari pending/expired/cancelled/trial/active
--      - 'cancelled' terminal: tidak bisa keluar dari cancelled
--      - current_period_end tidak boleh dipersingkat pada subscription active
--   2. Tidak mengubah data existing; hanya menambah trigger.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guard_subscriptions_state_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 'expired' hanya hasil dari invoice pending yang benar-benar expired.
  -- Webhook EXPIRED untuk subscription active/expired/cancelled ditolak.
  IF NEW.status = 'expired' AND OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'Transisi % -> expired tidak diizinkan (order sub %)', OLD.status, OLD.id
      USING ERRCODE = '42501';
  END IF;

  -- 'active' hanya dari state yang boleh diaktifkan.
  IF NEW.status = 'active' AND OLD.status NOT IN ('pending', 'trial', 'expired', 'cancelled', 'active') THEN
    RAISE EXCEPTION 'Transisi % -> active tidak diizinkan', OLD.status
      USING ERRCODE = '42501';
  END IF;

  -- 'cancelled' terminal.
  IF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Subscription yang sudah cancelled tidak dapat diubah'
      USING ERRCODE = '42501';
  END IF;

  -- Periode tidak boleh dipersingkat pada subscription yang sedang aktif.
  IF OLD.status = 'active'
     AND OLD.current_period_end IS NOT NULL
     AND NEW.current_period_end IS NOT NULL
     AND NEW.current_period_end < OLD.current_period_end THEN
    RAISE EXCEPTION 'current_period_end tidak boleh dipersingkat'
      USING ERRCODE = '42501';
  END IF;

  -- 'pending' terminal terhadap re-pending tanpa alasan (kecuali status sama).
  IF NEW.status = 'pending' AND OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'Transisi % -> pending tidak diizinkan', OLD.status
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_subscriptions_state_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_subscriptions_state_guard ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_state_guard
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.guard_subscriptions_state_update();
