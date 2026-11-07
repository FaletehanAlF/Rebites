# Rencana Live GPS Kurir — ReBites

**Status: SUDAH DITERAPKAN.** Tabel `delivery_locations` ber-RLS, Realtime
Postgres Changes (`hooks/use-courier-location.ts`), dan peta
`delivery-map.tsx` sudah berjalan. Dokumen ini disimpan sebagai catatan
desain — bagian di bawahnya adalah audit SEBELUM implementasi, dan alasan
utamanya tetap berlaku: kanal Broadcast publik tidak boleh dihidupkan lagi.

## 1. Kondisi SEBELUM implementasi (hasil audit)

| Hal | Nilai aktual |
|---|---|
| `LIVE_LOCATION_READY` | Sudah tidak dipakai — bendera dan `courier-live-tracker.tsx` dihapus; GPS live berjalan lewat `delivery_locations` + Realtime |
| Kanal lokasi | Supabase **Broadcast publik** `delivery:<orderCode>` — sudah **dicabut** dari UI |
| Tabel lokasi | **Tidak ada** di seluruh `supabase/migrations/` |
| RLS lokasi | Tidak ada |
| `delivery-live-tracking.tsx` | Sudah dihapus |
| Role kurir | Tidak ada. `profiles.role` dibatasi `CHECK (role IN ('admin','umkm','buyer'))` |

**Kenapa Broadcast tidak boleh dihidupkan lagi:** kanal Broadcast di Supabase dapat
dilanggani siapa pun yang memegang anon key dan tahu nama kanal. Nama kanal di sini
adalah `delivery:<orderCode>`, dan kode pesanan muncul di UI, notifikasi, dan URL.
Artinya lokasi kurir bisa diterima orang yang sama sekali tidak terkait pesanan.

## 2. Prasyarat: siapa itu "kurir"

Tidak ada role kurir di sistem, dan menambah nilai ke `CHECK` constraint `profiles.role`
adalah perubahan skema yang berdampak ke RLS `profiles` yang sudah ada. Rencana minimal
**tidak** menyentuh role:

- Tabel `delivery_assignments` memetakan `order_id` → `courier_user_id`.
- Kurir = user mana pun yang ditugaskan pada pesanan itu. Siapa yang menugaskan (toko
  atau admin) adalah keputusan bisnis yang belum ada di UI — **butuh keputusan Anda**.

## 3. Skema yang diusulkan (belum diterapkan)

```sql
-- Usulan. JANGAN dijalankan tanpa persetujuan.
create table public.delivery_locations (
  order_id        text        not null references public.orders(order_code) on delete cascade,
  courier_user_id uuid        not null references auth.users(id) on delete cascade,
  latitude        double precision not null check (latitude between -90 and 90),
  longitude       double precision not null check (longitude between -180 and 180),
  accuracy_m      real,
  recorded_at     timestamptz not null default now(),
  primary key (order_id)
);
```

`primary key (order_id)` menyimpan **satu baris terakhir per pesanan**, bukan riwayat.
Alasan: (a) pembeli hanya butuh posisi terkini; (b) tidak menumpuk data pribadi;
(c) menghapus baris saat pesanan selesai = tracking berhenti secara struktural.

### RLS

```sql
alter table public.delivery_locations enable row level security;

-- Baca: pembeli pemilik pesanan ATAU kurir yang ditugaskan ATAU penjual pesanan itu.
create policy delivery_locations_select on public.delivery_locations
for select to authenticated using (
  exists (select 1 from public.orders o
          where o.order_code = delivery_locations.order_id
            and o.buyer_id = auth.uid())
  or courier_user_id = auth.uid()
  or exists (select 1 from public.orders o
             join public.umkm_profiles u on u.id = o.umkm_id
             where o.order_code = delivery_locations.order_id
               and u.user_id = auth.uid())
);

-- Tulis: HANYA kurir yang ditugaskan, dan HANYA selama pengantaran berjalan.
create policy delivery_locations_upsert on public.delivery_locations
for insert to authenticated with check (
  courier_user_id = auth.uid()
  and exists (select 1 from public.orders o
              where o.order_code = delivery_locations.order_id
                and o.order_status = 'out_for_delivery')
);
```

Policy `UPDATE` terpisah dengan syarat yang sama (`courier_user_id = auth.uid()`).
**Catatan penting:** policy `WITH CHECK` hanya mengikat kolom yang disebutkannya.
`order_id` pada UPDATE harus ikut dipagari, kalau tidak kurir pesanan A bisa
memindahkan lokasinya ke pesanan B.

## 4. Realtime

```sql
alter publication supabase_realtime add table public.delivery_locations;
```

Ini **Postgres Changes** (mewarisi RLS), bukan Broadcast. Pembeli hanya menerima baris
yang lolos `delivery_locations_select`. Ini perbedaan mendasar dari implementasi lama.

Alternatif bila frekuensi tinggi: Broadcast **private** + RLS pada `realtime.messages`.
Itu butuh policy tambahan dan lebih rumit; untuk frekuensi di bawah 1 update/5 detik,
Postgres Changes cukup dan lebih aman default-nya.

## 5. Pembatasan frekuensi dan masa simpan

| Aturan | Nilai usulan | Ditegakkan di mana |
|---|---|---|
| Interval kirim dari perangkat | 10 detik, hanya saat tab aktif | client (`watchPosition` + throttle) |
| Update diterima (anti-spam) | maks. 1 per 5 detik per order | trigger `BEFORE UPDATE` (bandingkan `recorded_at`) |
| Umur data | hapus baris saat status terminal | trigger `AFTER UPDATE` pada `orders` |
| Data "terlambat" | `now() - recorded_at > 90 s` → UI tampilkan "terlambat" | client |

Trigger penghapusan lebih baik daripada mengandalkan client, karena client bisa menutup
tab tanpa sempat mengirim "selesai".

## 6. Perubahan UI yang sudah disiapkan

`DeliveryStatusPanel` sudah punya state `on-the-way` dengan label **"GPS belum aktif"**
dan blok **"Posisi kurir belum tersedia"**. Saat backend siap, yang berubah hanya:

1. Bendera `LIVE_LOCATION_READY` dihapus — live GPS berjalan tanpa gerbang manual.
2. Panel membaca `delivery_locations` (bukan Broadcast), lalu merender marker.
3. Tiga state baru dipakai sesuai data: `aktif` (data < 30 dtk), `terlambat` (30–90 dtk),
   `tidak tersedia` (> 90 dtk atau tanpa izin).

Tidak ada peta yang dirender sekarang, karena peta tanpa koordinat sah hanya akan
menyesatkan. Struktur komponennya sudah menerima `variant="full"` untuk area peta.

## 7. Yang harus diputuskan sebelum implementasi

1. **Siapa yang menugaskan kurir** — toko, admin, atau self-assign?
2. **Apakah penjual boleh melihat lokasi** (usulan di atas: ya). Jika tidak, hapus satu
   klausa pada policy `select`.
3. **Retensi data** — hapus saat selesai (usulan) atau simpan riwayat untuk sengketa?
4. **Frekuensi** — 10 detik memberi pengalaman live yang cukup dengan biaya write rendah.
