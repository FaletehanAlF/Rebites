-- ============================================================================
-- P0-B: STOCK & ORDER STATE SECURITY HARDENING
--
-- Temuan:
--   * release_stock() tidak idempotent: EXPIRED/FAILED duplikat, verify +
--     webhook, atau cancel + webhook dapat mengembalikan stok berkali-kali.
--   * Pembatalan order dari client tidak mengembalikan stok sama sekali.
--   * Guard transisi order_status (0019) dan guard payment_status (0013)
--     memakai current_user di dalam fungsi SECURITY DEFINER; current_user di
--     sana selalu pemilik fungsi (postgres) sehingga guard tidak pernah
--     menolak siapa pun (no-op). Terbukti via probe remote: buyer dapat
--     set order_status completed/paid, mengubah total_price, umkm_id,
--     shipment_status, biteship_waybill_id pada order sendiri.
--
-- Desain:
--   1. orders.stock_reserved_at / stock_released_at = penanda tingkat order.
--      Checkout server menandai stock_reserved_at saat reserve_stock berhasil.
--   2. Satu trigger BEFORE UPDATE (guard_orders_update) yang:
--        a. untuk caller non-privileged (bukan service_role / admin / owner
--           DB): hanya mengizinkan kolom operasional (whitelist) berubah dan
--           memvalidasi transisi order_status / lifecycle_status /
--           progress_status berdasarkan peran (buyer / seller pemilik toko)
--           dan payment_status di database;
--        b. untuk SEMUA caller: bila order masuk keadaan batal/gagal dan
--           stok pernah dikunci tetapi belum pernah dilepas, stok dilepas
--           dan stock_released_at diisi dalam satu transaksi/baris yang sama.
--           Hasil release_stock DIPERIKSA: bila pelepasan gagal (mis. slug
--           produk tidak ditemukan karena di-rename / baris produk hilang),
--           stock_released_at SENGAJA dibiarkan NULL (fail-open + retry):
--           transisi status tetap commit, percobaan rilis berikutnya mencoba
--           lagi, dan release_order_stock() mengembalikan false (jujur).
--      Atomik terhadap request bersamaan: UPDATE mengunci baris order;
--      request kedua menunggu lock, lalu trigger-nya melihat OLD terbaru
--      (stock_released_at sudah terisi bila berhasil) sehingga tidak
--      melepas lagi.
--   3. release_order_stock(order_code): wrapper idempotent (service_role only).
--   4. INSERT guard (P0-A) diperketat: client tidak dapat mengisi kolom stok /
--      shipment / tracking saat insert.
--   5. order_status_history: INSERT hanya untuk peserta order (sebelumnya
--      WITH CHECK (true)).
--
-- Data existing: hanya menambah 2 kolom + backfill penanda (tidak mengubah
-- status/harga/stok/payment order mana pun). Idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Kolom penanda stok
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS stock_reserved_at timestamptz,
  ADD COLUMN IF NOT EXISTS stock_released_at timestamptz;

-- Backfill: order hasil checkout (punya order_code + product_slug) selalu
-- melakukan reserve_stock sebelum insert. Order yang sudah berstatus
-- batal/gagal ditandai "sudah dilepas" agar tidak pernah dilepas ulang.
-- Tidak ada perubahan pada kolom lain; trigger baru belum aktif saat ini.
UPDATE public.orders
   SET stock_reserved_at = created_at
 WHERE stock_reserved_at IS NULL
   AND order_code IS NOT NULL
   AND product_slug IS NOT NULL;

UPDATE public.orders
   SET stock_released_at = created_at
 WHERE stock_released_at IS NULL
   AND stock_reserved_at IS NOT NULL
   AND (order_status IN ('cancelled', 'refunded', 'failed')
        OR payment_status IN ('failed', 'refunded'));

