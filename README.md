# ReBites

Aplikasi marketplace makanan ReBites — Next.js App Router + Supabase.

## Stack

| Komponen | Versi |
|---|---|
| Next.js (App Router) | 14.2.35 |
| React | 18.2.0 |
| TypeScript | 5.2.2 |
| Supabase JS | 2.x (V1 — jangan migrasi ke V2) |
| Tailwind CSS | 3.3.3 |

## Struktur folder

```text
app/                 Route Next.js (App Router)
├── api/             Route handler HTTP
│   ├── admin/       Endpoint panel admin (Bearer token wajib)
│   ├── articles/    Artikel publik
│   ├── checkout/    Alur checkout + Xendit
│   ├── orders/      Pesanan pembeli
│   ├── profile/     Profil pengguna
│   ├── reports/     Pelaporan pengguna
│   ├── shipping/    Tarif ongkir (Biteship)
│   ├── subscriptions/ Langganan penjual
│   └── webhooks/    Callback Xendit
├── components/      Komponen UI, dikelompokkan per domain
│   ├── admin/       Panel admin (22 halaman)
│   ├── auth/        Login & registrasi
│   ├── checkout/    Keranjang & pembayaran
│   ├── dashboard-penjual/  Dashboard penjual
│   ├── detail-product/     Detail produk
│   ├── detail-toko/        Detail toko
│   ├── home/        Beranda pembeli
│   ├── landing/     Halaman pemasaran
│   ├── notification/       Notifikasi
│   ├── order-history/      Riwayat pesanan
│   ├── shared/      Dipakai lintas domain
│   ├── subscription/       Langganan
│   ├── tambahMenu/  Kelola menu penjual
│   └── ui/          Primitif UI (button, dialog, dropdown, dst.)
├── dashboard/
│   ├── admin/       Panel admin (guard: useRequireAdmin)
│   └── penjual/     Panel penjual (guard: useRequireSeller)
├── auth/            Halaman login/registrasi
├── home/            Beranda pembeli
├── artikel/         Artikel publik
├── detail/          Detail produk/toko
├── makanan/         Kategori makanan
├── notifikasi/      Pusat notifikasi
├── profile/         Profil pengguna
├── riwayatPesanan/  Riwayat pesanan
├── toko/            Halaman toko
└── langganan/       Langganan

hooks/               Custom React hook (use-require-admin, use-admin-me, dst.)
lib/                 Logika non-UI
├── server/          HANYA server: klien Supabase, auth Bearer, health probe
├── admin-*.ts       Klien data panel admin (satu file per domain)
└── *.ts             Helper bersama (auth-token, current-user, csv, dst.)

supabase/migrations/ Migrasi SQL — sumber kebenaran schema database
tests/               Tes offline (node --test). 401 tes, tanpa browser/DB.
types/               Deklarasi tipe global
scripts/             Skrip sekali-jalan (bukan bagian runtime)
docs/                Catatan desain & rencana fitur
public/              Aset statis
```

## Menjalankan

```bash
npm install          # sekali saja
npm run dev          # http://localhost:3000 (turbopack)
npm run dev:webpack  # fallback bila turbo bermasalah
```

Salin `.env.example` menjadi `.env.local` lalu isi kredensial Supabase.
**Jangan pernah commit `.env` atau `.env.local`.**

## Pemeriksaan sebelum commit

```bash
npm run typecheck        # tsc --noEmit
npm run typecheck:tests  # tsc untuk file tes
npm run lint             # eslint
node --test tests/*.test.ts   # seluruh tes offline (401 tes)
```

Tes memakai `node --test` dan `readProjectFile` — tidak butuh browser,
database, atau jaringan. Kegagalan tes **selalu** berarti ada yang salah;
jangan diabaikan.

## Konvensi penting

**Autentikasi API.** Semua endpoint `app/api/admin/*` menerima
`Authorization: Bearer <access_token Supabase>`. Tidak ada `middleware.ts`
dan tidak ada `@supabase/ssr`, jadi **cookie tidak pernah dipakai** untuk
otorisasi. Memanggil endpoint admin lewat `curl` tanpa header akan selalu
401 — itu perilaku benar, bukan bug.

**Tiga lapis otorisasi role.** Route server (`lib/admin-access.ts`) →
RPC database (`SECURITY DEFINER`) → trigger `profiles.role`. Perubahan role
hanya sah dari konteks `service_role`; admin tim tidak bisa melewati API
lewat PostgREST.

