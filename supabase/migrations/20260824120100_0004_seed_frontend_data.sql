
















INSERT INTO public.plans (slug, name, tagline, price_monthly, price_yearly, max_products, features, is_popular, cta)
VALUES
  ('basic', 'Basic',
   'Mulai jualan di ReBites tanpa biaya, selamanya.',
   0, 0, 5,
   ARRAY['Gratis tanpa biaya langganan','Maksimal 5 produk','Riwayat penjualan 30 hari','Dashboard penjualan'],
   false, 'Mulai Jual'),
  ('standar', 'Standar',
   'Untuk UMKM yang mulai aktif berjualan di ReBites.',
   49000, 490000, 25,
   ARRAY['Maksimal 25 produk','Riwayat penjualan tanpa batas','Prioritas di marketplace','Laporan penjualan detail','Badge UMKM Terverifikasi'],
   true, 'Pilih Standar'),
  ('premium', 'Max',
   'Untuk usaha yang ingin berkembang lebih jauh.',
   99000, 990000, 999999,
   ARRAY['Produk tanpa batas','Semua fitur Standar','Promosi unggulan','Analitik permintaan','Dukungan prioritas'],
   false, 'Pilih Premium')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  max_products = EXCLUDED.max_products,
  features = EXCLUDED.features,
  is_popular = EXCLUDED.is_popular,
  cta = EXCLUDED.cta;




INSERT INTO public.umkm_profiles (
  user_id, slug, business_name, description, category, address,
  logo_url, is_verified, rating, distance_km, is_rescue_partner, open_hours,
  is_open, tagline, owner_name, partner_tier, followers, member_since,
  response_time, porsi_terselamatkan, co2e_saved_kg
)
VALUES
  (NULL, 'warung-nusantara',
   'Warung Nusantara',
   'Warung rumahan dengan masakan nusantara otentik. Dari nasi goreng sampai rendang, semua dimasak fresh setiap hari.',
   'Makanan Berat', 'Jl. Margonda Raya No. 45, Beji, Kota Depok',
   'https://images.pexels.com/photos/37193132/pexels-photo-37193132.jpeg?auto=compress&cs=tinysrgb&w=800',
   true, 4.8, 0.8, true, '09.00–21.00',
   true, 'Masakan nusantara otentik, dimasak fresh setiap hari.', NULL,
   'UMKM Partner – Level 3', 156, 2023, '≈ 5 menit', 212, 96),
  (NULL, 'dapur-ibu-tini',
   'Dapur Ibu Tini',
   'Dapur rumahan spesialis kudapan pasar buatan sendiri, dari martabak dan pancong hangat sampai ketoprak dan salad buah segar.',
   'Makanan Berat', 'Jl. Nusantara Raya No. 22, Sukmajaya, Kota Depok',
   'https://images.pexels.com/photos/30294334/pexels-photo-30294334.jpeg?auto=compress&cs=tinysrgb&w=800',
   false, 4.7, 1.1, false, '10.00–20.00',
   true, 'Kudapan pasar buatan sendiri, hangat dan hemat.', 'Tini Rahayu',
   'UMKM Partner – Level 2', 98, 2024, '≈ 8 menit', 134, 58),
  (NULL, 'warkop-pak-iman',
   'Warkop Pak Iman',
   'Warkop favorit anak Depok untuk sarapan dan nongkrong. Bakso hangat, roti bakar, dan kopi susu gula aren jadi andalan.',
   'Makanan & Minuman', 'Jl. Juanda Raya No. 8, Cimanggis, Kota Depok',
   'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=800',
   true, 4.9, 0.6, true, '06.30–22.00',
   true, 'Sarapan dan nongkrong favorit anak Bogor.', NULL,
   'UMKM Partner – Level 3', 187, 2022, '≈ 4 menit', 305, 142)
ON CONFLICT (slug) DO NOTHING;





