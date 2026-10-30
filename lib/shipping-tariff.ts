/**
 * Tarif pengiriman ReBites (lokal, tanpa Biteship/API berbayar).
 *
 * - Jarak dihitung dari koordinat toko dan pembeli (Haversine, garis lurus)
 *   lalu dikalikan faktor jalan (ROAD_FACTOR) sebagai ESTIMASI jarak tempuh.
 *   Ini BUKAN jarak jalan resmi; ditampilkan sebagai estimasi.
 * - Tarif dapat dikonfigurasi via environment (server) agar pengelola bisa
 *   menyesuaikan tanpa ubah kode. Nilai default konservatif.
 * - Tidak ada ketergantungan pada API key berbayar.
 */

export const REBITES_COURIER_CODE = 'rebites';
export const REBITES_SERVICE_CODE = 'rebites_standard';
export const REBITES_COURIER_NAME = 'Kurir ReBites';
export const REBITES_SERVICE_NAME = 'Antar (Estimasi Lokal)';

export const ROAD_FACTOR = 1.3;

/**
 * Default tarif sengaja dibuat untuk makanan surplus berharga belasan ribu:
 * ongkir yang mendekati harga makanan membuat pembeli batal, sehingga tarif
 * per km ditekan dan plafonnya dibatasi. Pengelola dapat menaikkannya lewat
 * env tanpa mengubah kode.
 *
 * Angka saat ini (base 3.000 + 1.000/km, plafon 10.000):
 *   1 km -> 4.000    3 km -> 6.000    5 km -> 8.000    7 km+ -> 10.000
 * Plafon 10.000 dipilih agar ongkir tidak pernah melebihi harga makanan
 * surplus itu sendiri; sebelumnya plafon 15.000 membuat satu porsi makanan
 * (10-15 ribu) nyaris berharga dua kali lipat saat diantar.
 */
export function getDeliveryTariffConfig() {
  const base = Number(process.env.DELIVERY_BASE_FEE_IDR ?? '3000');
  const perKm = Number(process.env.DELIVERY_PER_KM_FEE_IDR ?? '1000');
  const minFee = Number(process.env.DELIVERY_MIN_FEE_IDR ?? '3000');
  const maxFee = Number(process.env.DELIVERY_MAX_FEE_IDR ?? '10000');
  return {
    baseFee: Number.isFinite(base) && base >= 0 ? base : 3000,
    perKmFee: Number.isFinite(perKm) && perKm >= 0 ? perKm : 1000,
    minFee: Number.isFinite(minFee) && minFee >= 0 ? minFee : 3000,
    maxFee: Number.isFinite(maxFee) && maxFee > 0 ? maxFee : 10000,
  };
}

export function haversineKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
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

export function estimateRoadDistanceKm(straightKm: number): number {
  if (!Number.isFinite(straightKm) || straightKm < 0) return 0;
  return straightKm * ROAD_FACTOR;
}

export function calculateDeliveryFee(distanceKm: number): number {
  const cfg = getDeliveryTariffConfig();
  const raw = cfg.baseFee + cfg.perKmFee * distanceKm;
  const clamped = Math.min(cfg.maxFee, Math.max(cfg.minFee, raw));
  return Math.round(clamped / 100) * 100;
}

export function isValidCoordinatePair(lat: unknown, lng: unknown): boolean {
  // Number(null) === 0 dan Number('') === 0. Tanpa penjagaan ini, toko yang
  // belum pernah menandai lokasinya (latitude/longitude NULL) terbaca sah
  // sebagai (0,0) — titik di Teluk Guinea. Jaraknya ke Depok ~11.900 km,
  // sehingga ongkir SELALU mentok plafon dan ETA menjadi puluhan hari
  // untuk semua toko yang koordinatnya kosong.
  const isEmpty = (v: unknown) =>
    v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
  if (isEmpty(lat) || isEmpty(lng)) return false;

  const la = typeof lat === 'number' ? lat : Number(lat);
  const lo = typeof lng === 'number' ? lng : Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return false;
  // (0,0) adalah Null Island: data kosong yang terisi angka nol, bukan lokasi
  // nyata. Perlakukan sama seperti koordinat yang belum diisi.
  if (la === 0 && lo === 0) return false;
  return la >= -90 && la <= 90 && lo >= -180 && lo <= 180;
}