**Peran & beranda.** `admin → /dashboard/admin`, `umkm → /dashboard/penjual/<id-toko>`,
`buyer → /home` (lihat `lib/current-user.ts` dan `lib/seller-store-path.ts`). Alamat
`/dashboard/penjual` tanpa id tetap hidup sebagai pengalih: ia mencari toko milik penjual
yang login lalu mengalihkan ke alamat ber-id, sehingga tautan lama tidak perlu diubah.

**Migrasi.** File di `supabase/migrations/` adalah satu-satunya cara schema
berubah. Selalu periksa status dengan `npx supabase migration list` sebelum
dan sesudah menerapkan. Jangan mengubah file migrasi yang sudah diterapkan.

**Preferensi admin** dibaca dari `localStorage` sebagai cache dan disinkronkan
ke akun lewat tabel `user_preferences` (`lib/admin-preferences.ts`), sehingga
pilihan yang sama tetap terpakai saat admin masuk dari perangkat lain.
Pengecualiannya lebar sidebar: itu sengaja per perangkat karena besar layar
berbeda-beda.

## Status yang perlu diketahui

- Live GPS kurir aktif lewat tabel `delivery_locations` ber-RLS + Realtime
  Postgres Changes (`hooks/use-courier-location.ts`, peta
  `app/components/order-history/delivery-map.tsx`). Jangan menghidupkan
  kembali kanal Broadcast publik — siapa pun yang tahu kode pesanan bisa
  menerimanya.
- Suspend/ban menahan login di SEMUA pintu: jalur pasca-auth membaca
  `profiles.account_status` (`lib/account-block.ts`), sanksi juga menyinkronkan
  `ban_duration` Supabase Auth (`lib/server/account-ban.ts`) dan menonaktifkan
  toko pemiliknya. Akun yang diblokir melihat pesan di form login.
- Kotak pesan admin + banding akun terblokir (`20261109000000_support_inbox`):
  satu percakapan per akun (`support_threads`), isi pesan (`support_messages`),
  dan banding (`support_appeals`). Satu-satunya jalur dari sisi pengguna adalah
  halaman banding PUBLIK `/banding`: akun yang diblokir tidak bisa login, dan
  pengguna memegang kode untuk memantau statusnya di `/banding/status`.
  Halaman/menu chat pembeli dan penjual sengaja tidak ada — percakapan dibaca
  dan dibalas admin di menu **Chat** panel admin (`/dashboard/admin/chat`).
  Tombol "Setujui & buka blokir" mencabut sanksi lewat jalur yang sama dengan
  panel blokir (`revokeAllActiveBlocks`). Klien hanya memegang `SELECT`; semua
  penulisan lewat server.
- Hapus PERMANEN akun (`app/api/admin/users/[id]/hard-deletion/route.ts`)
  hanya untuk Super Admin, wajib sandi dari env `PASSWORD_DELETE_USER`
  (+ alasan), dan menolak bila masih ada pesanan berjalan atau artikel penulis.
  Variabel kosong = fitur mati. Beda dari hapus biasa yang dapat dipulihkan.
- Ekspor Excel daftar admin: Pengguna, Pesanan, Produk, dan UMKM punya tombol
  "Ekspor Excel" dengan filter yang sama seperti tabel. Berkas dibuat di server
  (`lib/server/admin-export.ts` + `lib/admin-export-rules.ts`), dibatasi 5.000
  baris, dan permintaan yang melebihi batas DITOLAK dengan pesan — bukan
  dipotong diam-diam. Halaman Laporan memakai pengunduh bersama yang sama.
- Foto profil memakai bucket `avatars` + kolom `profiles.avatar_url`
  (`app/api/profile/avatar/route.ts`, `POST` unggah / `DELETE` hapus), sama
  untuk pembeli, penjual, dan admin. Aturan ukuran dan formatnya satu tempat:
  `lib/admin-avatar.ts`, dipakai klien dan server sekaligus.
- Kiriman "Menunggu dikirim" yang lewat 24 jam disorot di halaman Pengiriman
  (kartu ringkasan + badge umur) dan muncul sebagai item perhatian di
  Dashboard. Tautannya membuka `/dashboard/admin/pengiriman?state=to_ship`.
  Ambang dan definisi statusnya satu tempat: `lib/shipment-state.ts`
  (`TO_SHIP_STALE_HOURS`, `TO_SHIP_STATUSES`).
- Sanksi yang sudah lama (sebelum blokir disambungkan ke Supabase Auth) bisa
  disusulkan sekali jalan dengan `npm run sync:account-bans` (uji coba) lalu
  `npm run sync:account-bans -- --apply`.
- Proyek memakai **Supabase V1**. Jangan membuat konfigurasi V2.
