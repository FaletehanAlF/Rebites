-- ============================================================================
-- Tipe transaksi koin 'adjustment' untuk penyesuaian oleh Super Admin.
--
-- Admin tidak boleh menyetel saldo: saldo adalah TURUNAN ledger
-- ((earned + refund) - spent). Memberi atau menarik koin harus tercatat sebagai
-- baris baru, dan baris itu perlu tipe sendiri.
--
-- Mengapa tidak memakai 'earned' saja: riwayat user akan terbaca
-- "Reward pembelian" padahal koinnya hadiah/koreksi admin. Data yang berbohong
-- tentang asalnya lebih buruk daripada satu nilai enum tambahan.
--
-- Catatan: penarikan koin memakai tipe 'spent' yang sudah ada, karena
-- coin_transactions.amount punya CHECK (amount > 0) sehingga angka negatif
-- tidak mungkin. Deskripsinya diberi awalan "Ditarik admin" agar user bisa
-- membedakannya dari potongan pesanan.
--
-- Aditif saja: tidak mengubah, menghapus, atau menyalin ulang baris lama.
-- ============================================================================

DO $$
DECLARE
  cname text;
BEGIN
  -- Cari constraint CHECK yang memuat daftar tipe lama. Namanya bisa berbeda
  -- antar database (migrasi sebelumnya membuatnya lewat DO-block), jadi
  -- dicari berdasarkan definisinya, bukan berdasarkan nama yang diandaikan.
  SELECT conname INTO cname
    FROM pg_constraint
   WHERE conrelid = 'public.coin_transactions'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%earned%'
     AND pg_get_constraintdef(oid) LIKE '%spent%'
   LIMIT 1;

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.coin_transactions DROP CONSTRAINT %I', cname);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.coin_transactions'::regclass
       AND conname = 'coin_transactions_type_check'
  ) THEN
    ALTER TABLE public.coin_transactions
      ADD CONSTRAINT coin_transactions_type_check
      CHECK (type IN ('earned', 'spent', 'refund', 'adjustment'));
  END IF;
END $$;

COMMENT ON CONSTRAINT coin_transactions_type_check ON public.coin_transactions IS
  'earned/refund/adjustment menambah saldo; spent mengurangi. amount SELALU positif.';
