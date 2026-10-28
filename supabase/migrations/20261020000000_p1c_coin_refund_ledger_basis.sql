-- ============================================================================
-- P1-C: BASIS REFUND COIN PADA LEDGER + STATUS UTANG DEBIT DURATION
--
-- Temuan (audit R2, read-only):
--   1. Trigger refund_order_coins_on_terminal mengembalikan Coin sebesar
--      NEW.coin_used — yaitu SNAPSHOT niat/keinginan, bukan fakta debit.
--      Bila ledger tidak punya baris 'spent' (mis. order lama sebelum
--      reservasi P1-A, atau debit yang gagal), trigger tetap menulis
--      'refund' tanpa debit pengimbang => saldo (derived SUM
--      (earned+refund)-spent) NAIK => Coin dicetak tanpa dibayar.
--   2. settleOrderPaid menandai order 'paid' (uang Xendit sudah diterima)
--      lalu mencoba mendebit Coin. Bila debit gagal, kode hanya menulis
--      console.error: tidak ada pencatatan durable yang dapat dikueri dan
--      tidak ada mekanisme pengulangan => utang hilang dari pandangan.
--   3. order.coin_used adalah bagian dari aritmetika order
--      (total = total_before_coin - coin_used) DAN bukti diskon yang
--      belum pernah dibayar. Mengnolkan/mengubahnya untuk menghilangkan
--      risiko mint akan MEMBOYHKAN utang dan merusak snapshot finansial.
--      Karena itu: TIDAK ADA perubahan pada orders.coin_used di migrasi ini.
--
-- Desain (paling-minimal, tanpa worker/cron/rekonsiliasi otomatis):
--   A. refund_order_coins_on_terminal memakai LEDGER sebagai sumber nominal:
--      refund hanya dibuat bila ada baris 'spent' untuk (buyer_id,
--      order_code) yang sama, dan nominalnya sebesar debit 'spent' itu.
--      Tidak ada 'spent' => TIDAK ada baris 'refund' (tidak ada mint).
--   B. Trigger memakai advisory lock per user DENGAN EKSPRESI YANG SAMA
--      dengan spend_order_coins/refund_order_coins, dan memeriksa keberadaan
--      'refund' DI BAWAH lock tersebut. Refund berulang / berbarengan
--      dengan terminalisasi menghasilkan paling banyak SATU baris 'refund'
--      dengan nominal deterministik (= debit aktual).
--   C. spend_order_coins menolak debit BARU untuk order yang sudah terminal.
--      Ini WAJIB PAIRING dengan (A): tanpa (C), pembatalan bisa selesai
--      lebih dulu (trigger berjalan tanpa 'spent' => tanpa refund) lalu
--      debit tetap commit sesudahnya => kebocoran debit untuk order void.
--      (C) menutup race itu dengan row lock order yang diambil SEBELUM
--      advisory lock (lihat analisis urutan lock di bawah).
--   D. orders.coin_debit_status / coin_debit_reason / coin_debit_updated_at
--      sebagai pencatatan utang yang durable + dapat dikueri. Nilai:
--        NULL           -> tidak ada utang tercatat
--        'pending'      -> debit tidak dapat dipastikan (gangguan/ambig);
--                          retryable, TIDAK boleh disimpulkan "tidak terjadi"
--        'insufficient' -> saldo tidak cukup saat itu (bukan gangguan
--                          infrastruktur); butuh top-up / keputusan bisnis
--      Alasan: 'rpc_error' | 'insufficient_balance'.
--      CATATAN: 'false' dari spend_order_coins TIDAK lagi berarti hanya
--      "saldo kurang" — dengan (C) false juga berarti "order terminal" atau
--      "order tidak ada". Pemanggil WAJIB memverifikasi ledger + status
--      order sebelum menyimpulkan "insufficient" (lihat order-settlement.ts).
--   E. Kolom baru dipaksa NULL untuk insert non-privileged oleh trigger
--      BEFORE INSERT TERPISAH (guard_orders_insert_coin_debit_defaults /
--      trg_orders_guard_insert_coin_debit). Fungsi guard lama
--      guard_orders_insert_client_defaults() TIDAK didefinisikan ulang di
--      sini: definisi terakhir (P1-A) tetap berlaku, termasuk
--      NEW.estimated_completion_at := NULL. (Defense-in-depth; policy INSERT
--      sudah dicabut di P1-A.) Kolom baru TIDAK masuk whitelist P0-B
--      (v_allowed_cols) => update non-privileged yang mengubahnya otomatis
--      ditolak guard P0-B (server-only by construction).
--
-- Analisis urutan lock (dasar keselamatan (C) dan (B)):
--   L1 = row lock pada public.orders untuk order tsb
--   L2 = advisory xact lock per user: hashtext('rebites-coin:'||user::text)
--   L3 = row lock pada public.coin_transactions
--   INVARIAN: tidak ada jalur yang mengambil L2 lalu L1.
--     - trigger refund_order_coins_on_terminal : L1 (implisit dari UPDATE
--       orders) -> L2 -> L3
--     - spend_order_coins (versi ini)            : L1 -> L2 -> L3
--     - refund_order_coins (tidak diubah)       : L2 -> L3 (tidak pernah L1)
--   => tidak ada siklus lock => deadlock-free.-row lock order (L1) memakai
--   FOR NO KEY UPDATE: berkonflik dengan row lock yang diambil UPDATE
--   (FOR NO KEY UPDATE / FOR UPDATE) sehingga terminalisasi dan debit
--   saling menunggu, TETAPI tidak saling memegang lock yang berlawanan.
--
-- Data existing: TIDAK ADA perubahan data. Tidak ada backfill status
-- utang; order historis tanpa 'spent' tetap terdeteksi lewat signature
-- ledger (orders.coin_used > 0 tanpa baris 'spent'), bukan lewat kolom
-- baru. JANGAN mengubah orders.coin_used.
--
-- Idempotent: aman dijalankan berulang (CREATE OR REPLACE + ADD COLUMN IF
-- NOT EXISTS + CHECK lewat pg_constraint).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. W2: status utang debit Coin (durable, dapat dikueri)
-- ---------------------------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coin_debit_status text,
  ADD COLUMN IF NOT EXISTS coin_debit_reason text,
  ADD COLUMN IF NOT EXISTS coin_debit_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.orders'::regclass
       AND conname = 'orders_coin_debit_status_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_coin_debit_status_check
      CHECK (coin_debit_status IS NULL OR coin_debit_status IN ('pending', 'insufficient'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.orders'::regclass
       AND conname = 'orders_coin_debit_reason_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_coin_debit_reason_check
      CHECK (coin_debit_reason IS NULL OR coin_debit_reason IN ('rpc_error', 'insufficient_balance'));
  END IF;
END $$;

COMMENT ON COLUMN public.orders.coin_debit_status IS
  'P1-C: utang debit Coin yang tercatat. NULL = tidak ada utang; pending = debit tidak dapat dipastikan (retryable); insufficient = saldo tidak cukup saat itu (butuh top-up/keputusan bisnis). orders.coin_used TIDAK diubah oleh status ini.';
COMMENT ON COLUMN public.orders.coin_debit_reason IS
  'P1-C: alasan utang debit Coin: rpc_error (gangguan/ambig) atau insufficient_balance (saldo kurang).';
COMMENT ON COLUMN public.orders.coin_debit_updated_at IS
  'P1-C: waktu pencatatan/perbaruan terakhir utang debit Coin.';

-- ---------------------------------------------------------------------------
-- 2. W1: refund_order_coins_on_terminal berbasis ledger (bukan snapshot)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refund_order_coins_on_terminal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_bad boolean;
  v_is_bad boolean;
  v_spent integer;
BEGIN
  IF NEW.order_code IS NULL OR NEW.buyer_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_was_bad := (OLD.order_status IN ('cancelled', 'failed', 'refunded')
                OR OLD.payment_status IN ('failed', 'refunded'));
  v_is_bad := (NEW.order_status IN ('cancelled', 'failed', 'refunded')
               OR NEW.payment_status IN ('failed', 'refunded'));

  -- Hanya saat BERPINDAH ke buruk (idempoten terhadap update berulang /
  -- bersamaan pada order yang sudah batal; baris terkunci per transaksi).
  IF NOT v_is_bad OR v_was_bad THEN
    RETURN NEW;
  END IF;

  -- Serialisasi dengan spend_order_coins / refund_order_coins: advisory lock
  -- per user dengan EKSPRESI YANG SAMA (hashtext('rebites-coin:'||uuid)).
  -- Urutan lock: row lock orders (implisit dari UPDATE) -> advisory coin.
  -- Tidak ada jalur yang mengambil advisory lalu row lock orders =>
  -- deadlock-free.
  PERFORM pg_advisory_xact_lock(hashtext('rebites-coin:' || NEW.buyer_id::text));

  -- P1-C: nominal refund diambil dari debit 'spent' yang BENAR-BENAR
  -- tercatat di ledger. NEW.coin_used SENGAJA TIDAK dipakai: itu snapshot
  -- niat, bukan fakta debit. Tidak ada 'spent' => tidak ada yang dikembalikan
  -- (tidak boleh membuat Coin dari nol).
  SELECT amount INTO v_spent
    FROM public.coin_transactions
   WHERE user_id = NEW.buyer_id
     AND order_code = NEW.order_code
     AND type = 'spent';

  IF v_spent IS NOT NULL AND v_spent > 0 THEN
    -- Sudah ada refund? Dicek DI BAWAH lock yang sama dengan RPC
    -- refund_order_coins => refund berulang / berbarengan dengan
    -- terminalisasi menghasilkan paling banyak SATU baris 'refund'.
    -- Unique index coin_tx_once_per_order_type tetap dipertahankan sebagai
    -- pertahanan tambahan.
    PERFORM 1 FROM public.coin_transactions
     WHERE user_id = NEW.buyer_id
       AND order_code = NEW.order_code
       AND type = 'refund';
    IF NOT FOUND THEN
      INSERT INTO public.coin_transactions(user_id, order_code, type, amount, description)
      VALUES (NEW.buyer_id, NEW.order_code, 'refund', v_spent,
              'Pengembalian koin ' || NEW.order_code)
        ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- Reward pembelian yang dibatalkan/digagalkan tidak berhak dipertahankan.
  -- (Sudah berlaku tanpa syarat coin_used: block "IF NEW.coin_used <= 0"
  -- versi lama hanya dokumentasi dan tidak pernah mengubah alur ini.)
  DELETE FROM public.coin_transactions
   WHERE user_id = NEW.buyer_id
     AND order_code = NEW.order_code
     AND type = 'earned';

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refund_order_coins_on_terminal() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. W4: spend_order_coins menolak debit baru untuk order terminal
--
-- lock order: L1 (row lock orders) -> L2 (advisory user) -> L3 (ledger).
-- Pemeriksaan status dilakukan DI BAWAH row lock, sehingga tidak ada
-- race: bila terminalisasi selesai lebih dulu, pemeriksaan ini membaca
-- status terminal yang sudah ter-commit dan menolak debit.
-- Idempotensi debit yang sudah ada (baris 'spent' => true) DIJAGA dan
-- diperiksa lebih dulu, sehingga tidak berubah bagi transaksi spent valid.
--
-- S-1 (audit 2.3A): pemilik order WAJIB cocok dengan p_user_id. Tanpa
-- pemeriksaan ini service_role (atau bug pemanggil) dapat mendebit Coin
-- user A untuk order milik user B. Pemeriksaan memakai buyer_id dari baris
-- yang SUDAH terkunci L1, sehingga identitasnya tidak bisa berubah di
-- tengah transaksi.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.spend_order_coins(p_user_id uuid, p_order_code text, p_amount integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_earned bigint := 0;
  v_spent bigint := 0;
  v_order_found boolean := false;
  v_order_payment_status text;
  v_order_status text;
  v_order_buyer_id uuid;
  v_order_is_terminal boolean;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;
  IF p_order_code IS NULL OR btrim(p_order_code) = '' THEN
    RETURN false;
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN false;
  END IF;

  -- L1: kunci baris order (FOR NO KEY UPDATE) agar pemeriksaan status
  -- berikut tidak bisa basi terhadap pembatalan yang sedang berjalan.
  -- Diambil SEBELUM advisory lock => urutan lock identik dengan trigger
  -- refund_order_coins_on_terminal (L1 -> L2) => deadlock-free.
  SELECT o.payment_status, o.order_status, o.buyer_id
    INTO v_order_payment_status, v_order_status, v_order_buyer_id
    FROM public.orders o
   WHERE o.order_code = p_order_code
     FOR NO KEY UPDATE;
  v_order_found := FOUND;

  -- S-1: hanya PEMILIK order yang boleh didebit. Ditempatkan SEBELUM
  -- advisory lock dan SEBELUM pemeriksaan 'spent' agar:
  --   - pemanggil idempoten yang VALID (p_user_id = buyer_id) tetap melewati
  --     jalur yang sama seperti sebelumnya (baris 'spent' tetap => true);
  --   - tidak ada debit BARU yang pernah dieksekusi untuk order milik user
  --     lain, dan tidak ada advisory lock yang diambil untuk caller palsu.
  -- buyer_id NULL = identitas pemilik tidak tersedia -> tolak (fail closed):
  -- kepemilikan tidak dapat dibuktikan, jadi debit tidak boleh dijalankan.
  IF v_order_found AND (v_order_buyer_id IS NULL OR v_order_buyer_id <> p_user_id) THEN
    RETURN false;
  END IF;

  -- Serialisasi semua pemotongan koin user ini dalam satu transaksi.
  -- Request bersamaan menunggu lock; yang kalah melihat saldo terbaru.
  PERFORM pg_advisory_xact_lock(hashtext('rebites-coin:' || p_user_id::text));

  -- Idempoten: hold order ini sudah tercatat.
  PERFORM 1 FROM public.coin_transactions
   WHERE user_id = p_user_id AND order_code = p_order_code AND type = 'spent';
  IF FOUND THEN
    RETURN true;
  END IF;

  -- P1-C: debit BARU hanya untuk order yang ada dan belum terminal.
  -- 'Terminal' memakai predikat yang SAMA dengan v_is_bad pada trigger
  -- refund_order_coins_on_terminal (order_status cancelled/failed/refunded
  -- ATAU payment_status failed/refunded) supaya kedua jalur sepakat.
  IF NOT v_order_found THEN
    RETURN false;
  END IF;
  v_order_is_terminal := (v_order_status IN ('cancelled', 'failed', 'refunded')
                          OR v_order_payment_status IN ('failed', 'refunded'));
  IF v_order_is_terminal THEN
    RETURN false;
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN type IN ('earned', 'refund') THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN type = 'spent' THEN amount ELSE 0 END), 0)
    INTO v_earned, v_spent
    FROM public.coin_transactions
   WHERE user_id = p_user_id;

  IF (v_earned - v_spent) < p_amount THEN
    RETURN false;
  END IF;

  BEGIN
    INSERT INTO public.coin_transactions(user_id, order_code, type, amount, description)
    VALUES (p_user_id, p_order_code, 'spent', p_amount, 'Potongan pesanan');
  EXCEPTION WHEN unique_violation THEN
    -- Balapan insert untuk order yang sama: anggap sudah tercatat.
    RETURN true;
  END;
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.spend_order_coins(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_order_coins(uuid, text, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. W3/K-1: guard insert order untuk kolom utang Coin.
--
-- K-1 (audit 2.3A): versi sebelumnya MENYALIN ULANG
-- guard_orders_insert_client_defaults() di migrasi ini, dan salinannya
-- kehilangan `NEW.estimated_completion_at := NULL;` yang sudah ada sejak
-- P0-B/P1-A — regresi senyap pada proteksi lama.
--
-- Perbaikan: fungsi lama TIDAK didefinisikan ulang (definisi terakhir P1-A
-- tetap berlaku apa adanya, termasuk estimated_completion_at), dan kolom
-- baru dilindungi trigger BEFORE INSERT TERPISAH di bawah.
--
-- Kompatibilitas trigger: PostgreSQL menjalankan trigger BEFORE ... FOR EACH
-- ROW sesuai urutan NAMA. Trigger lama `trg_orders_guard_insert` (P0-A) dan
-- trigger baru `trg_orders_guard_insert_coin_debit` sama-sama BEFORE INSERT
-- FOR EACH ROW pada public.orders; nama baru mengurut SETELAH nama lama,
-- sehingga ia berjalan terakhir. Keduanya menyentuh kolom yang SALING LEPAS
-- (lama: finansial/stok/shipment; baru: coin_debit_*), jadi urutan tidak
-- mengubah hasil, dan bila kelak guard lama menyentuh kolom ini, NULL dari
-- trigger baru tetap menang.
--
-- Mekanisme privilege SAMA dengan guard lama: klaim JWT role='service_role'
-- dan public.is_admin() dikecualikan; selain itu ketiga kolom dipaksa NULL.
-- (Nilai kolom ini hanya boleh berasal dari server yang benar-benar gagal
-- mendebit. orders.coin_used TIDAK disentuh.)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_orders_insert_coin_debit_defaults()
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
    NEW.coin_debit_status := NULL;
    NEW.coin_debit_reason := NULL;
    NEW.coin_debit_updated_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_guard_insert_coin_debit ON public.orders;
CREATE TRIGGER trg_orders_guard_insert_coin_debit
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_orders_insert_coin_debit_defaults();

-- Catatan: ACL fungsi trigger TIDAK diubah di migrasi ini (CREATE OR
-- REPLACE mempertahankan ACL yang ada; definisi P1-A tidak pernah mencabut
-- EXECUTE untuk fungsi guard insert, dan fungsi trigger tidak dapat dipanggil
-- langsung sebagai fungsi biasa).
