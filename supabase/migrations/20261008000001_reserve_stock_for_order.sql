-- ============================================================================
-- Tahap 2D-J: reservasi stok atomik terikat order (Desain B dari audit 2D-I)
--
-- Masalah: reserve_stock(p_slug, p_quantity) mengurangi stok products TANPA
-- ikatan ke order, lalu route menulis stock_reserved_at dalam round-trip
-- terpisah. Crash di antaranya = stok terpotong tetapi marker NULL, sehingga
-- trigger rilis (P0-B guard_orders_update, mensyaratkan marker NOT NULL)
-- tidak pernah api -> stok bocor permanen tanpa pemulihan otomatis.
--
-- Fungsi baru reserve_stock_for_order() melakukan keduanya dalam SATU
-- transaksi database:
--   1. Validasi input (tanpa tulis apa pun).
--   2. Decrement products persis seperti reserve_stock (stok cukup + tepat
--      1 baris, else RETURN false — pada titik ini BELUM ada yang tertulis).
--   3. Klaim marker stock_reserved_at pada baris order yang tepat (milik
--      buyer, pra-terminal, belum bertanda, kuantitas cocok; tepat 1 baris).
--      Gagal di sini berarti decrement SUDAH tertulis dalam transaksi yang
--      sama, sehingga dipakai RAISE EXCEPTION (bukan RETURN) agar SELURUH
--      transaksi ROLLBACK — RETURN biasa justru akan COMMIT decrement yatim.
--
-- Replay-aman: respons hilang padahal commit -> pemanggilan ulang mendecrement
-- lagi TETAPI klaim marker mendapat 0 baris (sudah bertanda) -> EXCEPTION +
-- rollback (decrement kedua dibatalkan). Pemanggil membedakan via baca
-- marker: bertanda = reservasi terbukti milik order ini -> lanjutkan alur;
-- tak bertanda = tak ada reservasi tertahan -> jalankan penanganan gagal
-- biasa (TANPA release_stock spekulatif).
--
-- Kompatibilitas:
-- - Fungsi LAMA (reserve_stock/release_stock/release_order_stock) TIDAK
--   diubah dan TIDAK dihapus; jalur legacy tetap memakainya.
-- - Referensi invoice_state SENGAJA dihindari agar fungsi tetap valid walau
--   migration 2D-E belum ada; pemanggil hanya memakai jalur keyed setelah
--   klaim kolom 2D-E terbukti ada.
-- - Prasyarat kolom stock_reserved_at/released_at dari P0-B (20261007...),
--   yang secara urutan berjalan SEBELUM migration ini.
-- - order_code UNIQUE (0003) sehingga klaim tidak ambigu; guard ROW_COUNT
--   tetap fail-closed bila asumsi itu dilanggar.
--
-- Hak akses minimal: hanya service_role (pola sama dengan spend/refund/
-- consume_promo). Grant release_stock TIDAK diubah pada tahap ini.
--
-- Rollback migration: DROP FUNCTION (fungsi lama tak tersentuh; order yang
-- sudah bertanda via fungsi ini tetap konsisten karena marker+trigger utuh).
-- Idempotent (CREATE OR REPLACE + REVOKE/GRANT ulang aman).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reserve_stock_for_order(
  p_order_code text,
  p_buyer_id uuid,
  p_slug text,
  p_quantity integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_products_updated integer;
  v_orders_updated integer;
BEGIN
  IF p_order_code IS NULL OR btrim(p_order_code) = '' THEN
    RETURN false;
  END IF;
  IF p_buyer_id IS NULL THEN
    RETURN false;
  END IF;
  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RETURN false;
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN false;
  END IF;

  -- 1) Kurangi stok hanya bila cukup (pola identik reserve_stock).
  UPDATE public.products
     SET stock = stock - p_quantity,
         sold_count = sold_count + p_quantity,
         status = CASE WHEN stock - p_quantity <= 0 THEN 'sold_out' ELSE status END
   WHERE slug = p_slug
     AND stock >= p_quantity;
  GET DIAGNOSTICS v_products_updated = ROW_COUNT;
  IF v_products_updated <> 1 THEN
    -- Stok kurang / produk tak dikenal: belum ada yang tertulis.
    RETURN false;
  END IF;

  -- 2) Ikat reservasi ke baris order yang tepat. Tepat-1-baris atau gagal:
  --    0 baris (terminal/tak-valid/sudah bertanda) atau >1 (ambiguitas
  --    order_code ganda). Decrement di atas SUDAH tertulis dalam transaksi
  --    ini, jadi kegagalan HARUS berupa EXCEPTION agar semuanya ROLLBACK
  --    (RETURN biasa akan COMMIT decrement yatim tanpa marker).
  UPDATE public.orders
     SET stock_reserved_at = now()
   WHERE order_code = p_order_code
     AND buyer_id = p_buyer_id
     AND quantity = p_quantity
     AND payment_status = 'unpaid'
     AND order_status = 'pending'
     AND stock_reserved_at IS NULL
     AND stock_released_at IS NULL;
  GET DIAGNOSTICS v_orders_updated = ROW_COUNT;
  IF v_orders_updated <> 1 THEN
    RAISE EXCEPTION 'reserve_stock_for_order: klaim marker gagal untuk order % (0 = terminal/tak-valid/sudah-bertanda, >1 = ambigu)',
      p_order_code;
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_stock_for_order(text, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_stock_for_order(text, uuid, text, integer) TO service_role;

COMMENT ON FUNCTION public.reserve_stock_for_order(text, uuid, text, integer) IS
  'Tahap 2D-J: decrement stok + marker stock_reserved_at atomik per order; replay-aman via marker (Desain B audit 2D-I).';
