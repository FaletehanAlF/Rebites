-- ============================================================================
-- Product Auto-Approve follow-up: activity log tepercaya + notifikasi
-- moderasi via trigger + Realtime publication.
--
-- Konteks:
--   - 20261009000000_product_auto_approve.sql (untracked, belum dijalankan)
--     mengubah default/RLS/trigger INSERT menjadi 'approved' (post-publish
--     monitoring). File ini MELENGKAPI, bukan menggantikannya.
--   - activity_logs sudah punya tipe product_created/updated/deleted
--     (20261001000000) tetapi TIDAK ADA produsen otomatis: grep insert
--     activity_logs dan CREATE TRIGGER -> activity_logs nol. Akibatnya
--     dashboard admin monitoring kosong untuk aktivitas produk.
--   - notifications_insert_self (20261007000006) mewajibkan
--     auth.uid() = user_id, sehingga API admin (authed admin client) TIDAK
--     BISA insert notifikasi untuk seller lain (gagal RLS, ditelan
--     try/catch di approve/reject). Notifikasi moderasi produk karenanya
--     tidak terkirim andal.
--
-- Yang diubah migration ini (aditif, idempoten, tanpa DELETE data):
--   1. notifications.type: tambah 'product_warning' (tipe lama dipertahankan).
--   2. Trigger AFTER INSERT/UPDATE/DELETE pada products -> activity_logs
--      (SECURITY DEFINER, actor = auth.uid() atau fallback pemilik toko).
--      UMKM tidak bisa memalsukan aktor: nilai diambil server-side dari
--      auth.uid(), bukan dari payload client. Metadata hanya ringkasan aman
--      (nama, kategori, harga, stok, status) — tanpa password/token.
--   3. Trigger AFTER UPDATE pada products untuk notifikasi seller saat
--      verification_status berubah (approved/rejected): takedown, restore,
--      dan approval lanjutan tetap memberi tahu UMKM bersangkutan.
--   4. Trigger AFTER INSERT pada warnings -> notifikasi 'product_warning'
--      untuk user yang diperingatkan (pesan membawa level + kategori).
--   5. Realtime publication: activity_logs, products, warnings, reports
--      ditambahkan bila belum ada (pola 0003 _align_frontend_schema).
--
-- Yang SENGAJA tidak diubah:
--   - Trigger verifikasi INSERT/UPDATE dari 20260928120001 +
--     20261009000000 (proteksi self-approval penjual dipertahankan).
--   - RLS products, activity_logs, warnings, notifications (tidak dilonggarkan).
--   - products.status operasional (available/sold_out/hidden) tidak disentuh.
--   - Tidak ada klaim AI detector; deteksi mencurigakan murni aturan
--     client-side di lib/product-suspicion.ts.
--
-- Urutan aman: fungsi dulu, lalu DROP TRIGGER IF EXISTS + CREATE TRIGGER,
-- lalu publication. Semua CREATE OR REPLACE / IF NOT EXISTS sehingga rerun
-- aman. Jangan dijalankan ke Supabase aktif tanpa review.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. notifications.type: tambah 'product_warning'
--    (pola 20260928120003_moderation_notification_types.sql)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'order_created','payment_success','order_delivering','order_completed',
    'promo','incoming_order','new_review','subscription_active','subscription_renewed',
    'subscription_expiring','subscription_changed','subscription_expired',
    'product_approved','product_rejected','product_warning'
  ));

