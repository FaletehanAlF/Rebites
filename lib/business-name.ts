/**
 * Nama toko yang layak ditampilkan.
 *
 * Sumber masalahnya bukan hanya `null`: kolom `business_name` bisa berisi
 * string kosong atau spasi saja (mis. profil yang dibuat sebelum form nama
 * diwajibkan). `?? 'Tidak diketahui'` tidak menangkap kasus itu, sehingga
 * baris tabel admin tampil kosong dan terbaca seperti data rusak.
 *
 * Nilai yang lolos hanya yang punya isi setelah di-trim; selain itu memakai
 * fallback yang diberikan pemanggil.
 */
export function displayBusinessName(
  value: unknown,
  fallback = 'Toko tanpa nama'
): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}
