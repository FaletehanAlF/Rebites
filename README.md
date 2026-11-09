# ReBites: Marketplace Makanan Surplus dari UMKM

ReBites mempertemukan UMKM kuliner di Kota Depok dengan pembeli yang mencari makanan
layak konsumsi berharga lebih murah. Penjual mengunggah sisa menu hari itu beserta
harga, stok, dan jam jualnya. Pembeli memesan untuk diantar ke alamat atau diambil
sendiri di toko. Setiap porsi yang terjual mengurangi makanan yang berakhir di tempat
sampah, dan penjual mendapat pemasukan dari stok yang biasanya tidak terjual.

Aplikasi ini dibangun untuk Garda Tech National Innovation Competition (GTNIC) 2026,
kategori Web Development.

## Masalah yang diselesaikan

Warung dan usaha kuliner menyiapkan makanan berdasarkan perkiraan permintaan. Ketika
pembeli lebih sedikit dari perkiraan, sisa makanan pada akhir hari tidak lagi dijual
meski masih layak dikonsumsi. Pemilik usaha menanggung biaya bahan dan tenaga kerjanya,
sementara pembeli kehilangan pilihan makanan berkualitas dengan harga lebih rendah.

ReBites menyediakan kanal penjualan untuk sisa tersebut dengan dua batas yang jelas:
produk hanya tayang pada jam yang ditentukan penjual, dan hanya toko yang aktif serta
terverifikasi yang muncul ke pembeli.

## Peran pengguna

| Peran | Halaman awal | Yang dikerjakan |
|---|---|---|
| Pembeli | `/home` | Menjelajah katalog, memesan, membayar, melacak pesanan, memberi ulasan |
| Penjual (UMKM) | `/dashboard/penjual/<id-toko>` | Mengelola menu, pesanan, jadwal jual, dan langganan |
| Kurir | `/dashboard/kurir` | Mengambil tugas kiriman, mengantar, mengirim posisi, dan berkomunikasi dengan pembeli |
| Admin | `/dashboard/admin` | Moderasi, pemantauan, pengguna, pesanan, pengiriman, artikel |
| Super Admin | `/dashboard/admin` | Tindakan yang tidak dapat dipulihkan, termasuk hapus permanen akun |

Peran disimpan di `profiles.role`, dan data kurir terpisah di tabel `couriers`. Rute
tujuan setelah login ditentukan dari peran tersebut, sehingga satu akun selalu mendarat
di panel yang sesuai.

## Fitur utama

**Pembeli.** Katalog makanan surplus dengan pencarian dari bilah navigasi, kategori,
diskon kilat yang mengikuti jam tayang, dan daftar UMKM. Halaman detail produk memuat
sisa stok, jam jual, status buka toko, dan ulasan pembeli lain. Checkout memilih antara
diantar dan ambil sendiri, memakai kode promo, dan dapat membelanjakan koin ReBites.
Pembayaran diproses lewat invoice Xendit. Setelah pesanan dibuat, pembeli mengikuti
status dan riwayat, menerima notifikasi, dan dapat melacak posisi kurir di peta saat
pesanan sedang diantar.

**Penjual.** Dashboard toko berisi pesanan masuk dengan aksi lanjut status, kelola menu
dan stok, jadwal jual per produk, ulasan pembeli, laporan performa, pengaturan toko, dan
pengelolaan langganan. Toko dapat mengajukan pengaktifan kembali setelah dinonaktifkan
melalui alur permintaan yang ditinjau admin.

**Kurir.** Halaman kurir menampilkan tugas yang ditugaskan kepadanya, aksi lanjut status,
pengiriman posisi berkala selama pengantaran, dan percakapan dengan pembeli untuk
koordinasi.

**Admin.** Panel admin menangani moderasi produk dan toko, verifikasi produk, permintaan
perubahan peran, sanksi dan peringatan, pusat laporan pengguna, kotak pesan dukungan
beserta banding akun terblokir, pemantauan aktivitas dan audit, analitik, pengiriman,
koin, langganan, artikel, dan ekspor data ke Excel.

