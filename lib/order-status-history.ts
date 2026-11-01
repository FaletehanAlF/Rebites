'use client';

import { supabase } from './supabase';
import {
  buildTimelineTimes,
  type OrderStatusHistoryEntry,
  type TimelineOrderFacts,
} from './order-timeline-steps';

export { buildTimelineTimes };
export type { OrderStatusHistoryEntry };

/**
 * Riwayat status pesanan dari `order_status_history`.
 *
 * Tabel ini SUDAH ditulis setiap kali status berubah
 * (`lib/order-state-machine.ts`), tetapi tidak pernah dibaca — sehingga
 * timeline menampilkan "Menunggu" untuk semua tahap antara, padahal
 * waktunya sudah tercatat di database.
 */

/**
 * Ambil riwayat status satu pesanan.
 *
 * `dbId` adalah UUID baris `orders.id`; `order_status_history` rujuk lewat
 * `order_id` berupa uuid, bukan kode `RB-...`.
 *
 * Kegagalan baca TIDAK dilempar: riwayat hanya melengkapi tampilan, dan
 * halaman pesanan harus tetap tampil bila tabel ini belum terisi.
 */
export async function fetchOrderStatusHistory(
  dbId: string | null | undefined
): Promise<OrderStatusHistoryEntry[]> {
  if (!dbId) return [];
  try {
    const { data, error } = await supabase
      .from('order_status_history')
      .select('status, created_at, note')
      .eq('order_id', dbId)
      .order('created_at', { ascending: true })
      .limit(100);
    if (error) {
      console.error('[order-status-history] gagal memuat riwayat:', error.message);
      return [];
    }
    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      status: String(row.status ?? ''),
      at: row.created_at ? String(row.created_at) : null,
      note: row.note ? String(row.note) : null,
    }));
  } catch (err) {
    console.error('[order-status-history] gagal memuat riwayat:', err);
    return [];
  }
}

/**
 * Waktu tiap tahap untuk satu pesanan, lengkap dengan fallback dari baris
 * pesanan. Fungsi tipis yang menggabungkan pembaca riwayat dengan pemetaan
 * murni, supaya pemanggil tidak perlu menyusunnya sendiri.
 */
export async function buildOrderTimelineTimes(
  dbId: string | null | undefined,
  order: TimelineOrderFacts
): Promise<Record<string, string | null>> {
  const history = await fetchOrderStatusHistory(dbId);
  return buildTimelineTimes(order, history);
}
