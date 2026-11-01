'use client';

import { Navigation } from 'lucide-react';

/**
 * Kontrol pengiriman lokasi kurir (sisi kurir/penjual).
 *
 * SENGAJA DI-NONAKTIFKAN sampai jalur lokasi yang aman tersedia.
 *
 * Alasannya (jangan dihapus tanpa menyelesaikan akar masalahnya):
 * implementasi sebelumnya memancarkan koordinat lewat Supabase Broadcast pada
 * kanal `delivery:<orderCode>` TANPA `private: true`, tanpa RLS, dan tanpa
 * tabel lokasi. Kanal broadcast publik dapat diterima siapa pun yang
 * mengetahui/menebak kode pesanan, sehingga lokasi kurir bocor ke orang yang
 * tidak berhak.
 *
 * Jalur yang benar: tabel lokasi (`delivery_tracking`) dengan RLS
 * kepemilikan pesanan + penugasan kurir, lalu Realtime Postgres Changes pada
 * baris tersebut. Property `ready` hanya boleh diubah true setelah itu ada.
 */
const LIVE_LOCATION_READY = false;

interface Props {
  orderCode: string;
  /** Dipertahankan agar pemanggil tidak perlu berubah saat fitur aktif kembali. */
  enabled?: boolean;
}

export function CourierLiveTracker({ enabled = false }: Props) {
  if (!enabled || !LIVE_LOCATION_READY) return null;

  return (
    <div className="mt-2 rounded-xl bg-cream-50 px-4 py-3 ring-1 ring-hairline">
      <div className="flex items-center gap-2">
        <Navigation className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-charcoal-900">Pelacakan lokasi</p>
      </div>
    </div>
  );
}
