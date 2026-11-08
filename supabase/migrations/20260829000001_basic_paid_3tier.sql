




INSERT INTO public.plans (slug, name, tagline, price_monthly, price_yearly, max_products, features, is_popular, cta)
VALUES
  ('basic', 'Basic', 'Mulai berjualan, 3 produk, riwayat 30 hari.', 24999, 249990, 3, ARRAY['Maksimal 3 produk','Riwayat penjualan 30 hari','Dashboard penjualan'], false, 'Pilih Basic'),
  ('standar', 'Standar', 'Untuk UMKM yang mulai aktif berjualan di ReBites.', 49000, 490000, 5, ARRAY['Maksimal 5 produk','Riwayat penjualan tanpa batas','Prioritas di marketplace','Laporan penjualan lebih detail','Badge UMKM Terverifikasi'], false, 'Pilih Standar'),
  ('premium', 'Max', 'Akses semua fitur, maksimal 15 produk.', 99000, 990000, 15, ARRAY['Maksimal 15 produk','Akses semua fitur','Promosi unggulan','Analitik permintaan','Dukungan prioritas'], true, 'Pilih Max')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_products = EXCLUDED.max_products,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  cta = EXCLUDED.cta;


UPDATE public.plans SET price_monthly = 24999, price_yearly = 249990, max_products = 3, tagline = 'Mulai berjualan, 3 produk, riwayat 30 hari.', features = ARRAY['Maksimal 3 produk','Riwayat penjualan 30 hari','Dashboard penjualan'], cta = 'Pilih Basic', is_popular = false WHERE slug = 'basic' AND price_monthly = 0;
UPDATE public.plans SET max_products = 5 WHERE slug = 'standar' AND max_products <> 5;
UPDATE public.plans SET max_products = 15 WHERE slug = 'premium' AND max_products <> 15;
