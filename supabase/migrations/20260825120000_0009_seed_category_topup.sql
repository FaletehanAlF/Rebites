

















INSERT INTO public.products (
  umkm_id, slug, name, description, category,
  original_price, surplus_price, discount_percent, stock, stock_label,
  status, image_url, rating, distance_km,
  sell_window_start, sell_window_end, expires_at
)
VALUES
  
  ((SELECT id FROM public.umkm_profiles WHERE slug='dapur-ibu-tini'), 'cheesecake-blueberry-slice', 'Cheesecake Blueberry Slice', 'Cheesecake lembut dengan topping blueberry dan raspberry segar.', 'Dessert', 32000, 19200, 40, 4, '4 slice tersisa', 'available', 'https://images.pexels.com/photos/1126359/pexels-photo-1126359.jpeg?auto=compress&cs=tinysrgb&w=800', 4.8, 1.6, '11:00', '19:00', NULL),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warkop-pak-iman'), 'slice-coklat-lumer', 'Slice Coklat Lumer', 'Slice coklat lumer dengan lapisan ganache pekat.', 'Dessert', 25000, 12500, 50, 6, '6 slice tersisa', 'available', 'https://images.pexels.com/photos/291528/pexels-photo-291528.jpeg?auto=compress&cs=tinysrgb&w=800', 4.8, 1.2, '10:00', '18:00', now() + interval '4 hours'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warung-nusantara'), 'es-krim-cup-2-scoop', 'Es Krim Cup 2 Scoop', 'Dua scoop es krim dengan taburan meses dan cone renyah.', 'Dessert', 20000, 10000, 50, 8, '8 cup tersisa', 'available', 'https://images.pexels.com/photos/1362534/pexels-photo-1362534.jpeg?auto=compress&cs=tinysrgb&w=800', 4.7, 1.9, '10:00', '20:00', now() + interval '3 hours'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='dapur-ibu-tini'), 'strawberry-shortcake-slice', 'Strawberry Shortcake Slice', 'Shortcake lembut dengan krim segar dan strawberry utuh.', 'Dessert', 28000, 16800, 40, 3, '3 slice tersisa', 'available', 'https://images.pexels.com/photos/2144112/pexels-photo-2144112.jpeg?auto=compress&cs=tinysrgb&w=800', 4.9, 0.9, '11:00', '17:00', NULL),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warkop-pak-iman'), 'bolu-buah-segar', 'Bolu Buah Segar', 'Bolu sponge lembut dengan krim dan potongan buah musim.', 'Dessert', 45000, 27000, 40, 4, '4 potong tersisa', 'available', 'https://images.pexels.com/photos/140831/pexels-photo-140831.jpeg?auto=compress&cs=tinysrgb&w=800', 4.6, 2.1, '09:00', '16:00', now() + interval '5 hours'),
  
  ((SELECT id FROM public.umkm_profiles WHERE slug='warkop-pak-iman'), 'ramen-miso-ayam', 'Ramen Miso Ayam', 'Ramen kuah miso dengan ayam, telur, dan sayuran hangat.', 'Japanese', 35000, 21000, 40, 5, '5 porsi tersisa', 'available', 'https://images.pexels.com/photos/884600/pexels-photo-884600.jpeg?auto=compress&cs=tinysrgb&w=800', 4.9, 0.6, '11:00', '21:00', now() + interval '3 hours'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warung-nusantara'), 'sushi-roll-set-8', 'Sushi Roll Set 8 Pcs', 'Delapan potong sushi roll isi timun, wortel, dan tamago.', 'Japanese', 38000, 19000, 50, 6, '6 set tersisa', 'available', 'https://images.pexels.com/photos/357756/pexels-photo-357756.jpeg?auto=compress&cs=tinysrgb&w=800', 4.8, 1.4, '11:00', '20:00', NULL),
  ((SELECT id FROM public.umkm_profiles WHERE slug='dapur-ibu-tini'), 'sushi-salmon-set', 'Sushi Salmon Set', 'Set sushi dan sashimi salmon dengan wasabi serta gari.', 'Japanese', 55000, 33000, 40, 3, '3 set tersisa', 'available', 'https://images.pexels.com/photos/2098085/pexels-photo-2098085.jpeg?auto=compress&cs=tinysrgb&w=800', 4.9, 1.4, '12:00', '20:00', now() + interval '2 hours'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warkop-pak-iman'), 'yaki-udon-seafood', 'Yaki Udon Seafood', 'Udon tumis seafood dengan saus gurih dan taburan nori.', 'Japanese', 32000, 19200, 40, 4, '4 porsi tersisa', 'available', 'https://images.pexels.com/photos/2092906/pexels-photo-2092906.jpeg?auto=compress&cs=tinysrgb&w=800', 4.7, 0.7, '11:00', '21:00', NULL),
  
  ((SELECT id FROM public.umkm_profiles WHERE slug='warung-nusantara'), 'roti-gandum-bakehouse', 'Roti Gandum Bakehouse', 'Roti gandum panggang utuh, cocok untuk sarapan sehat.', 'Roti & Kue', 22000, 11000, 50, 10, '10 loaf tersisa', 'available', 'https://images.pexels.com/photos/1775043/pexels-photo-1775043.jpeg?auto=compress&cs=tinysrgb&w=800', 4.7, 1.1, '07:00', '12:00', now() + interval '5 hours'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='dapur-ibu-tini'), 'roti-baguette-butter', 'Roti Baguette Butter', 'Baguette renyah dengan aroma butter, dipanggang pagi ini.', 'Roti & Kue', 25000, 15000, 40, 7, '7 pcs tersisa', 'available', 'https://images.pexels.com/photos/1387070/pexels-photo-1387070.jpeg?auto=compress&cs=tinysrgb&w=800', 4.6, 1.1, '07:00', '13:00', NULL),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warkop-pak-iman'), 'brownies-fudge-panggang', 'Brownies Fudge Panggang', 'Brownies fudge legit dengan kacang almond dan walnut.', 'Roti & Kue', 30000, 18000, 40, 6, '6 box tersisa', 'available', 'https://images.pexels.com/photos/2373520/pexels-photo-2373520.jpeg?auto=compress&cs=tinysrgb&w=800', 4.9, 2.2, '09:00', '20:00', NULL),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warung-nusantara'), 'cupcake-raspberry', 'Cupcake Raspberry', 'Cupcake butter cream dengan raspberry segar di atasnya.', 'Roti & Kue', 18000, 9000, 50, 9, '9 pcs tersisa', 'available', 'https://images.pexels.com/photos/1055272/pexels-photo-1055272.jpeg?auto=compress&cs=tinysrgb&w=800', 4.8, 1.1, '10:00', '18:00', NULL),
  
  ((SELECT id FROM public.umkm_profiles WHERE slug='dapur-ibu-tini'), 'french-fries-jumbo', 'French Fries Jumbo', 'Kentang goreng jumbo renyah dengan saus sambal pendamping.', 'Makanan Cepat Saji', 20000, 12000, 40, 12, '12 porsi tersisa', 'available', 'https://images.pexels.com/photos/1583884/pexels-photo-1583884.jpeg?auto=compress&cs=tinysrgb&w=800', 4.5, 0.5, '10:00', '21:00', NULL),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warkop-pak-iman'), 'pizza-slice-pepperoni', 'Pizza Slice Pepperoni', 'Slice pizza pepperoni dengan keju melebar, dipanaskan ulang.', 'Makanan Cepat Saji', 28000, 16800, 40, 6, '6 slice tersisa', 'available', 'https://images.pexels.com/photos/4109111/pexels-photo-4109111.jpeg?auto=compress&cs=tinysrgb&w=800', 4.8, 0.8, '11:00', '21:00', now() + interval '3 hours'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warung-nusantara'), 'burger-keju-sapi', 'Burger Keju Sapi', 'Burger sapi dengan keju leleh, tomat, dan selada segar.', 'Makanan Cepat Saji', 32000, 16000, 50, 5, '5 pcs tersisa', 'available', 'https://images.pexels.com/photos/1633578/pexels-photo-1633578.jpeg?auto=compress&cs=tinysrgb&w=800', 4.7, 0.5, '10:00', '20:00', NULL),
  ((SELECT id FROM public.umkm_profiles WHERE slug='dapur-ibu-tini'), 'paket-komplit-burger-fries', 'Paket Komplit Burger + Fries', 'Burger plus french fries dan saus, cukup untuk makan kenyang.', 'Makanan Cepat Saji', 42000, 25200, 40, 4, '4 paket tersisa', 'available', 'https://images.pexels.com/photos/2983101/pexels-photo-2983101.jpeg?auto=compress&cs=tinysrgb&w=800', 4.8, 0.5, '10:00', '20:00', now() + interval '2 hours'),
  
  ((SELECT id FROM public.umkm_profiles WHERE slug='warkop-pak-iman'), 'buah-potong-campur', 'Buah Potong Campur Box', 'Box buah potong campur: semangka, melon, anggur, dan pepaya.', 'Buah & Sayur', 18000, 10800, 40, 7, '7 box tersisa', 'available', 'https://images.pexels.com/photos/1132047/pexels-photo-1132047.jpeg?auto=compress&cs=tinysrgb&w=800', 4.7, 0.6, '08:00', '15:00', now() + interval '5 hours'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warung-nusantara'), 'semangka-potong-dingin', 'Semangka Potong Dingin', 'Semangka potong segar, disimpan dingin dan siap makan.', 'Buah & Sayur', 14000, 8400, 40, 9, '9 box tersisa', 'available', 'https://images.pexels.com/photos/5946081/pexels-photo-5946081.jpeg?auto=compress&cs=tinysrgb&w=800', 4.6, 0.6, '10:00', '17:00', now() + interval '4 hours'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='dapur-ibu-tini'), 'paket-sayur-sup-segar', 'Paket Sayur Sup Segar', 'Paket sayur segar untuk sup: brokoli, wortel, dan sawi.', 'Buah & Sayur', 15000, 9000, 40, 10, '10 paket tersisa', 'available', 'https://images.pexels.com/photos/1300972/pexels-photo-1300972.jpeg?auto=compress&cs=tinysrgb&w=800', 4.5, 1.3, '06:00', '12:00', NULL),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warkop-pak-iman'), 'pisang-cavendish-1kg', 'Pisang Cavendish 1 Kg', 'Pisang cavendish matang manis, cocok untuk sarapan atau jus.', 'Buah & Sayur', 24000, 14400, 40, 8, '8 kg tersisa', 'available', 'https://images.pexels.com/photos/2316466/pexels-photo-2316466.jpeg?auto=compress&cs=tinysrgb&w=800', 4.6, 1.3, '08:00', '14:00', NULL),
  
  ((SELECT id FROM public.umkm_profiles WHERE slug='warung-nusantara'), 'kopi-susu-gula-aren', 'Kopi Susu Gula Aren', 'Kopi susu dengan gula aren asli, diseduh fresh hari ini.', 'Minuman', 18000, 9000, 50, 15, '15 cup tersisa', 'available', 'https://images.pexels.com/photos/1193335/pexels-photo-1193335.jpeg?auto=compress&cs=tinysrgb&w=800', 4.9, 0.6, '07:00', '21:00', NULL),
  ((SELECT id FROM public.umkm_profiles WHERE slug='dapur-ibu-tini'), 'jus-jeruk-peras', 'Jus Jeruk Peras', 'Jus jeruk peras murni tanpa gula tambahan, dingin menyegarkan.', 'Minuman', 15000, 9000, 40, 10, '10 cup tersisa', 'available', 'https://images.pexels.com/photos/96974/pexels-photo-96974.jpeg?auto=compress&cs=tinysrgb&w=800', 4.6, 1.1, '09:00', '18:00', NULL),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warkop-pak-iman'), 'cappuccino-classic', 'Cappuccino Classic', 'Cappuccino klasik dengan latte art dari barista warkop.', 'Minuman', 20000, 10000, 50, 8, '8 cup tersisa', 'available', 'https://images.pexels.com/photos/312418/pexels-photo-312418.jpeg?auto=compress&cs=tinysrgb&w=800', 4.8, 0.6, '07:00', '20:00', NULL),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warung-nusantara'), 'es-lemon-madu', 'Es Lemon Madu', 'Es lemon dengan madu alami dan daun mint segar.', 'Minuman', 12000, 7200, 40, 12, '12 cup tersisa', 'available', 'https://images.pexels.com/photos/2109099/pexels-photo-2109099.jpeg?auto=compress&cs=tinysrgb&w=800', 4.7, 0.6, '10:00', '20:00', now() + interval '3 hours'),
  
  ((SELECT id FROM public.umkm_profiles WHERE slug='dapur-ibu-tini'), 'waffle-mini-nutella', 'Waffle Mini Nutella', 'Waffle mini dengan topping nutella lumer dan gula bubur.', 'Jajanan', 16000, 8000, 50, 6, '6 porsi tersisa', 'available', 'https://images.pexels.com/photos/789327/pexels-photo-789327.jpeg?auto=compress&cs=tinysrgb&w=800', 4.8, 1.1, '12:00', '18:00', now() + interval '2 hours'),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warkop-pak-iman'), 'poffertjes-mini-berry', 'Poffertjes Mini Berry', 'Poffertjes mini lembut dengan krim, strawberry, dan saus berry.', 'Jajanan', 15000, 9000, 40, 7, '7 porsi tersisa', 'available', 'https://images.pexels.com/photos/376464/pexels-photo-376464.jpeg?auto=compress&cs=tinysrgb&w=800', 4.7, 0.6, '12:00', '17:00', NULL),
  ((SELECT id FROM public.umkm_profiles WHERE slug='warung-nusantara'), 'ubi-goreng-saus-sambal', 'Ubi Goreng Saus Sambal', 'Ubi goreng renyah dengan saus sambal pedas manis.', 'Jajanan', 13000, 7800, 40, 8, '8 porsi tersisa', 'available', 'https://images.pexels.com/photos/1893556/pexels-photo-1893556.jpeg?auto=compress&cs=tinysrgb&w=800', 4.6, 0.8, '14:00', '19:00', now() + interval '3 hours')
ON CONFLICT (slug) DO NOTHING;
