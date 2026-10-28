-- ============================================================================
-- Order activity logs + alasan takedown pada log aktivitas produk
--
-- MASALAH yang ditutup (aturan bisnis "Monitoring aktivitas pembeli dan
-- penjual"):
--   activity_logs punya CHECK activity_type yang sudah memuat
--   'order_created' dan 'order_cancelled' sejak 20261001000000, TETAPI
--   audit terhadap SELURUH repo menunjukkan TIDAK ADA satu pun trigger atau
--   INSERT ke activity_logs untuk pesanan. Akibatnya halaman monitoring admin
--   hanya pernah menampilkan aktivitas login dan produk — tidak ada transaksi
--   sama sekali, padahal itulah aktivitas paling kritis untuk pemantauan.
--
--   Jebakan yang mempermudah salah baca: 'order_created' yang sering muncul
--   di codebase adalah TIPE NOTIFICATIONS (lib/server/order-settlement.ts,
--   app/api/checkout/xendit/route.ts), bukan activity_logs. Dua tabel berbeda,
--   tidak saling mengisi.
--
-- KEPUTUSAN DESAIN (penting — dibaca sebelum menjalankan):
--   1. TIDAK ada activity_type baru. 'order_created' / 'order_cancelled'
--      sudah ada di CHECK constraint 20261001000000, jadi migration ini tidak
--      menyentuh constraint apa pun. Tidak ada risiko baris log existing
--      menjadi tidak valid.
--   2. TIDAK ada status produk/pesanan baru. products.verification_status
--      tetap ('pending'|'approved'|'rejected') dan orders.order_status /
--      lifecycle_status / progress_status tidak disentuh sama sekali.
--   3. Tidak ada tabel baru, tidak ada kolom baru, tidak ada backfill.
--   4. Actor diambil server-side (auth.uid() atau fallback buyer_id pada
--      pembuatan pesanan) — UMKM/pembeli tidak bisa memalsukan aktor.
--   5. Metadata TIDAK memuat address_snapshot, catatan pembeli, ideme
--      idempotency, xendit_invoice_id, token, atau kredensial apa pun.
--      Hanya ringkasan order yang aman ditampilkan di panel admin.
--
-- DETEKSI "INI PESANAN ASLI, BUKAN PLACEHOLDER":
--   Jalur checkout keyed (20261008000000) menyisipkan baris placeholder lebih
--   dulu dengan invoice_state='not_started' dan TANPA product_name, lalu
--   mengisinya lewat UPDATE setelah harga/ongkir terhitung. Kalau trigger naif
--   pada AFTER INSERT, placeholder itu akan tercatat sebagai "Pesanan dibuat"
--   padahal invoice-nya belum pernah terbit — data palsu, persis yang
--   dilarang aturan bisnis.
--
--   Karena itu penanda "pesanan nyata" adalah `product_name IS NOT NULL`:
--   - placeholder idempotensi (checkout/xendit route baris ~928) tidak pernah
--     mengirim product_name;
--   - kedua payload final (freeInsertPayload dan insertPayload) SELALU
--     mengirim product_name dari data produk yang sudah divalidasi server.
--   Ditambah penjaga anti-ganda: NOT EXISTS untuk (target_id, activity_type),
--   sehingga satu baris order hanya bisa punya satu log 'order_created'
--   walau trigger terpanggil beberapa kali.
--
-- WAKTU & ZONA WAKTU:
--   created_at memakai DEFAULT now() dari database (server time), sama seperti
--   log aktivitas produk. Tidak ada stempel waktu dari client yang dipercaya.
--
-- Urutan: fungsi dulu, baru trigger, lalu perubahan fungsi log_product_activity.
-- Semua CREATE OR REPLACE + DROP TRIGGER IF EXISTS sehingga rerun aman.
-- JANGAN dijalankan ke Supabase V1 tanpa persetujuan eksplisit owner, dan
-- JANGAN pernah ke V2.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fungsi pencatat aktivitas pesanan (SECURITY DEFINER)
--
-- SECURITY DEFINER diperlukan karena:
--   - INSERT log harus melewati RLS activity_logs_insert_own_or_admin, sedangkan
--     baris pesanan milik buyer, bukan admin. API checkout memakai service_role
--     (auth.uid() NULL), jadi policies itu tidak berlaku baginya.
--   - Trigger berjalan sebagai owner fungsi sehingga selalu bisa menulis log.
--
-- Pattern ini identik dengan log_product_activity (20261010000000) dan
-- notify_on_order_status_change (20261007000006) yang sudah dipakai project.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_order_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid;
  v_source text;
  v_product_name text;
  v_order_code text;
  v_is_real_order boolean;
  v_metadata jsonb;
BEGIN
  -- ---------------------------------------------------------------------
  -- INSERT
  -- ---------------------------------------------------------------------
  IF TG_OP = 'INSERT' THEN
    v_product_name := NEW.product_name;
    v_order_code := NEW.order_code;
    -- Placeholder idempotensi tidak punya product_name -> bukan pesanan nyata.
    IF v_product_name IS NULL THEN
      RETURN NEW;
    END IF;

    -- Penjaga anti-ganda: satu order hanya boleh punya satu log order_created.
    IF EXISTS (
      SELECT 1 FROM public.activity_logs a
       WHERE a.target_type = 'order'
         AND a.target_id = NEW.id
         AND a.activity_type = 'order_created'
    ) THEN
      RETURN NEW;
    END IF;

    -- Aktor: JWT bila ada (jalur authed normal). Checkout memakai service_role
    -- sehingga auth.uid() NULL; fallback ke buyer_id yang SUDAH divalidasi
    -- server dari sesi JWT pemanggil — bukan input klien yang dipercaya.
    v_actor := COALESCE(auth.uid(), NEW.buyer_id);
    v_source := CASE WHEN auth.uid() IS NOT NULL THEN 'auth' ELSE 'buyer_fallback' END;

    v_metadata := jsonb_build_object(
      'auto', true,
      'actor_source', v_source,
      'order_id', NEW.id,
      'order_code', v_order_code,
      'product_id', NEW.product_id,
      'product_name', v_product_name,
      'vendor_name', NEW.vendor_name,
      'quantity', NEW.quantity,
      'unit_price', NEW.unit_price,
      'total_price', NEW.total_price,
      'delivery_option', NEW.delivery_option,
      'order_status', NEW.order_status,
      'payment_status', NEW.payment_status
    );

    INSERT INTO public.activity_logs (user_id, activity_type, description, target_type, target_id, metadata)
    VALUES (
      v_actor,
      'order_created',
      'Pesanan dibuat: ' || COALESCE(NULLIF(btrim(v_order_code), ''), NEW.id::text)
        || ' · ' || COALESCE(v_product_name, '-'),
      'order',
      NEW.id,
      v_metadata
    );
    RETURN NEW;
  END IF;

  -- ---------------------------------------------------------------------
  -- UPDATE
  -- ---------------------------------------------------------------------
  IF TG_OP = 'UPDATE' THEN
    -- (a) Placeholder keyed yang barusan terisi menjadi pesanan nyata.
    IF NEW.product_name IS NOT NULL AND OLD.product_name IS NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.activity_logs a
         WHERE a.target_type = 'order'
           AND a.target_id = NEW.id
           AND a.activity_type = 'order_created'
      ) THEN
        v_actor := COALESCE(auth.uid(), NEW.buyer_id);
        v_source := CASE WHEN auth.uid() IS NOT NULL THEN 'auth' ELSE 'buyer_fallback' END;
        v_order_code := NEW.order_code;

        v_metadata := jsonb_build_object(
          'auto', true,
          'actor_source', v_source,
          'order_id', NEW.id,
          'order_code', v_order_code,
          'product_id', NEW.product_id,
          'product_name', NEW.product_name,
          'vendor_name', NEW.vendor_name,
          'quantity', NEW.quantity,
          'unit_price', NEW.unit_price,
          'total_price', NEW.total_price,
          'delivery_option', NEW.delivery_option,
          'order_status', NEW.order_status,
          'payment_status', NEW.payment_status
        );

        INSERT INTO public.activity_logs (user_id, activity_type, description, target_type, target_id, metadata)
        VALUES (
          v_actor,
          'order_created',
          'Pesanan dibuat: ' || COALESCE(NULLIF(btrim(v_order_code), ''), NEW.id::text)
            || ' · ' || COALESCE(NEW.product_name, '-'),
          'order',
          NEW.id,
          v_metadata
        );
      END IF;
    END IF;

    -- (b) Pembatalan pesanan. Hanya transisi MASUK ke 'cancelled' yang dicatat,
    --     sehingga update lain (progress, status bayar, resi) tidak berisik.
    IF NEW.order_status = 'cancelled' AND OLD.order_status IS DISTINCT FROM 'cancelled' THEN
      -- Aktor pembatal TIDAK boleh diasumsikan = pembeli: bisa seller, admin,
      -- atau webhook. Bila auth.uid() NULL (service_role/webhook) user_id
      -- sengaja dikosongkan dan ditandai 'service_or_system' supaya admin tahu
      -- pelakunya tidak teridentifikasi — lebih jujur daripada mengarang.
      v_actor := auth.uid();
      v_source := CASE WHEN v_actor IS NOT NULL THEN 'auth' ELSE 'service_or_system' END;
      v_order_code := NEW.order_code;

      v_metadata := jsonb_build_object(
        'auto', true,
        'actor_source', v_source,
        'order_id', NEW.id,
        'order_code', v_order_code,
        'product_id', NEW.product_id,
        'product_name', NEW.product_name,
        'vendor_name', NEW.vendor_name,
        'quantity', NEW.quantity,
        'total_price', NEW.total_price,
        'old_order_status', OLD.order_status,
        'new_order_status', NEW.order_status,
        'old_payment_status', OLD.payment_status,
        'new_payment_status', NEW.payment_status
      );

      INSERT INTO public.activity_logs (user_id, activity_type, description, target_type, target_id, metadata)
      VALUES (
        v_actor,
        'order_cancelled',
        'Pesanan dibatalkan: ' || COALESCE(NULLIF(btrim(v_order_code), ''), NEW.id::text),
        'order',
        NEW.id,
        v_metadata
      );
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Trigger pada public.orders
--
-- AFTER (bukan BEFORE) supaya log hanya ditulis bila operasi upstream
-- benar-benar berhasil: bila trigger BEFORE lain (guard P0-B, guard status,
-- guard payment) menolak operasi, fungsi ini tidak pernah dipanggil.
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_orders_activity_insert ON public.orders;
CREATE TRIGGER trg_orders_activity_insert
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_activity();

