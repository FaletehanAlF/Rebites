-- ============================================================================
-- NOTIF-1: notifikasi laporan kepada PEMILIK TOKO yang dilaporkan
--
-- Temuan (audit NOTIF-1, read-only):
--   Tidak ada satu pun jalur yang memberi tahu pemilik toko ketika laporannya
--   dibuat. Bukti:
--     - `INSERT INTO public.notifications` hanya ada di
--       20261007000006 (review/order) dan 20261010000000 (verifikasi produk +
--       peringatan). Tidak ada untuk `reports`.
--     - Trigger pada public.reports hanya: trg_reports_insert_defaults
--       (BEFORE INSERT, default kolom), trg_reports_resolution_attribution
--       (BEFORE UPDATE), trg_audit_report_resolution (AFTER UPDATE).
--       Tidak ada AFTER INSERT.
--     - 'report_received' hanya ada sebagai nilai activity_logs.activity_type
--       (20261001000000:154); tidak ada kode yang menulis nilai itu.
--     - app/api/reports/route.ts berhenti di `return 201` setelah insert.
--
-- Pemetaan penerima (dibuktikan, bukan diasumsikan):
--   POST /api/reports memanggil hasReportableOrderRelation()
--   (app/api/reports/route.ts:24-84) yang mensyaratkan:
--     - `reported_user_id` memiliki baris di umkm_profiles
--       (`.eq('user_id', reportedUserId)`); tanpa toko -> 400 'no_store';
--     - pelapor punya pesanan pada toko itu (umkm_id atau vendor_slug);
--       tanpa pesanan -> 403 'no_order'.
--   Jadi `NEW.reported_user_id` SELALU pemilik toko yang dilaporkan, bukan
--   pelapor. Trigger di bawah mengirim HANYA ke NEW.reported_user_id.
--
-- Pembatasan isi notifikasi:
--   Pesan TIDAK memuat `description` laporan dan TIDAK menyebut identitas
--   pelapor. Penerima tetap dapat membaca baris laporan lewat RLS yang sudah
--   ada (reports_select_involved_or_admin: auth.uid() = reported_user_id),
--   tetapi notifikasi sendiri tidak menambah kebocoran baru.
--
-- Keamanan:
--   - Fungsi SECURITY DEFINER + search_path=public, mengikuti pola
--     notify_on_warning_issued() / notify_on_order_status_change().
--   - RLS/grants TIDAK diubah. Policy notifications_insert_self (P1-B:148)
--     tetap berlaku untuk client; trigger menulis sebagai owner fungsi.
--   - Tidak ada service-role key di client.
--
-- Best-effort TANPA kehilangan jejak:
--   Kegagalan pembuatan notifikasi tidak boleh menggagalkan pembuatan
--   laporan (bukti moderasi lebih penting). Namun kegagalan TIDAK ditelan
--   diam-diam: RAISE WARNING menyertakan SQLSTATE + pesan sehingga muncul di
--   log PostgreSQL (pola sama dengan guard_orders_update untuk pelepasan
--   stok, 20261007000002:251).
--
--   BATAS DAYA DIAGNOSIS (NOTIF-1C / temuan M-1):
--   RAISE WARNING hanya menulis ke LOG SERVER POSTGRESQL (stderr/log
--   collector). Itu BUKAN sistem log yang dapat dikueri dari aplikasi:
--   retensinya terbatas, tidak ada endpoint yang membacanya, dan tidak ada
--   tabel log trigger di skema ini. Jadi kegagalan di sini TIDAK dapat
--   ditemukan lewat UI admin maupun query biasa — hanya lewat log Postgres.
--   Karena itu laporan yang kehilangan notifikasi harus dicari dengan
--   rekonsiliasi berbasis data, bukan berbasis log.
--
--   QUERY REKONSILIASI — laporan yang seharusnya punya notifikasi tetapi
--   tidak punya. Aman dijalankan kapan saja (read-only, tanpa data pribadi:
--   hanya id + kategori + waktu, tanpa description/identitas pelapor).
--
--     SELECT r.id, r.category, r.created_at
--       FROM public.reports r
--      WHERE r.reported_user_id IS NOT NULL            -- ada penerima
--        AND (r.reported_by IS NULL                    -- bukan laporan diri sendiri
--             OR r.reported_by <> r.reported_user_id)
--        AND NOT EXISTS (
--              SELECT 1
--                FROM public.notifications n
--               WHERE n.user_id = r.reported_user_id
--                 AND n.type = 'report_received'
--                 AND n.reference_id = r.id::text
--            )
--      ORDER BY r.created_at DESC;
--
--   Predikat `reported_user_id IS NOT NULL` + perbandingan `reported_by`
--   mencerminkan persis guard di fungsi trigger, sehingga query tidak
--   melaporkan laporan yang memang sengaja tidak diberi notifikasi.
--   Untuk mempersempit ke jendela waktu tertentu, tambahkan
--   `AND r.created_at >= now() - interval '7 days'`.
--
-- Realtime:
--   public.notifications SUDAH ada di publikasi supabase_realtime
--   (20260824120000_0003:321-322) dan hooks/use-notifications.ts:47-58
--   berlangganan postgres_changes pada tabel itu dengan
--   filter `user_id=eq.${userId}`. Publikasi `reports` saja TIDAK membuat
--   badge toko berubah — yang memperbarui badge adalah INSERT pada
--   notifications, yang dilakukan trigger ini.
--
-- Idempotensi (klaim yang akurat, per bagian):
--   1. Constraint tipe  : dijaga DO-block + perbandingan definisi (H-1).
--                         Aman dijalankan ulang, dan definisi yang salah
--                         dikoreksi. Percobaan ulang setelah kegagalan
--                         parsial tidak menabrak "already exists".
--   2. Fungsi trigger   : CREATE OR REPLACE FUNCTION — selalu idempoten.
--   3. Trigger          : DROP TRIGGER IF EXISTS + CREATE TRIGGER — idempoten.
--   4. REVOKE / COMMENT : idempoten.
--   Yang TIDAK idempoten: tidak ada di file ini. Namun perlu dicatat bahwa
--   langkah 1 dapat GAGAL (bukan tidak idempoten) bila tabel notifications
--   sudah berisi baris dengan `type` di luar 16 nilai di atas — ADD CONSTRAINT
--   memvalidasi seluruh baris. Periksa lebih dulu:
--     SELECT DISTINCT type FROM public.notifications
--      WHERE type NOT IN (<16 nilai>);
--   Hasil kosong = aman diterapkan.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. notifications.type: tambah 'report_received'
--
-- Idempotensi (NOTIF-1C / temuan H-1):
--   Versi sebelumnya hanya `DROP CONSTRAINT IF EXISTS` lalu `ADD CONSTRAINT`
--   tanpa guard. Bila file dijalankan ulang setelah kegagalan parsial (ADD
--   sudah berhasil, langkah berikutnya gagal), percobaan kedua menabrak
--   "constraint already exists" dan seluruh migrasi batal.
--
--   Guard di bawah BUKAN sekadar `IF NOT EXISTS`. Keberadaan constraint saja
--   tidak membuktikan definisinya benar: constraint bisa tertinggal dari
--   versi migrasi lama (mis. tanpa 'product_warning'), atau ada tetapi
--   isinya berbeda. Karena itu:
--     1. `pg_get_constraintdef()` dibaca untuk constraint bernama sama;
--     2. seluruh literal bertanda kutip diekstrak menjadi himpunan nilai;
--     3. himpunan itu dibandingkan dengan daftar 16 tipe yang diharapkan;
--     4. hanya bila BERBEDA (atau constraint belum ada) constraint di-drop
--        lalu dibuat ulang.
--   Hasilnya: percobaan ulang aman, dan definisi yang sudah ada tetapi salah
--   otomatis dikoreksi — bukan dibiarkan.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  -- Daftar tunggal sumber kebenaran: 15 tipe lama + 'report_received'.
  v_expected text[] := ARRAY[
    'order_created','payment_success','order_delivering','order_completed',
    'promo','incoming_order','new_review','subscription_active','subscription_renewed',
    'subscription_expiring','subscription_changed','subscription_expired',
    'product_approved','product_rejected','product_warning',
    'report_received'
  ]::text[];
  v_expected_sorted text[];
  v_existing text[];
  v_def text;
