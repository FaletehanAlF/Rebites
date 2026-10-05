-- ============================================================================
-- 7B-1: Address & Location Foundation (buyer + seller origin)
-- SCOPE:
--   - addresses: + postal_code, latitude, longitude (nullable, legacy aman)
--   - umkm_profiles: + postal_code, phone (latitude/longitude SUDAH ADA,
--     jangan duplikat; hanya tambah CHECK + kolom yang belum ada)
-- PRINSIP:
--   - additive, tidak menghapus kolom/data lama
--   - semua kolom baru NULLABLE (data legacy tetap valid)
--   - tidak mengisi data palsu, tidak geocoding
--   - tidak menyentuh flow payment/shipment/tracking
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. BUYER ADDRESSES: + postal_code / latitude / longitude
-- ----------------------------------------------------------------------------
ALTER TABLE public.addresses
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- Validasi dasar level DB (NULL tetap boleh untuk data legacy):
-- - postal_code Indonesia: 5 digit, string kosong TIDAK valid
-- - latitude: -90..90, longitude: -180..180
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'addresses_postal_code_format'
  ) THEN
    ALTER TABLE public.addresses
      ADD CONSTRAINT addresses_postal_code_format
      CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{5}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'addresses_latitude_range'
  ) THEN
    ALTER TABLE public.addresses
      ADD CONSTRAINT addresses_latitude_range
      CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'addresses_longitude_range'
  ) THEN
    ALTER TABLE public.addresses
      ADD CONSTRAINT addresses_longitude_range
      CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  END IF;
END
$$;

COMMENT ON COLUMN public.addresses.postal_code IS '7B-1: kode pos Indonesia 5 digit, NULL untuk alamat legacy. Tidak ada geocoding otomatis.';
COMMENT ON COLUMN public.addresses.latitude IS '7B-1: NULL hingga ada map-picker/geocoding. Jangan isi palsu.';
COMMENT ON COLUMN public.addresses.longitude IS '7B-1: NULL hingga ada map-picker/geocoding. Jangan isi palsu.';

-- ----------------------------------------------------------------------------
-- 2. SELLER / UMKM ORIGIN: + postal_code, + phone
--    latitude/longitude SUDAH ADA (0001) -> JANGAN buat duplikat.
-- ----------------------------------------------------------------------------
ALTER TABLE public.umkm_profiles
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS phone text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'umkm_postal_code_format'
  ) THEN
    ALTER TABLE public.umkm_profiles
      ADD CONSTRAINT umkm_postal_code_format
      CHECK (postal_code IS NULL OR postal_code ~ '^[0-9]{5}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'umkm_latitude_range'
  ) THEN
    ALTER TABLE public.umkm_profiles
      ADD CONSTRAINT umkm_latitude_range
      CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'umkm_longitude_range'
  ) THEN
    ALTER TABLE public.umkm_profiles
      ADD CONSTRAINT umkm_longitude_range
      CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  END IF;
END
$$;

COMMENT ON COLUMN public.umkm_profiles.postal_code IS '7B-1: kode pos origin toko, NULL untuk data legacy.';
COMMENT ON COLUMN public.umkm_profiles.phone IS '7B-1: telepon toko untuk kontak kurir origin, NULL jika belum diisi.';
COMMENT ON COLUMN public.umkm_profiles.latitude IS '7B-1: gunakan kolom existing ini, NULL hingga diisi manual/terverifikasi.';
COMMENT ON COLUMN public.umkm_profiles.longitude IS '7B-1: gunakan kolom existing ini, NULL hingga diisi manual/terverifikasi.';

-- ----------------------------------------------------------------------------
-- 3. RLS: tidak ada perubahan policy (table-level, kolom baru otomatis ikut).
--    - addresses: addresses_all_own (hanya milik sendiri) tetap berlaku.
--    - umkm_profiles: select public + insert/update own_or_admin tetap berlaku.
--    - Jangan membuka lokasi buyer ke public.
-- ----------------------------------------------------------------------------
-- (Sengaja tidak ada CREATE POLICY baru.)