INSERT INTO public.products (
  umkm_id, slug, name, description, category,
  original_price, surplus_price, discount_percent, stock, stock_label,
  status, image_url, rating, distance_km,
  sell_window_start, sell_window_end, expires_at
)
VALUES
  ((SELECT id FROM public.umkm_profiles WHERE slug='warung-nusantara'), 'geprek-sambal-bawang', 'Geprek Sambal Bawang', '', 'Makanan Berat', 35000, 17500, 50, 5,  '5 porsi tersisa',  'available', '/makanan1.jpeg',  4.8, 0.8, '17:00', '20:00', now() + interval '3 hours'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warkop-pak-iman'),   'nasi-goreng-gila',    'Nasi Goreng Gila',    '', 'Makanan Berat', 30000, 15000, 50, 4,  '4 paket tersisa',  'available', '/makanan2.jpeg',  4.9, 0.4, '07:00', '12:00', NULL),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warung-nusantara'), 'soto-mie-bogor',      'Soto Mie Bogor',      '', 'Makanan Berat', 28000, 16800, 40, 6,  '6 porsi tersisa',  'available', '/makanan3.jpeg',  4.7, 1.5, '11:00', '14:00', now() + interval '2 hours'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warung-nusantara'), 'sate-ayam-10-pcs',    'Sate Ayam 10 Pcs',    '', 'Makanan Berat', 25000, 12500, 50, 8,  '8 box tersisa',    'available', '/makanan4.jpeg',  4.6, 1.2, '08:00', '13:00', NULL),
  ((SELECT id FROM public.umkm_profiles WHERE slug='dapur-ibu-tini'),   'salad-segar-kebun',   'Salad Segar Kebun',   '', 'Buah & Sayur',  24000, 14400, 40, 6,  '6 mangkuk tersisa','available', '/makanan5.jpeg',  4.5, 2.0, '09:00', '15:00', now() + interval '5 hours'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='dapur-ibu-tini'),   'pancong-lumer-coklat-keju', 'Pancong Lumer Coklat Keju', '', 'Jajanan', 22000, 11000, 50, 3, '3 porsi tersisa', 'available', '/makanan6.jpeg', 4.7, 1.1, '12:00', '17:00', NULL),
  ((SELECT id FROM public.umkm_profiles WHERE slug='dapur-ibu-tini'),   'martabak-coklat-kacang', 'Martabak Coklat Kacang', '', 'Jajanan', 45000, 27000, 40, 5, '5 porsi tersisa', 'available', '/makanan7.jpg', 4.8, 2.3, '18:00', '21:00', NULL),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warkop-pak-iman'),   'bakso-komplit',       'Bakso Komplit',       '', 'Makanan Berat', 20000, 10000, 50, 2,  '2 porsi tersisa',  'available', '/makanan8.webp',  4.9, 0.6, '06:30', '11:00', now() + interval '4 hours'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='dapur-ibu-tini'),   'ketoprak-telor',      'Ketoprak Telor',      '', 'Makanan Berat', 18000, 9000,  50, 12, '12 porsi tersisa', 'available', '/makanan9.webp',  4.6, 0.9, '13:00', '16:00', NULL),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warkop-pak-iman'),   'mie-ayam',            'Mie Ayam',            '', 'Makanan Berat', 42000, 25200, 40, 4,  '4 porsi tersisa',  'available', '/makanan10.webp', 4.7, 2.5, '17:30', '20:30', NULL),
  ((SELECT id FROM public.umkm_profiles WHERE slug='dapur-ibu-tini'),   'nasi-katsu',          'Nasi Katsu',          '', 'Japanese',      35000, 18000, 49, 3,  '3 set tersisa',    'available', '/makanan11.jpg',  4.9, 1.8, '11:30', '20:00', now() + interval '2 hours'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='dapur-ibu-tini'),   'paket-burger',        'Paket Burger Hemat',  '', 'Makanan Cepat Saji', 50000, 35000, 18, 5, '5 pcs tersisa',   'available', '/makanan12.jpg',  4.8, 0.5, '08:00', '16:00', NULL),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warung-nusantara'), 'gado-gado',           'Gado Gado + Lontong', '', 'Makanan Berat', 50000, 30000, 40, 4,  '4 paket tersisa',  'available', '/makanan13.jpg',  4.7, 1.0, '10:00', '22:00', now() + interval '3 hours'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='dapur-ibu-tini'),   '/makanan14.jpg',      'Roti Kopi',           '', 'Roti & Kue',    38000, 19000, 50, 2,  '2 slice tersisa',  'available', '/makanan14.jpg',  4.9, 1.4, '12:00', '19:00', NULL),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warkop-pak-iman'),   'iced-matcha-latte',   'Iced Matcha Latte',   '', 'Minuman',       25000, 15000, 40, 10, '10 cup tersisa',   'available', '/makanan15.jpg',  4.8, 0.7, '09:00', '21:00', NULL)
ON CONFLICT (slug) DO NOTHING;




