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

**Peran & beranda.** `admin → /dashboard/admin`, `umkm → /dashboard/penjual`,
`buyer → /home` (lihat `lib/current-user.ts`).

**Migrasi.** File di `supabase/migrations/` adalah satu-satunya cara schema
berubah. Selalu periksa status dengan `npx supabase migration list` sebelum
dan sesudah menerapkan. Jangan mengubah file migrasi yang sudah diterapkan.

**Preferensi admin** disimpan di `localStorage` (`lib/admin-preferences.ts`),
bukan di database — belum ada endpoint pengaturan admin.

## Status yang perlu diketahui

- `LIVE_LOCATION_READY = false` di
  `app/components/order-history/courier-live-tracker.tsx` — pelacakan lokasi
  kurir belum diaktifkan.
- Proyek memakai **Supabase V1**. Jangan membuat konfigurasi V2.
