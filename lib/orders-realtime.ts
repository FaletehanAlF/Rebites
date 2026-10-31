'use client';

import { supabase } from './supabase';

/**
 * Langganan perubahan tabel `orders` untuk menyegarkan daftar pesanan.
 *
 * MASALAH YANG DISELESAIKAN
 * Dashboard penjual sebelumnya hanya polling: pesanan baru terlihat setelah
 * 30 detik, padahal notifikasinya sudah berbunyi. Penjual yang sedang sibuk
 * tidak melihat pesanan masuk, dan pembeli menunggu tanpa ada yang mulai
 * menyiapkan.
 *
 * KENAPA `postgres_changes` TANPA FILTER
 * Filter `umkm_id=eq.…` pada postgres_changes membutuhkan REPLICA IDENTITY
 * FULL: dengan identitas default (primary key saja), record lama pada UPDATE
 * dan DELETE tidak membawa kolom filter, sehingga event bisa tidak pernah
 * sampai. Lewat SQL, repo ini juga tidak memasang REPLICA IDENTITY FULL pada
 * `orders`.
 *
 * Tanpa filter, langganan menerima semua perubahan yang LOLOS RLS untuk
 * pengguna itu — jadi penjual tetap hanya menerima pesanan tokonya sendiri,
 * dan admin menerima yang memang berhak dia lihat.
 *
 * KENAPA DI-DEBOUNCE
 * Satu transisi status bisa menghasilkan beberapa event berurutan (mis.
 * `order_status` lalu `lifecycle_status`). Tanpa debounce, tiap event memicu
 * fetch sendiri; menggabungkannya berarti satu fetch per kelompok perubahan.
 *
 * Polling TETAP dipakai pemanggil sebagai fallback: Realtime bisa terputus
 * tanpa memberi tahu (jaringan berpindah, laptop tidur), dan pesanan yang
 * tidak pernah muncul lebih buruk daripada pesanan yang muncul telat.
 */

let channelCounter = 0;

const DEFAULT_DEBOUNCE_MS = 400;

export interface OrdersRealtimeOptions {
  /** Dipanggil setelah perubahan, sudah di-debounce. */
  onChange: () => void;
  debounceMs?: number;
  /** Pemisah nama kanal; berguna saat beberapa pemakai berjalan bersamaan. */
  label: string;
}

/**
 * Berlangganan perubahan `orders`.
 *
 * Mengembalikan fungsi pembongkar yang WAJIB dipanggil saat pemakai berhenti
 * (unmount / subscriber terakhir pergi). Tanpa itu kanal Realtime tertinggal
 * dan websocket terus membuka langganan yang tidak dipakai.
 */
export function subscribeOrdersRealtime({
  onChange,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  label,
}: OrdersRealtimeOptions): () => void {
  channelCounter += 1;
  const channelName = `rebites-orders-${label}-${channelCounter}`;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const schedule = () => {
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, debounceMs);
  };

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      () => schedule()
    )
    .subscribe();

  return () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    void supabase.removeChannel(channel);
  };
}