BEGIN
  -- Alias kolom eksplisit `u(t)`: `AS t` saja membuat nama tabel dan kolom
  -- sama, yang benar tetapi mudah disalahbaca saat file ini ditinjau.
  SELECT array_agg(u.t ORDER BY u.t) INTO v_expected_sorted FROM unnest(v_expected) AS u(t);

  SELECT pg_get_constraintdef(c.oid)
    INTO v_def
    FROM pg_constraint c
   WHERE c.conrelid = 'public.notifications'::regclass
     AND c.conname = 'notifications_type_check';

  IF v_def IS NOT NULL THEN
    -- Ambil hanya literal tipe dari definisi, mis.
    --   CHECK ((type = ANY (ARRAY['a'::text, 'b'::text])))
    -- menjadi {a,b}. Pola sengaja dibatasi ke [a-z_]+ agar tidak menangkap
    -- nama kolom/tipe SQL lain.
    SELECT array_agg(m[1] ORDER BY m[1])
      INTO v_existing
      FROM regexp_matches(v_def, '''([a-z_]+)''', 'g') AS m;
  END IF;

  -- IS DISTINCT FROM menangani NULL: constraint tidak ada -> v_existing NULL
  -- -> berbeda dari daftar -> dibuat.
  IF v_existing IS DISTINCT FROM v_expected_sorted THEN
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_type_check
      CHECK (type IN (
        'order_created','payment_success','order_delivering','order_completed',
        'promo','incoming_order','new_review','subscription_active','subscription_renewed',
        'subscription_expiring','subscription_changed','subscription_expired',
        'product_approved','product_rejected','product_warning',
        'report_received'
      ));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. reports -> notifications (pemilik toko yang dilaporkan)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_report_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category_label text;
  v_sqlstate text;
  v_message text;
