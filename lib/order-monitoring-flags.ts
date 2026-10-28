/**
 * Derivasi flag monitoring pesanan admin.
 *
 * Logika ini diekstrak APA ADANYA dari GET /api/admin/orders agar dapat diuji
 * tanpa database, autentikasi, atau provider. Modul ini murni (tanpa I/O) dan
 * tidak boleh mengubah status pesanan.
 *
 * Beberapa kombinasi status saat ini masih bergantung pada keputusan produk
 * yang belum disetujui (lihat tests/admin-order-flags.test.ts). Jangan
 * "merapikan" semantik flag di sini tanpa keputusan tersebut.
 */

export interface OrderMonitoringSource {
  payment_status?: unknown;
  order_status?: unknown;
  lifecycle_status?: unknown;
  progress_status?: unknown;
  delivery_option?: unknown;
  biteship_order_id?: unknown;
}

export interface OrderMonitoringFlags {
  has_shipment: boolean;
  paid_without_shipment: boolean;
  lifecycle_mismatch: boolean;
  legacy_no_progress: boolean;
}

/** Normalisasi yang sama dengan route: hanya string yang dianggap nilai valid. */
function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Hitung flag display-only dari satu baris pesanan.
 *
 * Kontrak saat ini (dipertahankan dari route lama):
 * - `has_shipment` hanya melihat `biteship_order_id !== null`, bukan status
 *   shipment. String kosong saat ini ikut dianggap ada (edge case).
 * - `paid_without_shipment` = payment `paid` + opsi `delivery` + tanpa ID.
 *   Status pesanan (mis. cancelled/refunded) tidak ikut dipertimbangkan.
 * - `lifecycle_mismatch` memakai tiga aturan UNION yang persis seperti route:
 *   1. lifecycle `completed` tetapi order bukan `completed`;
 *   2. lifecycle `ongoing` tetapi order `completed`;
 *   3. order `cancelled` dengan lifecycle `ongoing`.
 * - `legacy_no_progress` = `progress_status` null/tidak tersedia. String kosong
 *   atau nilai tak dikenal TIDAK dianggap legacy oleh implementasi saat ini.
 */
export function deriveOrderMonitoringFlags(
  source: OrderMonitoringSource
): OrderMonitoringFlags {
  const paymentStatus = asString(source.payment_status);
  const orderStatus = asString(source.order_status);
  const lifecycleStatus = asString(source.lifecycle_status);
  const progressStatus = asString(source.progress_status);
  const deliveryOption = asString(source.delivery_option);
  const biteshipOrderId = asString(source.biteship_order_id);

  const hasShipment = biteshipOrderId !== null;
  const paidWithoutShipment =
    paymentStatus === 'paid' && deliveryOption === 'delivery' && !hasShipment;
  const lifecycleMismatch =
    (lifecycleStatus === 'completed' && orderStatus !== 'completed') ||
    (lifecycleStatus === 'ongoing' && orderStatus === 'completed') ||
    (orderStatus === 'cancelled' && lifecycleStatus === 'ongoing');
  const legacyNoProgress = progressStatus === null;

  return {
    has_shipment: hasShipment,
    paid_without_shipment: paidWithoutShipment,
    lifecycle_mismatch: lifecycleMismatch,
    legacy_no_progress: legacyNoProgress,
  };
}

/**
 * Antrean "Perlu dicek" pada UI admin.
 *
 * `legacy_no_progress` sengaja tidak dihitung: itu catatan kelengkapan data
 * pada pesanan lama, bukan masalah yang bisa diperbaiki admin. Perilaku ini
 * dipertahankan dari implementasi sebelumnya dan dikunci oleh tes.
 */
export function orderNeedsAttention(flags: OrderMonitoringFlags): boolean {
  return flags.paid_without_shipment || flags.lifecycle_mismatch;
}
