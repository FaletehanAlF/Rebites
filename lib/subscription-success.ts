/**
 * Aturan murni untuk halaman konfirmasi pembayaran langganan.
 *
 * Dipisahkan dari komponen supaya bisa diuji langsung dengan `node --test`
 * tanpa browser maupun Supabase.
 */

/** Status yang boleh ditampilkan halaman konfirmasi. */
export type SuccessStatus = 'loading' | 'pending' | 'active' | 'failed';

export interface SuccessStatusInput {
  externalId: string | null | undefined;
}

/**
 * Status awal halaman dari parameter URL.
 *
 * `active` HANYA bila tidak ada `external_id`. Parameter `external_id` berasal
 * dari invoice Xendit dan berarti pembayaran belum tentu lunas, sehingga status
 * awal harus `pending` sampai backend memverifikasinya. Halaman ini tidak
 * pernah menyimpulkan lunas dari nama paket di URL.
 */
export function resolveSuccessStatus({ externalId }: SuccessStatusInput): SuccessStatus {
  return externalId ? 'pending' : 'active';
}

export interface PostPaymentHrefInput {
  /** true bila akun punya baris umkm_profiles; null = belum diketahui. */
  hasStore: boolean | null | undefined;
}

/**
 * Tujuan setelah halaman sukses.
 *
 * Dashboard penjual hanya bermakna bagi akun yang punya toko. Pembeli yang
 * belum punya toko (mis. memilih paket lewat halaman publik lalu pembayarannya
 * berhasil, atau akunnya dibuat dari alur pembeli) dikembalikan ke beranda
 * pembeli, bukan dilempar ke layar penjual yang isinya kosong.
 */
export function resolvePostPaymentHref({ hasStore }: PostPaymentHrefInput): string {
  return hasStore ? '/dashboard/penjual' : '/home';
}