-- ---------------------------------------------------------------------------
-- 2. Guard UPDATE orders + pelepasan stok idempotent
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_orders_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_privileged boolean;
  v_is_buyer boolean := false;
  v_is_seller boolean := false;
  v_old jsonb;
  v_new jsonb;
  v_key text;
  v_allowed_cols constant text[] := ARRAY[
    'order_status', 'lifecycle_status', 'progress_status', 'completed_at',
    'delivery_started_at', 'estimated_arrival_at', 'delivery_distance_km',
    'estimated_delivery_minutes', 'note'
  ];
  v_ok boolean;
  v_old_rank int;
  v_new_rank int;
BEGIN
  v_privileged := COALESCE((auth.jwt() ->> 'role') = 'service_role', false)
                  OR session_user IN ('postgres', 'supabase_admin')
                  OR COALESCE(public.is_admin(), false);

  IF NOT v_privileged THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);

    -- (a) Whitelist kolom: selain kolom operasional, semua kolom order
    -- (harga, pembayaran, kepemilikan, pengiriman, stok, dst.) hanya boleh
    -- diubah server/admin.
    FOR v_key IN
      SELECT n.key FROM jsonb_each(v_new) AS n
       WHERE n.value IS DISTINCT FROM (v_old -> n.key)
    LOOP
      IF NOT (v_key = ANY (v_allowed_cols)) THEN
        RAISE EXCEPTION 'Kolom % pada pesanan hanya dapat diubah oleh sistem (order %)',
          v_key, OLD.order_code
          USING ERRCODE = '42501';
      END IF;
    END LOOP;

    v_is_buyer := auth.uid() IS NOT NULL AND OLD.buyer_id = auth.uid();
    v_is_seller := auth.uid() IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.umkm_profiles u
       WHERE u.id = OLD.umkm_id AND u.user_id = auth.uid()
    );

    IF NOT (v_is_buyer OR v_is_seller) THEN
      RAISE EXCEPTION 'Anda tidak berhak mengubah pesanan ini'
        USING ERRCODE = '42501';
    END IF;

    -- (b) order_status
    IF NEW.order_status IS DISTINCT FROM OLD.order_status THEN
      IF NEW.order_status IN ('paid', 'failed', 'refunded') THEN
        RAISE EXCEPTION 'Status % hanya dapat diatur oleh sistem pembayaran', NEW.order_status
          USING ERRCODE = '42501';
      END IF;
      IF OLD.order_status IN ('completed', 'cancelled', 'refunded', 'failed') THEN
        RAISE EXCEPTION 'Pesanan berstatus % tidak dapat diubah lagi', OLD.order_status
          USING ERRCODE = '42501';
      END IF;
      IF NEW.order_status <> 'cancelled' AND OLD.payment_status IS DISTINCT FROM 'paid' THEN
        RAISE EXCEPTION 'Pesanan belum dibayar, status tidak dapat dilanjutkan'
          USING ERRCODE = '42501';
      END IF;

      v_ok := false;
      IF v_is_seller THEN
        v_ok := (OLD.order_status, NEW.order_status) IN (
          ('pending', 'cancelled'),
          ('paid', 'processing'), ('paid', 'cancelled'),
          ('processing', 'ready_for_pickup'), ('processing', 'out_for_delivery'),
          ('processing', 'cancelled'),
          ('preparing', 'completed'), ('preparing', 'cancelled'), ('preparing', 'ready'),
          ('ready', 'completed'), ('ready', 'cancelled'),
          ('ready_for_pickup', 'completed'), ('out_for_delivery', 'completed')
        );
      END IF;
      IF NOT v_ok AND v_is_buyer THEN
        v_ok := (OLD.order_status, NEW.order_status) IN (
          ('pending', 'cancelled'),
          ('ready', 'completed'),
          ('ready_for_pickup', 'completed'), ('out_for_delivery', 'completed')
        );
      END IF;
      IF NOT v_ok THEN
        RAISE EXCEPTION 'Transisi status pesanan % -> % tidak diizinkan', OLD.order_status, NEW.order_status
          USING ERRCODE = '42501';
      END IF;
    END IF;

    -- (c) lifecycle_status: hanya ongoing -> completed pada order lunas & aktif
    IF NEW.lifecycle_status IS DISTINCT FROM OLD.lifecycle_status THEN
      IF NEW.lifecycle_status IS DISTINCT FROM 'completed'
         OR OLD.lifecycle_status IS NOT DISTINCT FROM 'completed' THEN
        RAISE EXCEPTION 'Perubahan lifecycle_status tidak diizinkan'
          USING ERRCODE = '42501';
      END IF;
      IF OLD.payment_status IS DISTINCT FROM 'paid'
         OR NEW.order_status IN ('pending', 'cancelled', 'failed', 'refunded') THEN
        RAISE EXCEPTION 'Pesanan belum lunas atau sudah dibatalkan, tidak dapat diselesaikan'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    -- (d) progress_status: hanya seller, maju searah, order lunas & aktif
    IF NEW.progress_status IS DISTINCT FROM OLD.progress_status THEN
      IF NOT v_is_seller THEN
        RAISE EXCEPTION 'Hanya penjual yang dapat mengubah progres pesanan'
          USING ERRCODE = '42501';
      END IF;
      IF NEW.progress_status NOT IN ('disiapkan', 'siap-diambil', 'diantar') THEN
        RAISE EXCEPTION 'Nilai progres pesanan tidak valid'
          USING ERRCODE = '42501';
      END IF;
      v_old_rank := CASE WHEN OLD.progress_status IN ('siap-diambil', 'diantar') THEN 1 ELSE 0 END;
      v_new_rank := CASE WHEN NEW.progress_status IN ('siap-diambil', 'diantar') THEN 1 ELSE 0 END;
      IF v_new_rank < v_old_rank THEN
        RAISE EXCEPTION 'Progres pesanan tidak dapat mundur'
          USING ERRCODE = '42501';
      END IF;
      IF OLD.payment_status IS DISTINCT FROM 'paid'
         OR NEW.order_status IN ('pending', 'cancelled', 'failed', 'refunded')
         OR OLD.lifecycle_status IS NOT DISTINCT FROM 'completed' THEN
        RAISE EXCEPTION 'Pesanan belum lunas, sudah dibatalkan, atau sudah selesai'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    -- (e) completed_at hanya bersamaan dengan penyelesaian;
    --     data pengantaran hanya oleh penjual.
    IF NEW.completed_at IS DISTINCT FROM OLD.completed_at
       AND NEW.lifecycle_status IS DISTINCT FROM 'completed' THEN
      RAISE EXCEPTION 'completed_at hanya dapat diisi saat pesanan diselesaikan'
        USING ERRCODE = '42501';
    END IF;
    IF (NEW.delivery_started_at IS DISTINCT FROM OLD.delivery_started_at
        OR NEW.estimated_arrival_at IS DISTINCT FROM OLD.estimated_arrival_at
        OR NEW.delivery_distance_km IS DISTINCT FROM OLD.delivery_distance_km
        OR NEW.estimated_delivery_minutes IS DISTINCT FROM OLD.estimated_delivery_minutes)
       AND NOT v_is_seller THEN
      RAISE EXCEPTION 'Data pengantaran hanya dapat diubah oleh penjual'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Pelepasan stok idempoten berbasis state (berlaku untuk semua caller).
  -- Hasil release_stock TIDAK diabaikan (fail-open + retry):
  --   * sukses -> marker stock_released_at diisi (idempoten: update
  --     berikutnya tidak melepas lagi);
  --   * gagal (paling sering: slug produk tidak ditemukan karena produk
  --     di-rename / baris produk hilang) -> marker SENGAJA dibiarkan NULL
  --     + RAISE WARNING supaya (i) transisi status order tetap commit,
  --     (ii) percobaan rilis berikutnya (update order ini / wrapper
  --     release_order_stock) mencoba lagi -> self-healing bila data produk
  --     pulih, dan (iii) release_order_stock() mengembalikan false (jujur),
  --     bukan sukses palsu.
  --     Konsekuensi: bila produk memang tidak pernah pulih, setiap UPDATE
  --     order ini mencoba melepas lagi (no-op dibatalkan + WARNING). Setara:
  --     pelepasan ganda tetap mustahil karena marker hanya diisi saat sukses.
  IF NEW.stock_reserved_at IS NOT NULL
     AND OLD.stock_released_at IS NULL
     AND NEW.stock_released_at IS NULL
     AND (NEW.order_status IN ('cancelled', 'failed') OR NEW.payment_status = 'failed')
     AND NEW.order_status IS DISTINCT FROM 'completed'
     AND NEW.lifecycle_status IS DISTINCT FROM 'completed'
     AND NEW.quantity > 0 THEN
    IF NEW.product_slug IS NULL THEN
      -- Order tanpa slug produk tidak punya reservasi stok terikat
      -- (reservasi selalu berbasis slug); tidak ada yang dilepas.
      NEW.stock_released_at := now();
    ELSIF public.release_stock(NEW.product_slug, NEW.quantity) THEN
      NEW.stock_released_at := now();
    ELSE
      RAISE WARNING
        'guard_orders_update: pelepasan stok GAGAL untuk order % (produk %); stok tidak dikembalikan dan stock_released_at dibiarkan kosong untuk percobaan ulang',
        OLD.order_code, NEW.product_slug;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_orders_update() FROM PUBLIC, anon, authenticated;