**Asisten.** ReBitess-Asisten menjawab pertanyaan pengunjung dan pengguna di dalam
aplikasi. Pengetahuannya dibatasi pada fakta produk ReBites dan halaman yang boleh
diakses sesuai peran, dan jawabannya tidak membuka data pribadi pengguna lain.

## Alur pesanan

Pesanan bergerak melalui satu sumber kebenaran status operasional: `order_status`.
Transisinya dijaga trigger basis data, sehingga urutan yang tidak sah ditolak di lapisan
data, bukan hanya di antarmuka.

Urutan yang sah: `pending` ke `paid`, lalu `processing`, kemudian `out_for_delivery` atau
`ready_for_pickup`, dan berakhir di `completed`. Pesanan yang masih `pending` juga dapat
berpindah ke `cancelled`.

Pesanan yang sudah mulai diantar atau menunggu diambil dapat selesai otomatis setelah
estimasi tiba terlewati. Penyelesaian berjalan di server. Setiap perubahan status tercatat
di `order_status_history` dan memicu notifikasi ke pihak terkait.

## Arsitektur sistem

Aplikasi berjalan sebagai satu proyek Next.js dengan App Router. Halaman dirender sebagai
komponen React, sedangkan operasi yang butuh hak istimewa dikerjakan route handler di
bawah `app/api`.

- **Lapisan tampilan** mengelompokkan komponen per domain: pembeli, penjual, admin,
  checkout, detail produk, dan primitif UI bersama.
- **Lapisan API** menangani autentikasi Bearer, validasi masukan, aturan bisnis, dan
  pemanggilan penyedia eksternal. Kunci rahasia hanya hidup di sisi server.
- **Lapisan data** adalah Supabase Postgres dengan Row Level Security, fungsi
  `SECURITY DEFINER` untuk operasi sensitif, dan trigger untuk invarian seperti stok,
  transisi status, dan pencatatan aktivitas.
- **Realtime** dipakai untuk pesanan dan posisi kurir, dengan polling sebagai jalur
  cadangan ketika koneksi realtime tidak tersedia.

Otorisasi berjalan berlapis. Pemeriksaan pertama ada di route handler melalui
`lib/admin-access.ts`, dilanjutkan fungsi database, lalu dijaga trigger pada tabel
`profiles`. Perubahan peran hanya sah dari konteks `service_role`, sehingga pemanggilan
langsung ke PostgREST tidak bisa melewati aturan aplikasi. Super Admin ditentukan oleh
`SUPER_ADMIN_USER_ID`, dan bila nilainya kosong atau bukan UUID, penunjukan itu diabaikan
(fail-closed).

## Teknologi

| Bagian | Pilihan |
|---|---|
| Framework | Next.js 14 App Router, React 18, TypeScript 5 |
| Gaya | Tailwind CSS 3, primitif UI berbasis Radix, animasi Framer Motion |
| Basis data dan auth | Supabase Postgres, Supabase Auth, Storage, Realtime |
| Pembayaran | Xendit (invoice dan webhook) |
| Pengiriman | Biteship (tarif dan pembuatan kiriman) serta tarif lokal Kurir ReBites |
| Asisten | Layanan model bahasa melalui `VIBE_CODE_*` atau Gemini |
| Peta | MapLibre GL |

Proyek memakai Supabase V1. Jangan membuat konfigurasi V2.

## Model data

Delapan puluh migrasi di `supabase/migrations` adalah satu-satunya cara skema berubah.
Kelompok tabel utama:

