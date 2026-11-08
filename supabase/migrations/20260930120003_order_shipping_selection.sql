



















ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS courier_code text,
  ADD COLUMN IF NOT EXISTS courier_service_code text,
  ADD COLUMN IF NOT EXISTS courier_service_name text,
  ADD COLUMN IF NOT EXISTS shipping_rate integer;

COMMENT ON COLUMN public.orders.courier_code IS '7C-1: kode courier Biteship pilihan (mis. jne). NULL bila belum memilih/pickup/legacy.';
COMMENT ON COLUMN public.orders.courier_service_code IS '7C-1: kode service courier pilihan (mis. reg). NULL bila belum memilih/pickup/legacy.';
COMMENT ON COLUMN public.orders.courier_service_name IS '7C-1: nama service courier pilihan. NULL bila belum memilih/pickup/legacy.';
COMMENT ON COLUMN public.orders.shipping_rate IS '7C-1: ongkir pilihan (IDR, dari rate Biteship, re-validasi server). NULL bila belum memilih/pickup/legacy.';









