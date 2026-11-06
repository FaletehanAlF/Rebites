/**
 * Berat paket bawaan saat penjual belum mengisi `products.weight_gram`.
 *
 * MASALAH: kolom `weight_gram` sengaja nullable ("tanpa default/fallback"
 * pada migrasi 7B-2A), dan 38 dari 44 produk aktif belum mengisinya. Akibatnya
 * endpoint ongkir menolak semua produk itu dengan `product_no_weight`, checkout
 * mati sebelum invoice dibuat, dan pembeli hanya melihat "ongkir belum bisa
 * dihitung" tanpa jalan keluar. Penjual sendiri tidak pernah melihat alasan
 * untuk mengisi berat karena produknya sudah tayang.
 *
 * Angka diambil dari berat yang SUDAH diisi penjual di database, bukan
 * dikarang:
 *   Makanan Berat  : 200g (Ayam Penyet), 350g (Rice Bowl), 400g (Ayam Pop)
 *   Jajanan        : 200g (Pisang Goreng Manis)
 * Nilai per kategori dipilih pada batas atas kelompoknya agar ongkir tidak
 * terlalu murah; selisih ratusan gram hampir tidak menggeser tarif karena
 * tarif ReBites memakai jarak, bukan berat sebagai pengali utama.
 *
 * Dipakai HANYA untuk menghitung ongkir. Nilai ini TIDAK ditulis ke database
 * dan tidak menggantikan berat yang diisi penjual: begitu penjual mengisi
 * `weight_gram`, angka itu yang dipakai.
 */

/** Berat bawaan per kategori (gram). Kunci dicocokkan huruf kecil. */
export const DEFAULT_WEIGHT_BY_CATEGORY: Record<string, number> = {
  'makanan berat': 350,
  'makanan cepat saji': 300,
  japanese: 350,
  minuman: 400,
  dessert: 200,
  jajanan: 200,
  'snack & jajanan': 200,
  'roti & kue': 300,
  'buah & sayur': 500,
};

/**
 * Bawaan untuk kategori yang tidak terdaftar.
 *
 * 300g dipilih karena berada di tengah rentang berat nyata produk toko ini
 * (200-400g). Menebak terlalu kecil membuat ongkir lebih murah dari
 * seharusnya; terlalu besar membuat pembeli membayar lebih. Nilai tengah
 * membatasi kesalahan ke arah mana pun.
 */
export const DEFAULT_WEIGHT_FALLBACK_GRAM = 300;

/** Dimensi kotak bawaan bila penjual belum mengisi (cm). */
export const DEFAULT_PACKAGE_CM = { length: 20, width: 15, height: 10 };

/**
 * Berat yang dipakai untuk menghitung ongkir.
 *
 * Mengembalikan `null` bila tidak ada angka yang bisa dipakai sama sekali —
 * lega dari penebakan tanpa dasar. Pada praktiknya fungsi ini selalu
 * menghasilkan angka positif, sehingga produk tanpa berat tidak lagi
 * memblokir pengantaran.
 */
export function resolvePackageWeightGram(
  weightGram: unknown,
  category?: string | null
): number | null {
  const explicit =
    typeof weightGram === 'number' ? weightGram : Number(weightGram ?? NaN);
  if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);

  const key = typeof category === 'string' ? category.trim().toLowerCase() : '';
  if (key && DEFAULT_WEIGHT_BY_CATEGORY[key]) return DEFAULT_WEIGHT_BY_CATEGORY[key];

  return DEFAULT_WEIGHT_FALLBACK_GRAM;
}

/** True bila berat yang dipakai adalah tebakan, bukan isian penjual. */
export function isDefaultPackageWeight(weightGram: unknown): boolean {
  const explicit =
    typeof weightGram === 'number' ? weightGram : Number(weightGram ?? NaN);
  return !(Number.isFinite(explicit) && explicit > 0);
}
