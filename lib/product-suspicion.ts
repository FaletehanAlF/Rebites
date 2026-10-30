/**
 * Aturan deteksi aktivitas mencurigakan — sederhana, dapat dijelaskan,
 * TANPA klaim AI. Dipakai dashboard admin sebagai flag/rekomendasi
 * pemeriksaan, bukan vonis pelanggaran. Auto-approve tetap berlaku;
 * admin menindak setelah diterbitkan bila terbukti melanggar.
 *
 * Batasan jujur:
 * - Duplikat hanya berbasis nama persis dalam satu toko (bukan kemiripan
 *   semantik / gambar).
 * - Harga tidak wajar hanya berbasis aturan eksplisit di bawah (bukan model).
 * - Foto gagal dimuat hanya terdeteksi di client saat render (onError) —
 *   fungsi ini hanya menandai foto kosong/placeholder, bukan hasil
 *   pemeriksaan jaringan.
 * - Laporan pengguna & pola perubahan membutuhkan data activity/reports
 *   yang mungkin belum lengkap; bila data tidak ada, flag tidak dibuat
 *   (tidak mengarang).
 */

export interface SuspicionInput {
  id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  original_price: number | null;
  surplus_price: number | null;
  stock: number | null;
  verification_status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SuspicionContext {
  /** Produk lain dalam toko yang sama (untuk cek duplikat nama). */
  siblingProducts?: Pick<SuspicionInput, 'id' | 'name'>[];
  /** Jumlah laporan pengguna terhadap produk/toko (bila tersedia). */
  reportCount?: number | null;
  /** Jumlah perubahan produk 24 jam terakhir (dari activity_logs, bila ada). */
  recentChangeCount?: number | null;
}

export interface SuspicionFlag {
  code:
    | 'duplicate_name'
    | 'incomplete_info'
    | 'missing_photo'
    | 'price_anomaly'
    | 'user_reports'
    | 'frequent_changes';
  label: string;
  detail: string;
}

/**
 * Foto contoh bawaan. Diperiksa sebagai AWALAN, bukan nama berkas utuh:
 * setelah konversi AVIF, nilai lama di database masih berbunyi `.jpg` sementara
 * berkasnya kini `.avif`. Pencocokan persis akan meleset dan produk yang masih
 * memakai foto contoh tidak lagi ditandai.
 */
const PLACEHOLDER_IMAGE_PREFIXES = ['/foods/ikansayur', '/placeholder', 'placehold.co'];

export function flagSuspiciousProduct(
  product: SuspicionInput,
  ctx?: SuspicionContext
): SuspicionFlag[] {
  const flags: SuspicionFlag[] = [];
  const name = (product.name ?? '').trim();
  const desc = (product.description ?? '').trim();
  const img = (product.image_url ?? '').trim();

  // 1. Duplikat: nama persis (case-insensitive) muncul >1x di toko yang sama.
  const siblings = ctx?.siblingProducts ?? [];
  const dupes = siblings.filter(
    (s) => s.id !== product.id && s.name.trim().toLowerCase() === name.toLowerCase() && name !== ''
  );
  if (dupes.length > 0) {
    flags.push({
      code: 'duplicate_name',
      label: 'Kemungkinan duplikat',
      detail: `Ditemukan ${dupes.length} produk lain dengan nama persis "${name}" di toko ini. Periksa apakah duplikat tidak sengaja.`,
    });
  }

  // 2. Informasi tidak lengkap: deskripsi kosong / < 20 karakter, atau kategori kosong.
  if (!desc || desc.length < 20 || !product.category) {
    const parts: string[] = [];
    if (!desc) parts.push('deskripsi kosong');
    else if (desc.length < 20) parts.push(`deskripsi sangat pendek (${desc.length} karakter)`);
    if (!product.category) parts.push('kategori belum diisi');
    flags.push({
      code: 'incomplete_info',
      label: 'Info produk tidak lengkap',
      detail: `Perlu dilengkapi: ${parts.join(', ')}.`,
    });
  }

  // 3. Foto: kosong atau masih placeholder bawaan.
  if (!img || PLACEHOLDER_IMAGE_PREFIXES.some((p) => img.includes(p))) {
    flags.push({
      code: 'missing_photo',
      label: 'Foto perlu diperiksa',
      detail: !img
        ? 'Produk belum memiliki foto.'
        : 'Produk memakai foto placeholder bawaan; minta UMKM mengunggah foto asli.',
    });
  }

  // 4. Harga tidak wajar (aturan eksplisit):
  //    - surplus > original (diskon negatif)
  //    - harga 0 dengan stok > 0
  //    - harga > Rp10.000.000 (ambang jelas untuk makanan surplus)
  const orig = product.original_price;
  const sur = product.surplus_price;
  const stock = product.stock;
  if (orig != null && sur != null && sur > orig) {
    flags.push({
      code: 'price_anomaly',
      label: 'Harga tidak wajar',
      detail: `Harga surplus (${sur}) lebih tinggi dari harga normal (${orig}).`,
    });
  } else if ((sur === 0 || orig === 0) && (stock ?? 0) > 0) {
    flags.push({
      code: 'price_anomaly',
      label: 'Harga tidak wajar',
      detail: 'Harga Rp0 dengan stok tersedia; pastikan bukan salah input.',
    });
  } else if ((orig ?? 0) > 10_000_000 || (sur ?? 0) > 10_000_000) {
    flags.push({
      code: 'price_anomaly',
      label: 'Harga tidak wajar',
      detail: 'Harga di atas Rp10.000.000 — tidak wajar untuk porsi surplus; verifikasi ke UMKM.',
    });
  }

  // 5. Laporan pengguna (bila data tersedia; tidak mengarang).
  if (typeof ctx?.reportCount === 'number' && ctx.reportCount > 0) {
    flags.push({
      code: 'user_reports',
      label: 'Ada laporan pengguna',
      detail: `Ditemukan ${ctx.reportCount} laporan terkait. Tinjau laporan sebelum menindak.`,
    });
  }

  // 6. Pola perubahan: >= 5 perubahan dalam 24 jam terakhir (bila data ada).
  if (typeof ctx?.recentChangeCount === 'number' && ctx.recentChangeCount >= 5) {
    flags.push({
      code: 'frequent_changes',
      label: 'Sering diubah',
      detail: `${ctx.recentChangeCount} perubahan dalam 24 jam terakhir; periksa pola manipulasi harga/stok.`,
    });
  }

  return flags;
}
