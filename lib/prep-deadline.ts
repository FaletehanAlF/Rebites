/**
 * Tenggat persiapan pesanan — dipakai penjual supaya tahu seberapa mepet.
 *
 * Modul MURNI: tanpa jaringan, tanpa database, tanpa jam sistem.
 *
 * KENAPA INI ADA
 * Penjual selama ini hanya melihat jam pesanan dibuat, bukan batas waktu
 * penyiapan. Tanpa batas yang terlihat, "sebentar lagi" tidak pernah punya
 * arti, dan pesanan terasa menggantung lama padahal tenggatnya sudah lewat.
 *
 * SUMBER WAKTU
 * Tenggat diambil dari `estimated_completion_at` yang SUDAH dihitung server
 * (persiapan + pengantaran) dan sudah dijangkarkan ulang ke saat pembayaran
 * diterima. Modul ini tidak menghitung ulang estimasi sendiri — kalau angka
 * itu tidak ada, hasilnya `null`, bukan tebakan.
 */

export interface PrepRemaining {
  /** Teks siap tampil, mis. "Siap dalam 8 menit" atau "Lewat 3 menit". */
  text: string;
  /** true bila tenggat sudah lewat. */
  overdue: boolean;
}

/**
 * Sisa waktu menuju tenggat persiapan/pengantaran.
 *
 * `null` bila tenggat tidak ada atau tidak valid — pemanggil harus
 * menyembunyikan barisnya, bukan menampilkan angka karangan.
 *
 * Tenggat yang sudah lewat TIDAK disembunyikan: penjual berhak tahu, dan
 * menyembunyikannya membuat pesanan tampak "masih aman" sampai pembeli
 * mengeluh.
 */
export function formatPrepRemaining(
  deadlineIso: string | null | undefined,
  now: number
): PrepRemaining | null {
  if (!deadlineIso) return null;
  const deadline = new Date(deadlineIso).getTime();
  if (!Number.isFinite(deadline)) return null;
  if (!Number.isFinite(now)) return null;

  const diffMs = deadline - now;
  const minutes = Math.round(Math.abs(diffMs) / 60_000);

  // `<= 0`: tepat pada tenggat berarti waktu penyiapan SUDAH habis. Kalau
  // memakai `< 0`, detik terakhir sebelum tenggat menampilkan "Siap dalam
  // <1 menit" — terbaca seolah masih ada waktu padahal sudah tidak.
  if (diffMs <= 0) {
    return {
      text: minutes < 1 ? 'Lewat tenggat' : `Lewat ${minutes} menit`,
      overdue: true,
    };
  }

  if (minutes < 1) return { text: 'Siap dalam <1 menit', overdue: false };
  return { text: `Siap dalam ${minutes} menit`, overdue: false };
}