BEGIN
  -- Tanpa penerima yang teridentifikasi tidak ada yang bisa diberi tahu.
  -- (reported_user_id NULL bila profil sudah dihapus: FK ON DELETE SET NULL.)
  IF NEW.reported_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Laporan atas diri sendiri ditolak API, tetapi jaga di level trigger juga.
  IF NEW.reported_by IS NOT NULL AND NEW.reported_by = NEW.reported_user_id THEN
    RETURN NEW;
  END IF;

  v_category_label := CASE NEW.category
    WHEN 'harassment' THEN 'pelecehan'
    WHEN 'spam' THEN 'spam'
    WHEN 'fraud' THEN 'penipuan'
    WHEN 'inappropriate_content' THEN 'konten tidak pantas'
    WHEN 'other' THEN 'lainnya'
    ELSE COALESCE(NEW.category, 'lainnya')
  END;

  BEGIN
    -- Idempoten terhadap pemanggilan ulang trigger untuk baris yang sama.
    PERFORM 1
      FROM public.notifications
     WHERE user_id = NEW.reported_user_id
       AND type = 'report_received'
       AND reference_id = NEW.id::text;
    IF FOUND THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.notifications (user_id, role, type, title, message, reference_id, href)
    VALUES (
      NEW.reported_user_id,
      'seller',
      'report_received',
      'Laporan Baru untuk Toko Anda',
      'Ada laporan baru dengan kategori ' || v_category_label ||
        '. Tim ReBites akan meninjaunya. Pastikan informasi toko dan pesanan Anda akurat.',
      NEW.id::text,
      '/dashboard/penjual/notifikasi'
    );
  EXCEPTION WHEN OTHERS THEN
    -- Best-effort: laporan tetap tersimpan, tetapi kegagalan WAJIB terlihat
    -- di log server agar dapat didiagnosis (bukan hilang diam-diam).
    GET STACKED DIAGNOSTICS v_sqlstate = RETURNED_SQLSTATE,
                            v_message  = MESSAGE_TEXT;
    RAISE WARNING
      'notify_on_report_created: gagal membuat notifikasi untuk report % (user %, sqlstate %, pesan: %)',
      NEW.id, NEW.reported_user_id, v_sqlstate, v_message;
  END;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_on_report_created() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reports_notify_store ON public.reports;
CREATE TRIGGER trg_reports_notify_store
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_report_created();

COMMENT ON FUNCTION public.notify_on_report_created() IS
  'NOTIF-1: memberi tahu pemilik toko (reports.reported_user_id) saat laporan dibuat. Best-effort: kegagalan dicatat via RAISE WARNING, tidak menggagalkan INSERT reports.';
