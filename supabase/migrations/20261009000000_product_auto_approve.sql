-- ============================================================================
-- Product Auto-Approve (kebijakan verifikasi produk UMKM baru)
--
-- Kebijakan bisnis baru:
--   - Produk baru dari UMKM yang memenuhi syarat LANGSUNG 'approved'
--     (post-publish monitoring oleh admin, bukan persetujuan per produk).
--   - Verifikasi akun UMKM + langganan aktif tetap dipertahankan di lapisan
--     aplikasi (tidak diubah di sini).
--
-- Yang diubah migration ini (aditif, tanpa menghapus objek):
--   1. DEFAULT products.verification_status: 'pending' -> 'approved'.
--      CHECK constraint ('pending'|'approved'|'rejected') dipertahankan agar
--      takedown (rejected) dan riwayat tetap berfungsi.
--   2. RLS products_insert_own: WITH CHECK menuntut 'approved' (was 'pending').
--      Syarat reviewed_*/rejection_reason NULL dipertahankan.
--   3. Trigger BEFORE INSERT (trg_products_verification_insert): non-admin
--      dipaksa ke 'approved' (was 'pending'). Fungsi dan nama trigger
--      dipertahankan (CREATE OR REPLACE).
--   4. Trigger BEFORE UPDATE (trg_products_verification_update): TIDAK
--      DIUBAH — penjual tetap tidak dapat mengubah status verifikasi
--      sendiri (revert ke OLD), sehingga tak ada jalur self-approval.
--   5. Backfill produk lama pending -> approved: OPT-IN (tidak otomatis).
--      Default-nya dilewati dengan RAISE NOTICE berisi jumlah produk yang
--      terdampak, dan notice itu sengaja TIDAK mengarahkan operator untuk
--      menjalankan ulang file migration. Jalur yang direkomendasikan adalah
--      blok SQL mandiri yang tertulis di Bagian 5 (tinjau SELECT dulu, lalu
--      jalankan UPDATE dalam satu transaksi).
--      Blok DO di bawah hanya tersedia bila operator menyalakannya lewat
--      custom GUC rebites.backfill_pending_products='on' SEBELUM migration ini
--      diterapkan. Saat aktif, ia menonaktifkan trigger yang relevan HANYA bila
--      trigger itu ada (jadi aman dijalankan sebelum maupun sesudah
--      20261010000000) dan memulihkannya bila terjadi error. Menonaktifkan
--      trg_products_verification_update wajib karena is_admin() bernilai false
--      saat migration (tanpa JWT) sehingga trigger akan mengembalikan baris ke
--      OLD dan backfill menjadi no-op diam-diam. reviewed_at/by/reason TIDAK
--      diisi (jujur: bukan hasil review; kolom nullable, tak ada constraint
--      mewajibkan).
--
-- Backfill jujur:
--   - Hanya WHERE verification_status = 'pending' (approved/rejected utuh).
--   - Tanpa DELETE, tanpa moderation_logs/activity_logs palsu, tanpa identitas
--     admin palsu, tanpa notifikasi palsu ke UMKM.
--   - Idempoten: hanya menyentuh sisa pending.
--   - TIDAK berjalan otomatis; tidak ada produk lama yang berubah status
--     tanpa tindakan eksplisit operator.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Default kolom menjadi 'approved'
-- ----------------------------------------------------------------------------
ALTER TABLE public.products
  ALTER COLUMN verification_status SET DEFAULT 'approved';

-- ----------------------------------------------------------------------------
-- 2. RLS INSERT penjual: izinkan 'approved'
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "products_insert_own" ON public.products;
CREATE POLICY "products_insert_own"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.umkm_profiles u
    WHERE u.id = products.umkm_id AND u.user_id = auth.uid()
  )
  AND products.verification_status = 'approved'
  AND products.reviewed_at IS NULL
  AND products.reviewed_by IS NULL
  AND products.rejection_reason IS NULL
);

-- ----------------------------------------------------------------------------
-- 3. Trigger BEFORE INSERT: non-admin dipaksa 'approved'
--    (nama fungsi & trigger sama dengan 20260928120001; OR REPLACE aman)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_product_verification_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.verification_status := 'approved';
    NEW.reviewed_at := NULL;
    NEW.reviewed_by := NULL;
    NEW.rejection_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_verification_insert ON public.products;
CREATE TRIGGER trg_products_verification_insert
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_product_verification_on_insert();