-- ----------------------------------------------------------------------------
-- 2. products -> activity_logs (tepercaya, server-side)
--
-- Prinsip:
--   - SECURITY DEFINER: INSERT log melewati RLS sebagai owner; INSERT manual
--     via client tetap tunduk pada policy activity_logs_insert_own_or_admin
--     (user hanya atas nama sendiri, admin bebas) yang TIDAK diubah.
--   - Aktor: auth.uid() bila ada (jalur normal authed client). Bila NULL
--     (service_role/system), fallback ke pemilik toko (umkm_profiles.user_id)
--     dan tandai metadata.actor_source agar jujur, bukan mengarang admin.
--   - UPDATE hanya dicatat bila kolom relevan berubah (nama, deskripsi,
--     foto, harga, stok, kategori, status operasional, verifikasi, fulfillment,
--     shipping). Perubahan reviewed_*/rejection_reason oleh admin ikut
--     tercatat sebagai moderasi (lihat Bagian 3 untuk notifikasi).
--   - Tidak ada trigger pada activity_logs itu sendiri (tanpa loop).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_product_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_owner uuid;
  v_umkm uuid;
  v_name text;
  v_source text;
  v_changed text[] := '{}';
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_umkm := NEW.umkm_id;
    v_name := NEW.name;
    SELECT u.user_id INTO v_owner FROM public.umkm_profiles u WHERE u.id = NEW.umkm_id;
    v_actor := COALESCE(auth.uid(), v_owner);
    v_source := CASE WHEN auth.uid() IS NOT NULL THEN 'auth' ELSE 'owner_fallback' END;

    INSERT INTO public.activity_logs (user_id, activity_type, description, target_type, target_id, metadata)
    VALUES (
      v_actor,
      'product_created',
      'Produk baru ditambahkan: ' || COALESCE(v_name, '(tanpa nama)'),
      'product',
      NEW.id,
      jsonb_build_object(
        'auto', true,
        'actor_source', v_source,
        'product_id', NEW.id,
        'umkm_id', v_umkm,
        'name', v_name,
        'category', NEW.category,
        'surplus_price', NEW.surplus_price,
        'original_price', NEW.original_price,
        'stock', NEW.stock,
        'status', NEW.status,
        'verification_status', NEW.verification_status,
        'image_present', (NEW.image_url IS NOT NULL AND btrim(NEW.image_url) <> '')
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_umkm := NEW.umkm_id;
    v_name := NEW.name;
    SELECT u.user_id INTO v_owner FROM public.umkm_profiles u WHERE u.id = NEW.umkm_id;
    v_actor := COALESCE(auth.uid(), v_owner);
    v_source := CASE WHEN auth.uid() IS NOT NULL THEN 'auth' ELSE 'owner_fallback' END;

    IF NEW.name IS DISTINCT FROM OLD.name THEN v_changed := v_changed || 'name'; END IF;
    IF NEW.description IS DISTINCT FROM OLD.description THEN v_changed := v_changed || 'description'; END IF;
    IF NEW.image_url IS DISTINCT FROM OLD.image_url THEN v_changed := v_changed || 'image_url'; END IF;
    IF NEW.original_price IS DISTINCT FROM OLD.original_price THEN v_changed := v_changed || 'original_price'; END IF;
    IF NEW.surplus_price IS DISTINCT FROM OLD.surplus_price THEN v_changed := v_changed || 'surplus_price'; END IF;
    IF NEW.stock IS DISTINCT FROM OLD.stock THEN v_changed := v_changed || 'stock'; END IF;
    IF NEW.category IS DISTINCT FROM OLD.category THEN v_changed := v_changed || 'category'; END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN v_changed := v_changed || 'status'; END IF;
    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN v_changed := v_changed || 'verification_status'; END IF;
    IF NEW.is_delivery IS DISTINCT FROM OLD.is_delivery THEN v_changed := v_changed || 'is_delivery'; END IF;
    IF NEW.is_pickup IS DISTINCT FROM OLD.is_pickup THEN v_changed := v_changed || 'is_pickup'; END IF;
    IF NEW.weight_gram IS DISTINCT FROM OLD.weight_gram THEN v_changed := v_changed || 'weight_gram'; END IF;
    IF NEW.length_cm IS DISTINCT FROM OLD.length_cm THEN v_changed := v_changed || 'length_cm'; END IF;
    IF NEW.width_cm IS DISTINCT FROM OLD.width_cm THEN v_changed := v_changed || 'width_cm'; END IF;
    IF NEW.height_cm IS DISTINCT FROM OLD.height_cm THEN v_changed := v_changed || 'height_cm'; END IF;

    -- Perubahan murni reviewed_at (touch tanpa makna) tidak dicatat agar log tidak berisik.
    IF v_changed = '{}' THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.activity_logs (user_id, activity_type, description, target_type, target_id, metadata)
    VALUES (
      v_actor,
      'product_updated',
      'Produk diperbarui: ' || COALESCE(v_name, '(tanpa nama)') || ' (' || array_to_string(v_changed, ', ') || ')',
      'product',
      NEW.id,
      jsonb_build_object(
        'auto', true,
        'actor_source', v_source,
        'product_id', NEW.id,
        'umkm_id', v_umkm,
        'name', v_name,
        'changed_fields', v_changed,
        'old_surplus_price', OLD.surplus_price,
        'new_surplus_price', NEW.surplus_price,
        'old_stock', OLD.stock,
        'new_stock', NEW.stock,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'old_verification_status', OLD.verification_status,
        'new_verification_status', NEW.verification_status,
        'image_changed', ('image_url' = ANY (v_changed))
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_umkm := OLD.umkm_id;
    v_name := OLD.name;
    SELECT u.user_id INTO v_owner FROM public.umkm_profiles u WHERE u.id = OLD.umkm_id;
    v_actor := COALESCE(auth.uid(), v_owner);
    v_source := CASE WHEN auth.uid() IS NOT NULL THEN 'auth' ELSE 'owner_fallback' END;

    INSERT INTO public.activity_logs (user_id, activity_type, description, target_type, target_id, metadata)
    VALUES (
      v_actor,
      'product_deleted',
      'Produk dihapus: ' || COALESCE(v_name, '(tanpa nama)'),
      'product',
      OLD.id,
      jsonb_build_object(
        'auto', true,
        'actor_source', v_source,
        'product_id', OLD.id,
        'umkm_id', v_umkm,
        'name', v_name,
        'category', OLD.category,
        'surplus_price', OLD.surplus_price,
        'verification_status', OLD.verification_status
      )
    );
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_activity_insert ON public.products;
CREATE TRIGGER trg_products_activity_insert
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_product_activity();

DROP TRIGGER IF EXISTS trg_products_activity_update ON public.products;
CREATE TRIGGER trg_products_activity_update
  AFTER UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_product_activity();

DROP TRIGGER IF EXISTS trg_products_activity_delete ON public.products;
CREATE TRIGGER trg_products_activity_delete
  AFTER DELETE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_product_activity();

-- ----------------------------------------------------------------------------
-- 3. Notifikasi moderasi produk via trigger (jalur tepercaya).
--
-- Masalah yang diperbaiki: notifications_insert_self mewajibkan
-- auth.uid() = user_id, sehingga authed admin client tidak bisa insert
-- notifikasi untuk seller (gagal RLS). Trigger SECURITY DEFINER melewati
-- RLS sebagai owner — pola yang sama seperti notify_on_order_status_change
-- dan notify_on_review_insert (20261007000006).
--
-- Hanya pada TRANSISI verification_status (approved <-> rejected, atau dari
-- pending lama). Perubahan kolom lain tidak memicu notifikasi.
-- Pesan hanya memuat nama produk + status + alasan (bila rejected) — tanpa
-- data sensitif.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_product_verification_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller uuid;
  v_type text;
  v_title text;
  v_message text;
BEGIN
  IF NEW.verification_status IS NOT DISTINCT FROM OLD.verification_status THEN
    RETURN NEW;
  END IF;
  IF NEW.verification_status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;

  SELECT u.user_id INTO v_seller FROM public.umkm_profiles u WHERE u.id = NEW.umkm_id;
  IF v_seller IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.verification_status = 'approved' THEN
    v_type := 'product_approved';
    v_title := 'Produk Disetujui';
    v_message := 'Produk "' || COALESCE(NEW.name, 'Produk') || '" telah disetujui dan dapat ditampilkan di marketplace.';
  ELSE
    v_type := 'product_rejected';
    v_title := 'Produk Ditolak / Diturunkan';
    v_message := 'Produk "' || COALESCE(NEW.name, 'Produk') || '" ditolak/diturunkan. Alasan: ' || COALESCE(NULLIF(btrim(NEW.rejection_reason), ''), '-');
  END IF;

  INSERT INTO public.notifications (user_id, role, type, title, message, reference_id, href)
  VALUES (v_seller, 'seller', v_type, v_title, v_message, NEW.id, '/dashboard/penjual/menu');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_notify_verification ON public.products;
CREATE TRIGGER trg_products_notify_verification
  AFTER UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_product_verification_change();

-- ----------------------------------------------------------------------------
-- 4. Notifikasi peringatan via trigger (warnings -> notifications).
--
-- warnings adalah user-level (tanpa product_id). Trigger ini memberi tahu
-- UMKM yang diperingatkan dengan tipe 'product_warning' bila kategori
-- berkaitan dengan produk, dan tipe yang sama untuk peringatan umum agar
-- UMKM tetap melihatnya di dashboard penjual (sistem notifikasi seller
-- sudah membaca tabel notifications via useNotifications('seller')).
-- Helper API tetap memakai authed client untuk INSERT warnings (atribusi
-- issued_by = auth.uid() + audit otomatis audit_warning_issued);
-- trigger ini hanya menambah notifikasi, bukan menggantikan audit.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_warning_issued()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (user_id, role, type, title, message, reference_id, href)
  VALUES (
    NEW.user_id,
    'seller',
    'product_warning',
    'Peringatan Admin (Level ' || COALESCE(NEW.warning_level::text, '?') || ')',
    'Kategori: ' || COALESCE(NEW.category, '-') || '. Alasan: ' || COALESCE(NEW.reason, '-'),
    NEW.id,
    '/dashboard/penjual/menu'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Notifikasi bersifat best-effort: kegagalan di sini tidak boleh
  -- menggagalkan INSERT warnings (peringatan + audit lebih penting).
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_warnings_notify_seller ON public.warnings;
CREATE TRIGGER trg_warnings_notify_seller
  AFTER INSERT ON public.warnings
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_warning_issued();

-- ----------------------------------------------------------------------------
-- 5. Realtime publication (idempoten, pola 0003).
--    Admin monitoring memakai postgres_changes pada keempat tabel ini.
--
-- CATATAN KEAMANAN (dibaca bersama RLS, bukan terpisah):
--   - Menambahkan tabel ke publication TIDAK memberi hak baca baru. Event
--     postgres_changes hanya dikirim ke subscriber yang RLS-nya mengizinkan
--     baris tersebut:
--       * activity_logs -> "activity_logs_select_own_or_admin"
--         (auth.uid() = user_id OR is_admin()): admin melihat semua,
--         non-admin hanya barisnya sendiri. Sudah ter-scope dengan benar.
--       * warnings -> "warnings_select_own_or_admin" (admin atau pemilik).
--       * reports  -> "reports_select_involved_or_admin" (admin/pelapor/terlapor).
--       * products -> "products_select_public" = USING (true) untuk
--         anon+authenticated (dari 20260806050337). Artinya produk rejected/
--         pending SUDAH bisa dibaca siapa pun lewat REST SEBELUM publication ini
--         ditambahkan; itu kondisi lama yang selama ini ditutup di lapisan
--         aplikasi (filter verification_status='approved'), bukan sesuatu yang
--         diperkenalkan migration ini. Konsekuensi nyata: tabel products
--         membuat perubahan produk (termasuk takedown) terlihat real-time oleh
--         setiap sesi yang login.
--         Mitigasi tanpa merusak fitur: monitoring admin tetap lengkap dari
--         activity_logs yang RLS-nya ter-scope admin, sehingga tabel products
--         bisa dikeluarkan dari publication bila ingin mempersempit permukaan
--         Realtime. Itu keputusan operasional; tidak diterapkan di migration ini.
--   - Halaman admin berada di area yang sudah diguard peran, dan server tetap
--     memvalidasi peran admin pada setiap request API.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'activity_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'products') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'warnings') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.warnings;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'reports') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
  END IF;
END
$$;
