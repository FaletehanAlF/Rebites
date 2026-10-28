/**
 * Resolusi titik peta untuk halaman detail pesanan (Tahap A).
 *
 * Fungsi MURNI — tanpa jaringan, tanpa peta, tanpa DB. Dipisahkan agar
 * keputusan "koordinat mana yang boleh digambar" bisa diuji tanpa browser.
 *
 * Aturan:
 * - Koordinat hanya dianggap sah bila KEDUANYA angka finite dan dalam rentang
 *   (lat -90..90, lng -180..180). Tidak ada penebakan dari alamat teks.
 * - Tidak ada koordinat default/dummy. Titik yang tidak sah = null.
 * - Marker kurir TIDAK pernah dihasilkan di sini: infrastruktur GPS belum ada
 *   (lihat docs/rencana-live-gps.md).
 */

export interface MapPoint {
  latitude: number;
  longitude: number;
}

export type MapAvailability =
  | 'ready'          // ada minimal satu titik sah
  | 'no-coordinates' // data pesanan ada, tapi tidak ada koordinat sah
  | 'no-order';      // pesanan belum dimuat

export interface MapPlan {
  availability: MapAvailability;
  origin: MapPoint | null;
  destination: MapPoint | null;
  /** Titik pusat peta + zoom awal; null bila tidak ada titik sah. */
  center: MapPoint | null;
  zoom: number;
  /** Pesan untuk UI ketika peta tidak bisa digambar. */
  message: string | null;
}

function toPoint(lat: unknown, lng: unknown): MapPoint | null {
  // PENTING: Number(null) === 0 dan Number('') === 0. Tanpa penjagaan ini,
  // longitude NULL berubah menjadi 0 dan marker tergambar di Teluk Guinea.
  const isEmpty = (v: unknown) =>
    v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
  if (isEmpty(lat) || isEmpty(lng)) return null;

  const la = typeof lat === 'number' ? lat : Number(lat);
  const lo = typeof lng === 'number' ? lng : Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  // (0,0) adalah Null Island — hampir pasti data kosong yang terisi 0,
  // bukan lokasi nyata di Teluk Guinea. Perlakukan sebagai tidak diketahui.
  if (la === 0 && lo === 0) return null;
  return { latitude: la, longitude: lo };
}

export interface MapPlanInput {
  hasOrder: boolean;
  originLatitude?: unknown;
  originLongitude?: unknown;
  destinationLatitude?: unknown;
  destinationLongitude?: unknown;
}

/**
 * Titik untuk PETA PEMILIH (Tahap B) dari nilai mentah form.
 *
 * Satu keputusan validasi untuk seluruh aplikasi: format input tetap mengikuti
 * parser form yang sudah ada (menerima koma desimal), lalu diteruskan ke
 * `toPoint` yang sama dengan peta Tahap A. Hasilnya `null` bila pasangan tidak
 * lengkap / tidak sah — pemanggil TIDAK boleh membuat marker dari null.
 *
 * Parser diterima sebagai parameter agar modul ini tetap MURNI (tanpa impor
 * relatif) dan bisa dijalankan `node --test` apa adanya. Pemanggil meneruskan
 * `parseCoordinatePairInput` dari lib/location-validation.
 */
export interface ParsedCoordinatePair {
  ok: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export function resolveFormCoordinates(
  latitudeInput: unknown,
  longitudeInput: unknown,
  parsePair: (lat: unknown, lng: unknown) => ParsedCoordinatePair
): MapPoint | null {
  const pair = parsePair(latitudeInput, longitudeInput);
  if (!pair.ok) return null;
  return toPoint(pair.latitude, pair.longitude);
}

/**
 * Rencana tampilan peta. Zoom dipilih agar dua titik berjauhan tetap terlihat
 * tanpa perlu fitBounds manual; pemanggil tetap boleh menyesuaikan.
 */
export function buildMapPlan(input: MapPlanInput): MapPlan {
  if (!input.hasOrder) {
    return {
      availability: 'no-order',
      origin: null,
      destination: null,
      center: null,
      zoom: 13,
      message: 'Memuat data pesanan…',
    };
  }

  const origin = toPoint(input.originLatitude, input.originLongitude);
  const destination = toPoint(input.destinationLatitude, input.destinationLongitude);

  if (!origin && !destination) {
    return {
      availability: 'no-coordinates',
      origin: null,
      destination: null,
      center: null,
      zoom: 13,
      message:
        'Lokasi toko dan alamat tujuan belum memiliki titik koordinat, jadi peta belum dapat ditampilkan.',
    };
  }

  // Bila hanya satu titik yang sah, pusatkan ke titik itu.
  const center = origin && destination
    ? {
        latitude: (origin.latitude + destination.latitude) / 2,
        longitude: (origin.longitude + destination.longitude) / 2,
      }
    : (origin ?? destination)!;

  // Perkiraan zoom dari jarak bujur/lintang antar titik (tanpa library).
  let zoom = 15;
  if (origin && destination) {
    const span = Math.max(
      Math.abs(origin.latitude - destination.latitude),
      Math.abs(origin.longitude - destination.longitude)
    );
    if (span > 1) zoom = 10;
    else if (span > 0.3) zoom = 12;
    else if (span > 0.05) zoom = 13;
    else zoom = 14;
  }

  return {
    availability: 'ready',
    origin,
    destination,
    center,
    zoom,
    message: null,
  };
}