-- ----------------------------------------------------------------------------
-- 4. Trigger BEFORE UPDATE: SENGAJA TIDAK DIUBAH (lihat
--    20260928120001_product_verification.sql) — penjual tetap tidak dapat
--    mengubah verification_status sendiri (revert ke OLD).
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 5. Backfill produk lama 'pending' -> 'approved'  (OPT-IN, TIDAK OTOMATIS)
--
-- KEBILAKAN: file ini TIDAK mengubah produk lama secara massal. Sesuai
-- keputusan bisnis, produk uji coba / produk yang statusnya belum jelas harus
-- ditinjau manusia lebih dulu, bukan otomatis dipromosikan jadi live.
-- Karena itu blok backfill di bawah DILEWATI secara default.
--
-- ============================ CARA YANG DIREKOMENDASIKAN ====================
-- JANGAN menjalankan ulang file migration ini untuk mem-backfill. Gunakan blok
-- mandiri berikut di sesi/editor SQL pada proyek Supabase, setelah review:
--
--   -- 1) tinjau dulu (WAJIB, tidak mengubah apa pun)
--   SELECT id, name, umkm_id, created_at
--     FROM public.products
--    WHERE verification_status = 'pending'
--    ORDER BY created_at;
--
--   -- 2) bila yakin, jalankan HANYA blok ini (dalam satu transaksi)
--   BEGIN;
--     ALTER TABLE public.products DISABLE TRIGGER trg_products_verification_update;
--     ALTER TABLE public.products DISABLE TRIGGER trg_products_activity_update;
--     ALTER TABLE public.products DISABLE TRIGGER trg_products_notify_verification;
--     UPDATE public.products SET verification_status = 'approved'
--      WHERE verification_status = 'pending';
--     ALTER TABLE public.products ENABLE TRIGGER trg_products_verification_update;
--     ALTER TABLE public.products ENABLE TRIGGER trg_products_activity_update;
--     ALTER TABLE public.products ENABLE TRIGGER trg_products_notify_verification;
--   COMMIT;
--
-- Kenapa trigger di atas dinonaktifkan: tanpa itu, backfill akan
-- (a) memicu log 'product_updated' palsu yang diatribusikan ke PEMILIK TOKO
--     (auth.uid() NULL saat migrasi), dan
-- (b) mengirim notifikasi "Produk Disetujui" massal ke UMKM, seolah-olah
--     admin yang menyetujui — padahal tidak ada admin yang bertindak.
-- Penonaktifan hanya berlaku bila trigger benar-benar ada, sehingga blok ini
-- aman dijalankan baik sebelum maupun sesudah 20261010000000.
--
-- Blok DO di bawah menyediakan jalur yang sama (berguna bila operator ingin
-- menyalakannya SEBELUM migration 20261010000000 diterapkan, lewat custom GUC
-- rebites.backfill_pending_products='on'), dengan penanganan trigger yang tidak
-- ada dan pemulihan trigger bila terjadi error.
--
-- Yang Dijaga:
--   - Tidak ada DELETE.
--   - Tidak ada moderation_logs/activity_logs palsu (backfill bukan hasil
--     review admin; reviewed_at/by/reason sengaja TIDAK diisi — kolomnya
--     nullable dan tidak ada constraint yang mewajibkan).
--   - Idempoten: hanya menyentuh sisa pending.
--   - TIDAK berjalan otomatis; tidak ada produk lama yang berubah status
--     tanpa tindakan eksplisit operator.
-- ----------------------------------------------------------------------------
DO $do$
DECLARE
  v_pending integer;
  v_trg text;
  v_disabled text[] := ARRAY[]::text[];
BEGIN
  SELECT count(*) INTO v_pending
    FROM public.products
   WHERE verification_status = 'pending';

  IF v_pending = 0 THEN
    RAISE NOTICE 'product_auto_approve: tidak ada produk pending; backfill dilewati.';
    RETURN;
  END IF;

  IF current_setting('rebites.backfill_pending_products', true) IS DISTINCT FROM 'on' THEN
    RAISE NOTICE
      'product_auto_approve: % produk masih pending. Backfill TIDAK dijalankan (opt-in). '
      'Tinjau manual dengan SELECT, lalu jalankan blok SQL mandiri yang dijelaskan '
      'di blok komentar migration ini. JANGAN menjalankan ulang file migration.',
      v_pending;
    RETURN;
  END IF;

  -- Nonaktifkan trigger yang relevan HANYA bila benar-benar ada, sehingga
  -- blok ini aman dijalankan baik sebelum maupun sesudah 20261010000000.
  FOREACH v_trg IN ARRAY ARRAY[
    'trg_products_verification_update',
    'trg_products_activity_update',
    'trg_products_notify_verification'
  ] LOOP
    IF EXISTS (
      SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = 'products'
         AND t.tgname = v_trg
    ) THEN
      EXECUTE format('ALTER TABLE public.products DISABLE TRIGGER %I', v_trg);
      v_disabled := array_append(v_disabled, v_trg);
    END IF;
  END LOOP;

  UPDATE public.products
     SET verification_status = 'approved'
   WHERE verification_status = 'pending';

  FOREACH v_trg IN ARRAY v_disabled LOOP
    EXECUTE format('ALTER TABLE public.products ENABLE TRIGGER %I', v_trg);
  END LOOP;
  v_disabled := ARRAY[]::text[];

  RAISE NOTICE 'product_auto_approve: % produk pending dipromosikan menjadi approved.', v_pending;
EXCEPTION
  WHEN OTHERS THEN
    -- Pulihkan hanya trigger yang benar-benar dinonaktifkan blok ini, lalu
    -- teruskan error supaya migrasi gagal eksplisit (bukan no-op diam-diam).
    FOREACH v_trg IN ARRAY v_disabled LOOP
      EXECUTE format('ALTER TABLE public.products ENABLE TRIGGER %I', v_trg);
    END LOOP;
    RAISE;
END;
$do$;

COMMENT ON COLUMN public.products.verification_status IS
  'Auto-approve: produk baru langsung approved (post-publish monitoring). pending = antrean lama; rejected = takedown admin.';