INSERT INTO public.products (
  umkm_id, slug, name, description, category,
  original_price, surplus_price, discount_percent, stock, stock_label,
  status, image_url, rating, distance_km,
  sell_window_start, sell_window_end, expires_at, slot
)
VALUES
  ((SELECT id FROM public.umkm_profiles WHERE slug='warung-nusantara'), 'urgent-geprek-sambal-bawang',        'Geprek Sambal Bawang',    '', 'Makanan Berat', 38000, 19000, 50, 2,  '2 porsi tersisa', 'available', '/makanan1.jpeg',  4.8, 0.8, '17:00', '20:00', now() + interval '45 minutes', '15-18'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warkop-pak-iman'),   'urgent-nasi-goreng-gila',            'Nasi Goreng Gila',        '', 'Makanan Berat', 30000, 15000, 50, 4,  '4 porsi tersisa', 'available', '/makanan2.jpeg',  4.9, 0.4, '07:00', '12:00', now() + interval '75 minutes', '09-12'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='dapur-ibu-tini'),   'urgent-ketoprak-telor',               'Ketoprak Telor',          '', 'Makanan Berat', 18000, 9000,  50, 12, '12 porsi tersisa','available', '/makanan9.webp',  4.6, 0.9, '13:00', '16:00', now() + interval '2 hours',   '12-15'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='dapur-ibu-tini'),   'urgent-martabak-coklat-kacang',       'Martabak Coklat Kacang',  '', 'Jajanan',       45000, 27000, 40, 3,  '3 porsi tersisa', 'available', '/makanan7.jpg',   4.8, 2.3, '18:00', '21:00', now() + interval '3 hours',   '18-21'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warung-nusantara'), 'urgent-10-pcs-sate-ayam',             '10 Pcs Sate Ayam',        '', 'Makanan Berat', 40000, 25000, 37, 5,  '5 box tersisa',   'available', '/makanan4.jpeg',  4.6, 1.2, '08:00', '13:00', now() + interval '4 hours',   '09-12'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warung-nusantara'), 'urgent-rendang-bumbu-spesial',        'Rendang Bumbu Spesial',   '', 'Makanan Berat', 24000, 14400, 40, 4,  '4 porsi tersisa', 'available', '/makanan5.jpeg',  4.5, 2.0, '09:00', '15:00', now() + interval '5 hours',   '12-15'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warkop-pak-iman'),   'urgent-bakso-komplit-nikmat',         'Bakso Komplit Nikmat',    '', 'Makanan Berat', 21000, 18000, 20, 3,  '3 paket tersisa', 'available', '/makanan8.webp',  4.9, 0.6, '06:30', '11:00', now() + interval '135 minutes','09-12'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warung-nusantara'), 'urgent-soto-mie-bogor',               'Soto Mie Bogor',          '', 'Makanan Berat', 25000, 15000, 40, 4,  '4 porsi tersisa', 'available', '/makanan3.jpeg',  4.7, 0.8, '06:00', '10:30', now() + interval '90 minutes', '09-12'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='dapur-ibu-tini'),   'urgent-pancong-lumer-coklat-keju',    'Pancong Lumer Coklat Keju','','Jajanan',     28000, 15000, 46, 5,  '5 porsi tersisa', 'available', '/makanan6.jpeg',  4.7, 1.1, '11:00', '14:00', now() + interval '150 minutes','12-15'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warkop-pak-iman'),   'urgent-mie-ayam',                     'Mie Ayam',                '', 'Makanan Berat', 22000, 12000, 45, 4,  '4 porsi tersisa', 'available', '/makanan10.webp', 4.7, 2.5, '17:30', '20:30', now() + interval '1 hour',    '15-18'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warung-nusantara'), 'urgent-10-pcs-sate-ayam-2',           '10 Pcs Sate Ayam',        '', 'Makanan Berat', 40000, 25000, 37, 6,  '6 pcs tersisa',   'available', '/makanan4.jpeg',  4.6, 1.2, '15:00', '18:00', now() + interval '2 hours',   '15-18'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warung-nusantara'), 'urgent-geprek-sambal-bawang-malam',   'Geprek Sambal Bawang',    '', 'Makanan Berat', 38000, 19000, 50, 3,  '3 porsi tersisa', 'available', '/makanan1.jpeg',  4.8, 0.8, '18:00', '21:00', now() + interval '105 minutes','18-21'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='dapur-ibu-tini'),   'urgent-ketoprak-telor-malam',         'Ketoprak Telor',          '', 'Makanan Berat', 25000, 16000, 36, 10, '10 porsi tersisa','available', '/makanan9.webp',  4.6, 0.9, '18:00', '21:00', now() + interval '165 minutes','18-21')
ON CONFLICT (slug) DO NOTHING;




INSERT INTO public.promo_codes (code, percent_off, is_valid)
VALUES ('REBITES26', 5, true)
ON CONFLICT (code) DO UPDATE SET percent_off = EXCLUDED.percent_off, is_valid = EXCLUDED.is_valid;
