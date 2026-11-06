/**
 * Titik koordinat cadangan untuk kota/kecamatan toko yang belum menandai
 * lokasinya di peta.
 *
 * MASALAH: 10 dari 13 toko punya `latitude`/`longitude` NULL, sehingga
 * endpoint ongkir menolak dengan `origin_coordinates_missing` dan semua produk
 * toko itu tidak bisa diantar. Penjual hanya bisa memperbaikinya lewat
 * pengaturan toko, sedangkan pembeli di depannya tidak punya jalan keluar.
 *
 * Tabel ini memakai pusat kecamatan/kota yang SUDAH diisi penjual pada kolom
 * `umkm_profiles.city` — bukan alamat karangan. Karena itu ongkirnya berupa
 * estimasi perkiraan kelurahan, bukan titik pintu toko. Presisinya
 * mencerminkan itu: untuk pesanan senilai belasan ribu dengan tarif per km,
 * selisih 1-2 km masih di bawah plafon ongkir.
 *
 * Bila kota toko tidak ada di daftar, TIDAK ada tebakan koordinat: pemanggil
 * tetap menolak agar ongkir tidak dihitung dari titik yang tidak diketahui.
 * Penjual yang mengisi titik lokasi selalu diutamakan di atas tabel ini.
 */

export interface CityPoint {
  latitude: number;
  longitude: number;
}

/**
 * Kunci huruf kecil. Varian ditulis terpisah (bukan dicocokkan per awalan)
 * supaya "Jakarta Selatan" tidak diam-diam memakai titik "Jakarta Pusat".
 */
const CITY_POINTS: Record<string, CityPoint> = {
  // Depok dan sekitarnya — lokasi toko nyata di database.
  'kota depok': { latitude: -6.4025, longitude: 106.7942 },
  depok: { latitude: -6.4025, longitude: 106.7942 },
  sukmajaya: { latitude: -6.4103, longitude: 106.8277 },
  cimanggis: { latitude: -6.3833, longitude: 106.8667 },
  beji: { latitude: -6.3806, longitude: 106.8256 },
  tapos: { latitude: -6.4269, longitude: 106.8856 },
  cinere: { latitude: -6.3403, longitude: 106.7886 },
  sawangan: { latitude: -6.4033, longitude: 106.7428 },
  // Jakarta — toko Gyozaku.
  'jakarta pusat': { latitude: -6.1805, longitude: 106.8284 },
  'jakarta selatan': { latitude: -6.2615, longitude: 106.8106 },
  'jakarta barat': { latitude: -6.1683, longitude: 106.7588 },
  'jakarta timur': { latitude: -6.2250, longitude: 106.9004 },
  'jakarta utara': { latitude: -6.1384, longitude: 106.8640 },
  jakarta: { latitude: -6.2088, longitude: 106.8456 },
  // Bandung — pembeli di luar kota tidak memakai tabel ini (hanya origin).
  bandung: { latitude: -6.9175, longitude: 107.6191 },
};

export type OriginPointSource = 'store' | 'city' | 'none';

export interface ResolvedOriginPoint {
  point: CityPoint | null;
  source: OriginPointSource;
  /** Kunci kota yang cocok, untuk log & pesan. */
  matchedCity?: string;
}

function isEmptyCoordinate(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  );
}

function isValidPair(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  // (0,0) adalah Null Island: data kosong yang terisi nol, bukan lokasi.
  if (lat === 0 && lng === 0) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Titik asal pengiriman: koordinat toko bila ada, jika tidak pusat kotanya.
 * `source` dipakai untuk memberi tahu pembeli bahwa ongkirnya estimasi.
 */
export function resolveOriginPoint(
  latitude: unknown,
  longitude: unknown,
  city: unknown
): ResolvedOriginPoint {
  if (!isEmptyCoordinate(latitude) && !isEmptyCoordinate(longitude)) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (isValidPair(lat, lng)) {
      return { point: { latitude: lat, longitude: lng }, source: 'store' };
    }
  }

  const key = typeof city === 'string' ? city.trim().toLowerCase() : '';
  const hit = key ? CITY_POINTS[key] : undefined;
  if (hit) {
    return { point: hit, source: 'city', matchedCity: city as string };
  }

  return { point: null, source: 'none' };
}

/** Daftar kota yang dikenali, untuk pesan bantuan ke penjual. */
export function knownCityKeys(): string[] {
  return Object.keys(CITY_POINTS).sort();
}
