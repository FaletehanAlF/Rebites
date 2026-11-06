-- ============================================================================
-- NOTIF-1H: policy INSERT reports mensyaratkan relasi pesanan yang sah
--
-- Temuan (audit NOTIF-1G, read-only):
--   Policy `reports_insert_own_or_admin` (20261001000000:238-241) hanya
--   memeriksa `auth.uid() = reported_by OR is_admin()`. Karena trigger
--   `enforce_report_insert_defaults` (20261001000000:268-292) MEMAKSA
--   `NEW.reported_by := auth.uid()` untuk non-admin, klausa pertama selalu
--   benar sehingga policy tersebut praktis tidak menyaring apa pun.
--
--   `reported_user_id` tidak divalidasi di database sama sekali:
--     - FK hanya `REFERENCES public.profiles(id)` — menjamin UUID itu ada,
--       bukan bahwa ia pemilik toko yang berhubungan dengan pelapor;
--     - tidak ada CHECK constraint;
--     - tidak ada trigger yang memeriksa relasi.
--
--   `public` diekspos PostgREST (config.toml: api.schemas) dan
--   `authenticated` punya GRANT INSERT pada reports (20261001000000:222).
--   Akibatnya INSERT langsung ke /rest/v1/reports dapat menunjuk UUID
--   sembarang. Baris itu lalu:
--     - terbaca oleh target lewat `reports_select_involved_or_admin`
--       (auth.uid() = reported_user_id), termasuk `description`-nya;
--     - memicu notifikasi `report_received` (migrasi 20261021090000).
--
-- Perbaikan (minimum, aditif):
--   Menambah SATU policy RESTRICTIVE untuk INSERT. Policy restrictive
--   di-AND-kan dengan policy permissive yang sudah ada, sehingga:
--     - `reports_insert_own_or_admin` TIDAK diubah dan TIDAK dihapus;
--     - aturan baru hanya mempersempit, tidak pernah melonggarkan.
--
--   Aturan yang ditegakkan identik dengan route API
--   (`app/api/reports/route.ts` → hasReportableOrderRelation, :24-84):
--     a. `reported_user_id` harus pemilik toko (umkm_profiles.user_id);
--     b. pelapor harus punya pesanan pada toko itu, dicek lewat
--        `orders.umkm_id` ATAU `orders.vendor_slug` — sama dengan kedua
--        jalur yang dipakai route;
--     c. laporan atas diri sendiri ditolak (route: 400);
--     d. admin dikecualikan (aturan moderasi yang sudah ada).
--
--   Catatan: `orders.umkm_id` adalah NOT NULL (0001:206), jadi jalur
--   `umkm_id` sudah mencakup seluruh baris. Jalur `vendor_slug` tetap
--   disertakan agar semantiknya PERSIS sama dengan route — kalau route
--   menerima suatu laporan, database juga harus menerimanya.
--
-- Rekursi RLS (diperiksa statis, lalu diuji runtime):
--   reports -> orders (orders_select_participants)
--           -> umkm_profiles (umkm_select_public: USING true)
--           -> is_admin() (SECURITY DEFINER, mem-bypass RLS)
--   Tidak ada jalur balik ke `reports` => tidak ada rekursi.
--   Subquery dijalankan sebagai pemanggil (authenticated), yang memang
--   punya GRANT SELECT pada kedua tabel (20260825090000_0008:21).
--
-- Kinerja: satu EXISTS dengan index `idx_orders_buyer` (0001:220) dan
--   `idx_orders_vendor_slug` (0003:85); join ke PK umkm_profiles.id.
--   Biaya per INSERT kecil dan hanya untuk non-admin.
--
-- Idempotent: DROP POLICY IF EXISTS + CREATE POLICY.
-- ============================================================================

DROP POLICY IF EXISTS "reports_insert_requires_order_relation" ON public.reports;

CREATE POLICY "reports_insert_requires_order_relation"
ON public.reports
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR (
    auth.uid() = reported_by
    AND reports.reported_user_id IS NOT NULL
    AND reports.reported_user_id <> auth.uid()
    AND (
      -- Jalur 1: relasi lewat umkm_id (kolom NOT NULL, jalur utama).
      EXISTS (
        SELECT 1
          FROM public.orders o
          JOIN public.umkm_profiles u ON u.id = o.umkm_id
         WHERE o.buyer_id = auth.uid()
           AND u.user_id = reports.reported_user_id
      )
      -- Jalur 2: relasi lewat vendor_slug (paritas dengan route API).
      OR EXISTS (
        SELECT 1
          FROM public.orders o
          JOIN public.umkm_profiles u ON u.slug = o.vendor_slug
         WHERE o.buyer_id = auth.uid()
           AND u.user_id = reports.reported_user_id
      )
    )
  )
);

COMMENT ON POLICY "reports_insert_requires_order_relation" ON public.reports IS
  'NOTIF-1H: non-admin hanya boleh membuat laporan terhadap pemilik toko yang punya pesanan dengan pelapor (umkm_id atau vendor_slug). Admin dikecualikan. Policy RESTRICTIVE, di-AND dengan reports_insert_own_or_admin yang tidak diubah.';