DROP TRIGGER IF EXISTS trg_orders_activity_update ON public.orders;
CREATE TRIGGER trg_orders_activity_update
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.log_order_activity();

-- ----------------------------------------------------------------------------
-- 3. Alasan takedown ikut masuk ke log aktivitas produk
--
-- recreate log_product_activity() (20261010000000) dengan dua tambahan saja;
--   logika lain, nama fungsi, dan nama trigger TIDAK berubah, sehingga
-- 20261009000000 dan 20261011000000 tetap kompatibel.
--
-- Alasan tambahan:
--   a) metadata.product_updated sekarang memuat `rejection_reason` (dan
--      `reviewed_by`), supaya halaman Monitoring Aktivitas — yang hanya membaca
--      activity_logs — menampilkan alasan takedown tanpa harus membuka drawer.
--      moderation_logs tetap menjadi sumber riwayat resmi per tindakan admin.
--   b) Deskripsi product_updated dibuat eksplisit ketika verification_status
--      berubah, supaya "perubahan status" terbaca jelas di feed admin.
--
-- Kolom reviewed_by hanya berisi UUID admin (profiles.id), bukan kredensial.
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
  v_verification_note text := NULL;
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

    -- Keterangan eksplisit untuk perubahan status moderasi (tunda/aktifkan
    -- kembali). Dipisah dari daftar kolom generik supaya feed admin langsung
    -- menunjukkan tindakan, bukan sekadar "verification_status".
    IF 'verification_status' = ANY (v_changed) THEN
      v_verification_note := 'Status moderasi: '
        || COALESCE(OLD.verification_status, '-')
        || ' -> '
        || COALESCE(NEW.verification_status, '-');
    END IF;

    INSERT INTO public.activity_logs (user_id, activity_type, description, target_type, target_id, metadata)
    VALUES (
      v_actor,
      'product_updated',
      'Produk diperbarui: ' || COALESCE(v_name, '(tanpa nama)')
        || ' (' || array_to_string(v_changed, ', ') || ')'
        || COALESCE(' — ' || v_verification_note, ''),
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
        -- Alasan & pelaku moderasi (kalau ada). UUID admin, bukan kredensial.
        'rejection_reason', NEW.rejection_reason,
        'old_rejection_reason', OLD.rejection_reason,
        'reviewed_by', NEW.reviewed_by,
        'reviewed_at', NEW.reviewed_at,
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

COMMENT ON FUNCTION public.log_order_activity() IS
  'Trigger activity log untuk public.orders (order_created / order_cancelled). Aktor server-side; placeholder idempotensi (product_name NULL) tidak dicatat. Tanpa alamat, token, atau kredensial.';
COMMENT ON FUNCTION public.log_product_activity() IS
  'Trigger activity log untuk public.products. 20261012000000 menambah rejection_reason/reviewed_by/reviewed_at ke metadata serta keterangan eksplisit perubahan status moderasi.';