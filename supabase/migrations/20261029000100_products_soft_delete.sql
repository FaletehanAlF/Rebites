-- ============================================================================
-- Hapus produk oleh penjual menjadi soft delete
--
-- MASALAH: `deleteSellerProduct` menjalankan DELETE fisik. Setelah baris
-- hilang, admin tidak bisa lagi membuka detail produk yang dilaporkan atau
-- ditindak (endpoint /api/admin/products/:id menjawab 404), padahal admin
-- perlu menelusuri produk yang sudah ditarik penjual.
--
-- PERUBAHAN: satu kolom penanda `deleted_at`.
--   - Produk terhapus tetap ada (foto, harga, riwayat moderasi utuh) sehingga
--     admin dapat memeriksanya, dengan label "sudah dihapus oleh penjual".
--   - Pembeli tidak melihatnya: products_select_public mensyaratkan
--     deleted_at IS NULL.
--   - Penjual tidak melihatnya di daftar menunya: products_select_own juga
--     mensyaratkan deleted_at IS NULL.
--   - Admin melihat semua (products_select_admin tidak diubah).
--
-- CATATAN: baris yang sudah terlanjur dihapus fisik sebelum migrasi ini tidak
-- dapat dipulihkan; migrasi tidak melakukan backfill dan tidak mengubah data.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + DROP POLICY IF EXISTS + CREATE POLICY.
-- ============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_products_deleted_at
  ON public.products(deleted_at);

COMMENT ON COLUMN public.products.deleted_at IS
  'NULL = produk aktif. Terisi = ditarik penjual (soft delete): disembunyikan dari pembeli dan dari daftar menu penjual, tetapi tetap terbaca admin untuk penelusuran.';

-- ----------------------------------------------------------------------------
-- 1. Publik: hanya produk approved DAN belum dihapus
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "products_select_public" ON public.products;
CREATE POLICY "products_select_public"
ON public.products FOR SELECT
TO anon, authenticated
USING (
  products.verification_status = 'approved'
  AND products.deleted_at IS NULL
);

-- ----------------------------------------------------------------------------
-- 2. Pemilik toko: semua status produknya yang BELUM dihapus
--    (produk yang ditarik penjual tidak lagi tampil di "Menu Saya")
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "products_select_own" ON public.products;
CREATE POLICY "products_select_own"
ON public.products FOR SELECT
TO authenticated
USING (
  products.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.umkm_profiles u
    WHERE u.id = products.umkm_id AND u.user_id = auth.uid()
  )
);

-- products_select_admin sengaja TIDAK diubah: admin tetap membaca seluruh
-- baris, termasuk yang sudah dihapus penjual.

COMMENT ON POLICY "products_select_public" ON public.products IS
  'Hanya produk approved dan belum dihapus yang terlihat publik (anon + authenticated).';
COMMENT ON POLICY "products_select_own" ON public.products IS
  'Pemilik toko membaca semua status produknya sendiri yang belum dihapus, termasuk rejected beserta rejection_reason.';