-- Trigger lama berbasis current_user (no-op) digantikan; fungsi lama tidak dihapus.
DROP TRIGGER IF EXISTS orders_guard_order_status ON public.orders;

DROP TRIGGER IF EXISTS trg_orders_guard_update ON public.orders;
CREATE TRIGGER trg_orders_guard_update
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_orders_update();

-- ---------------------------------------------------------------------------
-- 3. release_order_stock: wrapper idempotent untuk server (service_role only)
--    Mengembalikan true hanya bila panggilan ini yang benar-benar melepas stok.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_order_stock(p_order_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released timestamptz;
BEGIN
  IF p_order_code IS NULL OR btrim(p_order_code) = '' THEN
    RETURN false;
  END IF;

  UPDATE public.orders
     SET order_status = order_status
   WHERE order_code = p_order_code
     AND stock_reserved_at IS NOT NULL
     AND stock_released_at IS NULL
  RETURNING stock_released_at INTO v_released;

  RETURN v_released IS NOT NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.release_order_stock(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_order_stock(text) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. INSERT guard (P0-A) diperketat: stok / shipment / tracking / waktu
--    tidak dapat diisi client saat insert.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_orders_insert_client_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_admin() THEN
    NEW.payment_status := 'unpaid';
    NEW.order_status := 'pending';
    NEW.lifecycle_status := 'ongoing';
    NEW.progress_status := 'disiapkan';
    NEW.xendit_invoice_id := NULL;
    NEW.payment_method_id := NULL;
    NEW.discount := 0;
    NEW.promo_code := NULL;
    NEW.coin_used := 0;
    NEW.coin_earned := 0;
    NEW.shipping_rate := NULL;
    NEW.courier_code := NULL;
    NEW.courier_service_code := NULL;
    NEW.courier_service_name := NULL;
    NEW.shipping_snapshot := NULL;
    NEW.estimated_minutes := NULL;
    NEW.estimated_completion_at := NULL;
    NEW.biteship_order_id := NULL;
    NEW.biteship_tracking_id := NULL;
    NEW.biteship_waybill_id := NULL;
    NEW.shipment_status := NULL;
    NEW.shipment_created_at := NULL;
    NEW.shipment_error := NULL;
    NEW.completed_at := NULL;
    NEW.delivery_started_at := NULL;
    NEW.estimated_arrival_at := NULL;
    NEW.stock_reserved_at := NULL;
    NEW.stock_released_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. order_status_history: INSERT hanya peserta order (buyer / seller / admin)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "osh_insert_service" ON public.order_status_history;
DROP POLICY IF EXISTS "osh_insert_participants" ON public.order_status_history;
CREATE POLICY "osh_insert_participants"
ON public.order_status_history FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
     WHERE o.id = order_status_history.order_id
       AND (
         o.buyer_id = auth.uid()
         OR EXISTS (
           SELECT 1 FROM public.umkm_profiles u
            WHERE u.id = o.umkm_id AND u.user_id = auth.uid()
         )
       )
  )
  OR public.is_admin()
);
