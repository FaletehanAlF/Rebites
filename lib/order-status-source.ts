/**
 * Sumber kebenaran tunggal untuk status operasional pesanan.
 *
 * MASALAH YANG DISELESAIKAN
 * Aplikasi punya DUA sistem status yang tadinya sama-sama dipakai:
 * `orders.order_status` (dipakai state machine, timeline, panel status) dan
 * `orders.progress_status` (diisi saat checkout sebagai 'disiapkan', lalu
 * TIDAK PERNAH diubah siapa pun).
 *
 * Akibatnya tampilan bisa berbeda untuk satu pesanan yang sama:
 * - kartu pesanan di sisi pembeli -> "Sedang disiapkan" (dari progress_status)
 * - halaman detail pesanan        -> "Pesanan sedang diantar" (dari order_status)
 *
 * Aturan di modul ini:
 * 1. `order_status` adalah sumber kebenaran. `progress_status` TIDAK pernah
 *    menentukan tampilan sendiri.
 * 2. `progress_status` hanya dipakai sebagai jaring pengaman untuk pesanan
 *    lama, ketika `order_status` belum pernah bergerak walaupun penjual
 *    sudah memajukan pesanan. Jaring ini HANYA aktif untuk nilai 'diantar' /
 *    'siap-diambil' — nilai 'disiapkan' (nilai default checkout) TIDAK pernah
 *    menimpa apa pun, karena itulah yang menyebabkan tombol penjual mati.
 * 3. Tidak ada status yang dikarang. Status yang tidak dikenal menghasilkan
 *    'pending' (menunggu pembayaran) — bukan tebakan "sedang diantar".
 *
 * Modul ini MURNI: tanpa jaringan, tanpa database, tanpa jam sistem.
 */

/**
 * Fase operasional pesanan.
 *
 * Nilai memakai `order_status` apa adanya supaya cocok dengan data di
 * database dan bisa dibandingkan langsung.
 */
export type OrderPhase =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'out_for_delivery'
  | 'ready_for_pickup'
  | 'completed'
  | 'cancelled';

/** Bentuk pesanan yang dibutuhkan untuk menentukan fase. */
export interface OrderPhaseInput {
  /** `lifecycle_status`: 'ongoing' | 'completed'. */
  status?: string;
  /** `order_status` — sumber kebenaran. */
  orderStatus?: string | null;
  /** `progress_status` — hanya jaring pengaman untuk pesanan lama. */
  progressStatus?: string | null;
}

/** Status yang berarti "pesanan sudah tidak berjalan". */
const TERMINAL_CANCELLED = new Set(['cancelled', 'refunded', 'failed']);

/**
 * Nilai `progress_status` yang berarti penjual SUDAH memajukan pesanan.
 *
 * 'disiapkan' sengaja TIDAK ada di sini: itu nilai default dari checkout,
 * bukan bukti bahwa apa pun sudah bergerak.
 */
const PROGRESS_ADVANCED: Record<string, OrderPhase> = {
  diantar: 'out_for_delivery',
  'siap-diambil': 'ready_for_pickup',
};

/**
 * `order_status` yang belum pernah bergerak, sehingga jaring pengaman
 * `progress_status` masih boleh dipakai untuk pesanan lama.
 */
const NOT_YET_ADVANCED = new Set(['', 'paid', 'processing', 'preparing']);

/**
 * Tentukan fase operasional satu pesanan.
 *
 * Urutan pemeriksaan penting:
 * 1. lifecycle selesai -> selesai (paling kuat, ditulis oleh settlement).
 * 2. order_status terminal -> dibatalkan.
 * 3. order_status modern yang SUDAH bergerak -> dipakai apa adanya.
 * 4. Jaring pengaman: order_status belum pernah bergerak TAPI progress_status
 *    menunjukkan penjual sudah memajukan -> pakai progress_status. Ini
 *    menyelamatkan pesanan lama.
 * 5. Selain itu -> 'pending' (menunggu pembayaran). Tidak ada tebakan.
 */
export function resolveOrderPhase(order: OrderPhaseInput): OrderPhase {
  const lifecycle = order.status;
  const os = (order.orderStatus ?? '').trim();
  const ps = (order.progressStatus ?? '').trim();

  if (lifecycle === 'completed') return 'completed';
  if (TERMINAL_CANCELLED.has(os)) return 'cancelled';

  if (os === 'pending') return 'pending';
  if (os === 'out_for_delivery') return 'out_for_delivery';
  if (os === 'ready_for_pickup' || os === 'ready') return 'ready_for_pickup';
  if (os === 'completed') return 'completed';

  // Jaring pengaman pesanan lama: order_status belum pernah bergerak, tapi
  // progress_status bukti bahwa penjual sudah memajukan pesanan. Pesanan ini
  // tidak boleh kembali ke "menunggu pembayaran" dan hilang dari pandangan.
  if (NOT_YET_ADVANCED.has(os)) {
    const advanced = PROGRESS_ADVANCED[ps];
    if (advanced) return advanced;
  }

  if (os === 'paid') return 'paid';
  if (os === 'processing' || os === 'preparing') return 'processing';

  return 'pending';
}

