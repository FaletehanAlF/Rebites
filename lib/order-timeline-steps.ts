/**
 * Logika murni pemetaan riwayat status ke waktu tiap tahap timeline.
 *
 * Dipisah dari `lib/order-status-history.ts` (yang menyentuh Supabase) agar
 * aturan ini bisa diuji tanpa database — persis seperti `lib/coin-adjustment.ts`
 * dipisah dari route yang menulis ke database.
 *
 * Prinsip: JANGAN pernah mengarang waktu. Kalau suatu tahap tidak punya
 * timestamp nyata, hasilnya `null` dan timeline menampilkan "Menunggu".
 */

export interface OrderStatusHistoryEntry {
  status: string;
  at: string | null;
  note: string | null;
}

/**
 * Status → tahap timeline yang aktif pada status itu.
 *
 * Satu status menyalakan BEBERAPA tahap sekaligus: `out_for_delivery` berarti
 * sudah dibayar, sudah disiapkan, DAN kurir sudah berangkat. Kalau pemetaannya
 * satu-ke-satu, tahap "Pembayaran dikonfirmasi" akan kehilangan waktunya.
 */
export const STATUS_TO_STEPS: Record<string, string[]> = {
  paid: ['confirmed'],
  processing: ['confirmed', 'prepared'],
  preparing: ['confirmed', 'prepared'],
  ready: ['confirmed', 'prepared', 'ready'],
  ready_for_pickup: ['confirmed', 'prepared', 'ready'],
  out_for_delivery: ['confirmed', 'prepared', 'on-the-way'],
  completed: ['confirmed', 'prepared', 'on-the-way', 'arrived', 'completed'],
  cancelled: ['cancelled'],
  refunded: ['cancelled'],
  failed: ['cancelled'],
};

/** Bagian order yang dipakai untuk fallback waktu. */
export interface TimelineOrderFacts {
  completedAt?: string;
  deliveryStartedAt?: string;
}

/**
 * Waktu tiap tahap, diturunkan dari riwayat.
 *
 * Entri paling awal menang untuk satu tahap: "Pembayaran dikonfirmasi" harus
 * memakai waktu pembayaran PERTAMA, bukan pembayaran terakhir.
 */
export function buildTimelineTimes(
  order: TimelineOrderFacts,
  history: readonly OrderStatusHistoryEntry[]
): Record<string, string | null> {
  const times: Record<string, string | null> = {};

  for (const entry of history) {
    const steps = STATUS_TO_STEPS[entry.status];
    if (!steps || !entry.at) continue;
    for (const key of steps) {
      if (!times[key]) times[key] = entry.at;
    }
  }

  // Tahap yang sudah terjadi tapi tidak tercatat di riwayat (mis. pesanan
  // lama, sebelum pencatatan riwayat berjalan) tetap bisa memakai waktu yang
  // memang ada di baris pesanan.
  if (!times.completed && order.completedAt) times.completed = order.completedAt;
  if (!times['on-the-way'] && order.deliveryStartedAt) {
    times['on-the-way'] = order.deliveryStartedAt;
  }

  return times;
}