| Kelompok | Isi | Tabel |
|---|---|---|
| Akun dan peran | Peran, preferensi, dan riwayat perubahan peran | `profiles`, `user_preferences`, `role_change_requests`, `role_change_logs` |
| Usaha | Profil toko dan keterkaitannya dengan pembeli | `umkm_profiles`, `store_follows`, `store_activation_requests`, `store_visitors` |
| Katalog | Menu surplus beserta ulasan dan jejak moderasi | `products`, `product_favorites`, `reviews`, `moderation_logs` |
| Transaksi | Pesanan, riwayat status, keuangan penjual, promo, koin | `orders`, `order_status_history`, `seller_transactions`, `promo_codes`, `coin_transactions` |
| Langganan | Paket dan langganan penjual | `plans`, `subscriptions` |
| Logistik | Kurir, penugasan, posisi, dan pesan kurir | `couriers`, `delivery_assignments`, `delivery_locations`, `courier_messages` |
| Dukungan | Kotak pesan admin dan banding akun | `support_threads`, `support_messages`, `support_appeals` |
| Pemantauan | Aktivitas, audit, laporan, peringatan, sanksi | `activity_logs`, `admin_audit_logs`, `reports`, `report_notes`, `warnings`, `sanctions` |
| Konten | Artikel yang dikelola admin | `articles` |
| Asisten | Sesi dan pesan percakapan | `chat_sessions`, `chat_messages` |
| Analitik | Kunjungan situs harian | `site_visitors`, `site_visitor_days` |

## Integrasi eksternal

- **Xendit** membuat invoice checkout dan langganan penjual. Callback masuk lewat
  `app/api/webhooks/xendit` dengan verifikasi token, lalu status pesanan dan langganan
  disesuaikan.
- **Biteship** menyediakan tarif kurir dan identitas kiriman. Webhook
  `app/api/webhooks/biteship` memperbarui status kiriman dan nomor resi.
- **Kurir ReBites** adalah tarif lokal berbasis jarak yang dipakai ketika penjual tidak
  memakai kurir pihak ketiga. Tarifnya dibaca dari variabel lingkungan dan dibatasi nilai
  minimum serta maksimum.
- **Posisi kurir** disimpan di `delivery_locations` dengan Row Level Security dan disiarkan
  lewat Realtime Postgres Changes. Kanal Broadcast publik tidak dipakai karena siapa pun
  yang tahu kode pesanan bisa menerimanya.

## Keamanan dan kontrol akses

- Semua endpoint `app/api/admin/*` menerima `Authorization: Bearer <access_token>`.
  Proyek ini tidak memakai `middleware.ts`, dan otorisasi tidak bergantung pada cookie
  sesi. Memanggil endpoint admin tanpa header selalu dijawab 401.
- Akun yang diblokir ditahan di semua pintu masuk. Jalur pasca-autentikasi membaca
  `profiles.account_status`, sanksi juga menyinkronkan `ban_duration` Supabase Auth dan
  menonaktifkan toko miliknya. Akun tersebut melihat pesan blokir di form login dan dapat
  memantau bandingnya lewat halaman publik `/banding`.
- Penghapusan permanen akun hanya untuk Super Admin, wajib sandi dari `PASSWORD_DELETE_USER`
  beserta alasan, dan ditolak selama masih ada pesanan berjalan atau artikel atas nama akun
  itu. Bila variabel tersebut kosong, fitur mati. Ini berbeda dari penghapusan biasa yang
  masih dapat dipulihkan.
- Cakupan peran dijaga berlapis. Admin tim tidak dapat mengubah peran, menjatuhkan sanksi,
  atau menghapus data; permintaan perubahan peran dari admin tim harus diputuskan Super
  Admin lain, dan permintaan yang diajukan sendiri tidak dapat diputuskan sendiri.
- Ekspor Excel dibatasi 5.000 baris. Permintaan yang melebihi batas ditolak dengan pesan
  yang menyebut jumlah dan batasnya, bukan dipotong tanpa penjelasan.
- Rahasia sisi server, termasuk `SUPABASE_SERVICE_ROLE_KEY`, `XENDIT_SECRET_KEY`,
  `BITESHIP_API_KEY`, dan kunci asisten, tidak pernah dikirim ke peramban.

## Langganan penjual