/**
 * Pesanan menunggu tindakan penjual, bukan menunggu pembeli atau sistem.
 *
 * Dipakai untuk badge jumlah dan penanda merah di kartu pesanan, jadi
 * definisinya harus sama dengan fase yang benar-benar punya aksi:
 * - `paid`      -> pesanan sudah dibayar tapi belum mulai disiapkan
 * - `processing`-> makanan sedang disiapkan
 *
 * `pending` sengaja TIDAK dihitung: pembeli belum membayar, tidak ada yang
 * bisa dikerjakan penjual, dan menghitungnya membuat badge tidak pernah
 * kosong.
 */
export function needsSellerAction(phase: OrderPhase): boolean {
  return phase === 'paid' || phase === 'processing';
}

/**
 * Aksi yang boleh diambil penjual pada fase tertentu.
 *
 * Setiap pasangan (asal -> tujuan) di sini sudah diizinkan trigger
 * `guard_orders_update` di database, jadi tidak perlu migrasi SQL:
 *   paid             -> processing
 *   processing       -> out_for_delivery | ready_for_pickup
 *   out_for_delivery -> completed
 *   ready_for_pickup -> completed
 */
export interface SellerAction {
  /** Status tujuan; dikirim ke `transitionOrderStatus`. */
  targetStatus:
    | 'processing'
    | 'out_for_delivery'
    | 'ready_for_pickup'
    | 'completed';
  label: string;
  description: string;
  /** Varian visual tombol. */
  tone: 'primary' | 'emerald' | 'purple';
}

/**
 * Aksi penjual berikutnya untuk satu pesanan.
 *
 * Mengembalikan null bila tidak ada aksi yang boleh diambil (pesanan sudah
 * selesai, dibatalkan, atau masih menunggu pembayaran).
 */
export function getSellerAction(
  phase: OrderPhase,
  fulfillment: string,
  /**
   * Fase setelah aksi ini dijalankan, bila sistem boleh memajukannya sendiri.
   *
   * `autoAdvanceTo` terisi hanya ketika penugasan kurir otomatis tersedia
   * (penjual sudah punya titik lokasi toko). Dengan begitu label tombol tetap
   * jujur: "Makanan Sudah Siap" hanya bila kurir memang akan berangkat sendiri.
   */
  options?: { autoAdvanceTo?: 'out_for_delivery' | null }
): SellerAction | null {
  switch (phase) {
    case 'paid':
      return {
        targetStatus: 'processing',
        label: 'Mulai Siapkan Pesanan',
        description: 'Pesanan akan masuk status sedang disiapkan',
        tone: 'primary',
      };
    case 'processing': {
      if (fulfillment === 'pickup') {
        return {
          targetStatus: 'ready_for_pickup',
          label: 'Makanan Sudah Siap',
          description: 'Pembeli akan diberi tahu bahwa pesanan siap diambil',
          tone: 'emerald',
        };
      }
      /**
       * Pengiriman: penjual TIDAK lagi menekan tombol "antar" terpisah.
       *
       * Dua ketukan ("Siapkan" lalu "Antarkan") membuat pesanan tertahan di
       * tahap siapkan meski makanannya sudah jadi — pembeli melihat
       * "Sudah menunggu N menit" padahal tidak ada yang dikerjakan lagi.
       * Satu ketukan sekarang: menyelesaikan penyiapan SEKALIGUS memulai
       * pengantaran, dan trigger database menugaskan kurir otomatis begitu
       * status berpindah ke 'out_for_delivery'.
       *
       * Tombol "antar" terpisah tetap disediakan sebagai langkah paksa bila
       * penjual perlu mengantar tanpa kurir (lihat `forceDeliveryAction`).
       */
      if (options?.autoAdvanceTo === 'out_for_delivery') {
        return {
          targetStatus: 'out_for_delivery',
          label: 'Antarkan Pesanan',
          description: 'Kurir ditugaskan otomatis dan pesanan mulai diantar',
          tone: 'purple',
        };
      }
      return {
        targetStatus: 'out_for_delivery',
        label: 'Antarkan Pesanan',
        description: 'Pesanan akan masuk status sedang diantar',
        tone: 'purple',
      };
    }
    case 'out_for_delivery':
    case 'ready_for_pickup':
      return {
        targetStatus: 'completed',
        label: 'Tandai Selesai',
        description: 'Pesanan ditandai selesai dan dana dilepas ke penjual',
        tone: 'emerald',
      };
    default:
      return null;
  }
}
