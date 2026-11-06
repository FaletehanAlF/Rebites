/**
 * Kapan sebuah pesanan boleh diselesaikan OTOMATIS.
 *
 * Modul MURNI: tanpa jaringan, tanpa database, tanpa jam sistem di dalamnya.
 * Waktu "sekarang" selalu diteruskan dari pemanggil supaya bisa diuji.
 *
 * ATURAN (disengaja, jangan dilonggarkan tanpa alasan):
 * - Hanya pesanan yang SUDAH MULAI DIANTAR (`out_for_delivery`) atau SUDAH
 *   SIAP DIAMBIL (`ready_for_pickup`) yang boleh diselesaikan otomatis.
 * - Pesanan yang penjualnya belum pernah memajukan status (`paid`,
 *   `processing`) TIDAK BOLEH selesai sendiri. Pembeli bisa kehilangan uang
 *   dan barang sekaligus: pesanan berubah "selesai" padahal tidak pernah
 *   dimasak, apalagi diantar.
 * - Tanpa tenggat yang pernah dihitung, tidak ada dasar untuk menyelesaikan
 *   apa pun. Lebih baik pesanan menggantung (dan bisa dibatalkan pembeli)
 *   daripada ditutup dengan alasan yang tidak bisa dipertanggungjawabkan.
 */

/** Status yang menandakan perjalanan sudah benar-benar dimulai. */
export const IN_FLIGHT_STATUSES = ['out_for_delivery', 'ready_for_pickup'] as const;

export interface ExpiryCandidate {
  /** `lifecycle_status`: 'ongoing' | 'completed'. */
  status?: string;
  /** `order_status`. */
  orderStatus?: string | null;
  /** Tenggat yang tersimpan pada pesanan. */
  estimatedCompletionAt?: string | null;
}

/**
 * Apakah pesanan ini sudah lewat tenggat DAN boleh diselesaikan otomatis?
 *
 * Mengembalikan `false` untuk semua kasus yang tidak pasti — termasuk waktu
 * yang tidak parseable. False negative di sini hanya membuat pesanan tetap
 * berjalan; false positive menutup pesanan yang belum sampai.
 */
export function shouldAutoComplete(
  order: ExpiryCandidate,
  now: number
): boolean {
  if (order.status !== 'ongoing') return false;

  const os = (order.orderStatus ?? '').trim();
  if (!(IN_FLIGHT_STATUSES as readonly string[]).includes(os)) return false;

  const raw = order.estimatedCompletionAt;
  if (!raw) return false;

  const deadline = new Date(raw).getTime();
  if (!Number.isFinite(deadline)) return false;
  if (!Number.isFinite(now)) return false;

  return now >= deadline;
}