| Paket | Bulanan | Tahunan | Batas produk |
|---|---|---|---|
| Basic | Rp24.999 | Rp249.990 | 3 produk |
| Standar | Rp49.000 | Rp490.000 | 5 produk |
| Max | Rp99.000 | Rp990.000 | 15 produk |

Paket menentukan batas jumlah produk, akses riwayat penjualan, penempatan prioritas di
marketplace, laporan penjualan, dan dukungan. Aktivasi dilakukan setelah pembayaran
terverifikasi, dan halaman sukses menyediakan jalan kembali manual bila verifikasi belum
selesai.

## Operasi dan pemantauan

Kiriman yang menunggu dikirim lebih dari 24 jam disorot di halaman Pengiriman dan muncul
sebagai item perhatian di dashboard. Ambang dan daftar statusnya ditetapkan di satu modul
`lib/shipment-state.ts`. Sanksi lama yang dibuat sebelum blokir tersambung ke Supabase Auth
dapat disusulkan lewat `npm run sync:account-bans`, yang berjalan dalam mode uji coba dulu
dan baru mengubah data dengan `--apply`.

## Menjalankan proyek

Prasyarat: Node.js, npm, dan proyek Supabase.

1. `npm install`
2. Salin `.env.example` menjadi `.env.local`, lalu isi kredensial Supabase, Xendit, Biteship,
   dan asisten. Berkas `.env` dan `.env.local` tidak boleh di-commit.
3. Terapkan migrasi dengan `npx supabase migration list` untuk memeriksa status, lalu
   terapkan berkas yang belum jalan. Jangan mengubah migrasi yang sudah diterapkan.
4. `npm run dev` menjalankan server di `http://localhost:3000`.

Jalankan satu server dev saja. Port dikunci ke 3000: bila port itu masih dipakai,
`npm run dev` berhenti dengan `EADDRINUSE` alih-alih diam-diam pindah ke 3001. Dua server
yang berbagi folder build membuat chunk hilang dan halaman menjawab 500. Urutan yang benar
adalah `npm run dev:reset` lalu `npm run dev`. Perintah `npm run dev:reset` hanya
mematikan proses milik proyek ini, sedangkan proses lain yang memakai port tersebut
dilaporkan dan dibiarkan hidup.

## Pengujian dan pemeriksaan

```bash
npm run typecheck        # tsc --noEmit untuk kode aplikasi
npm run typecheck:tests  # tsc untuk berkas tes
npm run lint             # eslint
node --test tests/*.test.ts
```

Suite berisi 1254 tes dan berjalan sepenuhnya offline: tanpa peramban, basis data, atau
jaringan. Tes membaca berkas proyek dan memeriksa kontrak yang mudah rusak diam-diam,
seperti urutan cabang galat sebelum cabang kosong, atribut aksesibilitas, alur status
pesanan, dan pemasangan komponen global. Kegagalan tes selalu berarti ada yang salah dan
tidak boleh diabaikan.

## Batasan saat ini

- Area layanan terbatas di Kota Depok.
- Ongkir dihitung dari jarak dan berat perkiraan ketika penjual belum mengisi data berat
  atau titik lokasi toko. Antarmuka menandai nilai yang masih perkiraan.
- Pembayaran bergantung pada Xendit dan pengiriman pada Biteship. Bila penyedia tidak
  tersedia, alur terkait berhenti dengan pesan yang jelas, bukan dengan status palsu.
- Verifikasi email, login Google, dan pembayaran memerlukan kredensial milik pemilik
  proyek, sehingga tidak dapat diuji penuh di lingkungan tanpa kredensial.

## Tim

Dikembangkan oleh Team Tony Stark Inc. untuk GTNIC 2026.

| Nama | Peran |
|---|---|
| Faletehan Al Farabi | Backend Developer |
| Aburahman Kayysan | Fullstack Developer |
| Jona Alfaros | Frontend Developer |

## Tautan

- Repositori: https://github.com/kayy-eci/Rebitesss-GTNIC2026
- Indeks dokumentasi: `docs/README.md`
- Naskah demo video: `docs/naskah-demo-video.md`
