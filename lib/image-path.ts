/**
 * Penormalan path gambar lokal ke AVIF.
 *
 * MENGAPA MODUL INI ADA
 * Sebelumnya `public/` berisi JPG/JPEG/WebP, dan SEPULUH dari dua belas berkas
 * itu path-nya tersimpan sebagai `products.image_url` di database — bukan hanya
 * dirujuk kode. Mengubah nama berkas tanpa penyesuaian akan membuat 18 produk
 * menampilkan gambar rusak, sementara `next build` tetap hijau: build tidak
 * pernah memeriksa apakah sebuah path di dalam database punya berkasnya.
 *
 * Mengubah database (UPDATE products SET image_url = ...) memerlukan izin
 * terpisah dan tidak dapat dibatalkan, jadi lapisan ini yang menyesuaikan diri:
 * nilai lama dari database tetap dibaca apa adanya, lalu diarahkan ke berkas
 * AVIF yang sekarang benar-benar ada.
 *
 * MENGAPA PEMETAANNYA MENYELURUH, BUKAN DAFTAR NAMA
 * Setelah konversi, SELURUH gambar di `public/` berformat AVIF — tidak ada lagi
 * JPG/JPEG/WebP lokal. Karena itu memetakan setiap path lokal berekstensi lama
 * selalu benar, dan tidak akan menunjuk berkas yang tidak ada. Gambar unggahan
 * pengguna adalah URL `https://…` (Supabase Storage) dan tidak disentuh.
 *
 * Modul ini MURNI (tanpa impor) agar dapat diuji `node --test`.
 */

/** Ekstensi lokal yang sudah digantikan AVIF. */
const LEGACY_LOCAL_EXTENSION = /\.(jpe?g|webp)$/i;

export const AVIF_EXTENSION = '.avif';

/**
 * Ubah path gambar lokal berekstensi lama menjadi `.avif`.
 *
 * Nilai yang tidak perlu diubah dikembalikan apa adanya:
 *   - kosong / null            -> string kosong
 *   - URL absolut (`https://`) -> tidak disentuh (Supabase Storage, Pexels)
 *   - data URI                 -> tidak disentuh
 *   - sudah `.avif`            -> tidak disentuh
 *   - SVG/GIF/ICO              -> tidak disentuh (tidak dikonversi)
 */
export function resolveImageSrc(src: string | null | undefined): string {
  const value = (src ?? '').trim();
  if (!value) return '';

  // Hanya path lokal yang berakar di `/` (berkas di dalam `public/`).
  // `//host/path` juga ditolak karena itu protokol-relative, bukan lokal.
  if (!value.startsWith('/') || value.startsWith('//')) return value;

  // Jangan sentuh query/hash: `/foto.jpg?v=2` harus tetap membawa `?v=2`.
  const cut = value.search(/[?#]/);
  const path = cut === -1 ? value : value.slice(0, cut);
  const suffix = cut === -1 ? '' : value.slice(cut);

  return `${path.replace(LEGACY_LOCAL_EXTENSION, AVIF_EXTENSION)}${suffix}`;
}

/**
 * Semua bentuk path yang menunjuk gambar yang sama.
 *
 * Dipakai pemeriksaan yang membandingkan string secara persis — misalnya
 * deteksi "produk ini masih memakai foto contoh". Perbandingan `===` tunggal
 * akan meleset begitu salah satu sisi sudah dinormalkan ke `.avif`.
 */
export function imageSrcVariants(src: string | null | undefined): string[] {
  const value = (src ?? '').trim();
  if (!value) return [];

  const resolved = resolveImageSrc(value);
  const variants = new Set<string>([value, resolved]);

  // Tambahkan kembali bentuk lama dari nilai yang sudah AVIF, supaya data lama
  // dan data baru tetap dianggap sama.
  if (resolved.endsWith(AVIF_EXTENSION)) {
    const withoutAvif = resolved.slice(0, -AVIF_EXTENSION.length);
    variants.add(`${withoutAvif}.jpg`);
    variants.add(`${withoutAvif}.jpeg`);
    variants.add(`${withoutAvif}.webp`);
  }

  return Array.from(variants);
}
