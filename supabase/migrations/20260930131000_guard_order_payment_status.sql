-- Guard payment_status orders: hanya server (service_role) dan admin yang
-- boleh mengubahnya. Buyer/seller tetap bisa update kolom operasional
-- (order_status, lifecycle, dsb.) via RLS participants, tetapi tidak bisa
-- memalsukan payment_status='paid' langsung dari client.
--
-- Alasan: policy orders_update_participants mengizinkan buyer/seller
-- meng-UPDATE baris order miliknya tanpa batasan kolom. Tanpa guard ini,
-- buyer bisa menandai ordernya sendiri lunas tanpa membayar (deposit UI
-- seller ikut tertipu). Settlement sah berjalan via service_role
-- (webhook/verify) dan admin via is_admin(), keduanya dikecualikan.
-- INSERT tidak dibatasi (free-order coin dibuat server via service_role).

CREATE OR REPLACE FUNCTION public.guard_order_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.payment_status IS NOT DISTINCT FROM NEW.payment_status THEN
    RETURN NEW;
  END IF;

  -- service_role (webhook Xendit, verify, settlement) selalu boleh.
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- admin boleh (koreksi/refund via API admin yang memakai JWT admin).
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'payment_status hanya boleh diubah server/admin (order %)', OLD.order_code
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_order_payment_status ON public.orders;
CREATE TRIGGER trg_guard_order_payment_status
  BEFORE UPDATE OF payment_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_payment_status();
