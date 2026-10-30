import type { FulfillmentMode, GeoPoint } from './types';

/**
 * Estimasi waktu pesanan (persiapan + pengantaran).
 *
 * Modul MURNI: tanpa jaringan, tanpa DB, tanpa jam. Semua fungsi di sini
 * mengembalikan MENIT, bukan timestamp — pemanggil yang menambahkan waktu
 * mulai, sehingga hasilnya bisa diuji tanpa memalsukan jam sistem.
 *
 * Tiga angka yang dulu salah dan dijaga oleh tes:
 *
 * 1. Waktu persiapan diambil dari tabel slug toko yang HAMPIR TIDAK PERNAH
 *    cocok. Slug toko nyata berbentuk `madura-mart-gl0p5`, `ravora-blkjz`,
 *    sedangkan tabel hanya memuat `warkop-pak-iman`, `warung-nusantara`,
 *    `dapur-ibu-tini`. Akibatnya semua toko jatuh ke default dan estimasi
 *    tidak pernah mencerminkan toko mana pun. Sekarang dicocokkan per
 *    awalan slug agar toko bersufiks tetap kena.
 *
 * 2. Default persiapan 20 menit terlalu lama untuk makanan surplus yang
 *    SUDAH matang dan hanya perlu dihangatkan serta dikemas. 12 menit.
 *
 * 3. Pengantaran memakai tangga jarak yang berhenti di 10 km lalu melebar
 *    linier 3 menit/km tanpa batas atas. Jarak yang salah (mis. koordinat
 *    kosong yang terbaca 0,0) menghasilkan estimasi puluhan hari. Sekarang
 *    memakai kecepatan rata-rata dengan plafon yang masuk akal.
 */

/**
 * Waktu persiapan per toko (menit). Kunci boleh berupa awalan slug: entri
 * `madura-mart` berlaku untuk `madura-mart-gl0p5`.
 */
export const VENDOR_PREPARATION_MINUTES: Record<string, number> = {
  'warkop-pak-iman': 8,
  'warung-nusantara': 12,
  'dapur-ibu-tini': 15,
};

/**
 * Default untuk toko yang tidak terdaftar. Makanan surplus sudah dimasak,
 * jadi yang dihitung hanya penghangatan + pengemasan, bukan memasak dari nol.
 */
const DEFAULT_PREPARATION_MINUTES = 12;

/** Batas bawah/atas agar nilai env atau data aneh tidak menghasilkan estimasi mustahil. */
const MIN_PREPARATION_MINUTES = 1;
const MAX_PREPARATION_MINUTES = 120;

export function getVendorPreparationMinutes(vendorSlug?: string): number {
  if (!vendorSlug) return DEFAULT_PREPARATION_MINUTES;
  const slug = vendorSlug.trim().toLowerCase();
  if (!slug) return DEFAULT_PREPARATION_MINUTES;

  // Cocok persis lebih dulu, lalu awalan terpanjang. Awalan dipakai karena
  // slug toko dibuat unik dengan sufiks acak (`-gl0p5`, `-blkjz`), sehingga
  // pencocokan persis akan meleset untuk hampir semua toko.
  const exact = VENDOR_PREPARATION_MINUTES[slug];
  if (typeof exact === 'number') return clampPreparation(exact);

  const keys = Object.keys(VENDOR_PREPARATION_MINUTES);
  let bestKey = '';
  let bestMinutes = DEFAULT_PREPARATION_MINUTES;
  for (const key of keys) {
    if (!slug.startsWith(`${key}-`)) continue;
    if (key.length > bestKey.length) {
      bestKey = key;
      bestMinutes = VENDOR_PREPARATION_MINUTES[key];
    }
  }
  return clampPreparation(bestMinutes);
}

function clampPreparation(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_PREPARATION_MINUTES;
  return Math.min(MAX_PREPARATION_MINUTES, Math.max(MIN_PREPARATION_MINUTES, Math.round(minutes)));
}

/**
 * Kecepatan rata-rata kurir makanan di kawasan padat (km/jam).
 *
 * 18 km/jam sengaja lebih rendah dari kecepatan berkendara bebas: angka ini
 * harus mencakup lampu merah, gang sempit, dan waktu mencari alamat. Memakai
 * kecepatan motor di jalan besar menghasilkan estimasi yang selalu terlalu
 * optimistis, dan pembeli menilai itu sebagai janji yang dilanggar.
 */
export const COURIER_AVG_SPEED_KM_PER_HOUR = 18;

/**
 * Waktu tetap untuk parkir, serah-terima, dan naik-turun (menit).
 * Tanpa ini, pesanan 200 meter akan berestimasi 1 menit — mustahil.
 */
export const HANDOVER_MINUTES = 6;

/**
 * Plafon pengantaran. Di atas ~2 jam, estimasi kehilangan makna dan yang
 * sebenarnya dibutuhkan pembeli adalah "jarak terlalu jauh", bukan angka.
 */
export const MAX_TRAVEL_MINUTES = 120;

/**
 * Estimasi menit pengantaran untuk jarak tempuh (km).
 *
 * Mengembalikan 0 bila jarak tidak diketahui (<= 0 / bukan angka): pemanggil
 * tidak boleh menampilkan angka pengantaran yang dikarang. Sebelumnya jarak 0
 * menghasilkan 10 menit, sehingga pesanan tanpa koordinat tampak punya
 * estimasi yang sebenarnya tidak dihitung dari apa pun.
 */
export function calculateTravelMinutes(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0;
  const driving = (distanceKm / COURIER_AVG_SPEED_KM_PER_HOUR) * 60;
  return Math.min(MAX_TRAVEL_MINUTES, Math.max(1, Math.round(HANDOVER_MINUTES + driving)));
}

export interface OrderEstimate {
  preparationMinutes: number;
  travelMinutes: number;
  estimatedMinutes: number;
}

export function estimateOrderMinutes({
  fulfillment,
  distanceKm = 0,
  vendorSlug,
}: {
  fulfillment: FulfillmentMode;
  distanceKm?: number;
  vendorSlug?: string;
}): OrderEstimate {
  const preparationMinutes = getVendorPreparationMinutes(vendorSlug);
  const travelMinutes =
    fulfillment === 'delivery' ? calculateTravelMinutes(distanceKm) : 0;
  return {
    preparationMinutes,
    travelMinutes,
    estimatedMinutes: preparationMinutes + travelMinutes,
  };
}

export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
