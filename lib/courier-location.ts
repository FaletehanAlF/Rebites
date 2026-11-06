/**
 * Logika posisi kurir: kesegaran data, throttle, dan status tampilan.
 *
 * Modul ini MURNI: tanpa jaringan, tanpa database, tanpa jam sistem di
 * dalamnya. Waktu "sekarang" selalu diteruskan dari pemanggil supaya
 * hasilnya deterministik dan bisa diuji.
 *
 * Prinsip kejujuran:
 * - Posisi yang basi TIDAK boleh ditampilkan seolah-olah itu posisi
 *   sekarang. UI harus tahu posisi sudah "terlambat" supaya bisa
 *   mengatakannya.
 * - Tidak ada posisi yang dikarang. Tanpa titik awal yang valid, hasilnya
 *   `null` — bukan titik asal rute.
 */

/** Batas kesegaran posisi. Sesudah ini posisi dianggap basi. */
export const STALE_AFTER_MS = 90_000;

/** Batas kesegaran untuk dianggap "tidak tersedia" (sangat basi). */
export const UNAVAILABLE_AFTER_MS = 10 * 60_000;

/** Interval minimum antar pengiriman posisi dari perangkat. */
export const MIN_SEND_INTERVAL_MS = 5_000;

/** Interval target pengiriman posisi dari perangkat. */
export const TARGET_SEND_INTERVAL_MS = 10_000;

export interface CourierLocationPoint {
  latitude: number;
  longitude: number;
  /** Waktu rekaman posisi (ISO). */
  recordedAt: string;
}

export type LocationFreshness = 'aktif' | 'terlambat' | 'tidak_tersedia';

/**
 * Tentukan seberapa segar sebuah posisi.
 *
 * - `aktif`           → posisi boleh ditampilkan sebagai posisi terkini.
 * - `terlambat`       → posisi masih ditampilkan, TAPI UI harus
 *                       menyebutkan bahwa data sudah basi (mis. "terlambat
 *                       2 menit").
 * - `tidak_tersedia`  → posisi terlalu lama; UI TIDAK boleh menunjuk peta
 *                       seolah-olah kurir ada di sana.
 */
export function resolveLocationFreshness(
  recordedAt: string | null | undefined,
  now: number
): LocationFreshness {
  if (!recordedAt) return 'tidak_tersedia';
  const ts = new Date(recordedAt).getTime();
  if (!Number.isFinite(ts)) return 'tidak_tersedia';

  const age = now - ts;
  // Waktu di masa depan = jam server meleset. Perlakukan sebagai basi.
  if (age < 0) return 'terlambat';
  if (age <= STALE_AFTER_MS) return 'aktif';
  if (age <= UNAVAILABLE_AFTER_MS) return 'terlambat';
  return 'tidak_tersedia';
}

/**
 * Apakah posisi boleh ditampilkan di peta?
 *
 * Hanya `aktif` dan `terlambat`. `tidak_tersedia` berarti jangan tunjuk
 * peta sama sekali — lebih baik peta kosong daripada peta yang salah.
 */
export function isPositionDisplayable(freshness: LocationFreshness): boolean {
  return freshness !== 'tidak_tersedia';
}

/**
 * Kapan posisi berikutnya boleh dikirim?
 *
 * Mengembalikan `null` bila boleh kirim sekarang. Nilai lain adalah
 * jumlah milidetik yang harus ditunggu.
 *
 * Aturan:
 * - Kalau belum pernah mengirim, boleh kirim sekarang.
 * - Kalau jarak antar update terlalu kecil (< 5 detik), tunggu.
 * - Kalau sudah lebih dari 10 detik, boleh kirim sekarang.
 */
export function nextSendDelayMs(
  lastSentAt: number | null | undefined,
  now: number,
  minIntervalMs: number = MIN_SEND_INTERVAL_MS,
  targetIntervalMs: number = TARGET_SEND_INTERVAL_MS
): number | null {
  if (lastSentAt == null || !Number.isFinite(lastSentAt)) return null;
  const elapsed = now - lastSentAt;
  if (!Number.isFinite(elapsed)) return null;
  if (elapsed < 0) return 0;
  if (elapsed >= targetIntervalMs) return null;
  if (elapsed >= minIntervalMs) return null;
  return minIntervalMs - elapsed;
}

/**
 * Uraikan durasi menjadi kalimat singkat untuk UI.
 *
 * Contoh: "12 detik lalu", "3 menit lalu", "2 jam lalu".
 * Tidak ada durasi negatif — jam server meleset menghasilkan "baru saja".
 */
export function formatPositionAge(
  recordedAt: string | null | undefined,
  now: number
): string | null {
  if (!recordedAt) return null;
  const ts = new Date(recordedAt).getTime();
  if (!Number.isFinite(ts)) return null;

  const age = now - ts;
  if (age < 0) return 'baru saja';
  const seconds = Math.floor(age / 1000);
  if (seconds < 60) return `${Math.max(1, seconds)} detik lalu`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
}

/**
 * Posisi kurir yang valid?
 *
 * Menolak nilai di luar rentang dan Null Island — (0,0) hampir pasti data
 * kosong yang terisi nol, bukan lokasi nyata di Teluk Guinea.
 */
export function isValidCourierPosition(
  latitude: unknown,
  longitude: unknown
): boolean {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  if (latitude === 0 && longitude === 0) return false;
  return true;
}

/** Titik pada rute: [lng, lat] — urutan GeoJSON. */
export type RoutePoint = [number, number];

export interface RouteProjection {
  /** Titik hasil proyeksi, sudah menempel di rute. */
  position: RoutePoint;
  /** Posisi sepanjang rute, 0..1 (0 = awal rute). */
  progress: number;
}

/**
 * Proyeksikan posisi kurir ke titik terdekat di rute.
 *
 * Posisi GPS asli bisa meleset dari jalan (gang kecil, drift GPS), dan
 * motor yang meluncur tepat di atas garis jalan terlihat benar serta
 * seperti yang diharapkan pengguna. Jadi marker diproyeksikan ke rute,
 * bukan digambar mentah di titik GPS.
 *
 * Bila rute tidak bisa diproyeksikan, hasilnya `null` — pemanggil lalu
 * memakai animasi ilustratif. Tidak ada posisi yang dikarang.
 */
export function projectOntoRoute(
  route: readonly RoutePoint[],
  point: { latitude: number; longitude: number }
): RouteProjection | null {
  if (!Array.isArray(route) || route.length < 2) return null;
  if (!isValidCourierPosition(point.latitude, point.longitude)) return null;

  // Rute memakai [lng, lat]; titik target memakai lat/lng.
  const targetLng = point.longitude;
  const targetLat = point.latitude;

  // Panjang tiap segmen (derajat, dikoreksi lintang), dipakai untuk
  // mengubah posisi dalam segmen menjadi progres sepanjang rute.
  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < route.length - 1; i += 1) {
    const [lng1, lat1] = route[i];
    const [lng2, lat2] = route[i + 1];
    const dx = (lng2 - lng1) * Math.cos((lat1 * Math.PI) / 180);
    const dy = lat2 - lat1;
    const length = Math.sqrt(dx * dx + dy * dy);
    segmentLengths.push(length);
    totalLength += length;
  }
  if (totalLength <= 0) return null;

  let bestDistance = Number.POSITIVE_INFINITY;
  let bestPosition: RoutePoint = [route[0][0], route[0][1]];
  let bestProgress = 0;

  let travelled = 0;
  for (let i = 0; i < route.length - 1; i += 1) {
    const [lng1, lat1] = route[i];
    const [lng2, lat2] = route[i + 1];
    const dx = (lng2 - lng1) * Math.cos((lat1 * Math.PI) / 180);
    const dy = lat2 - lat1;
    const segLenSq = dx * dx + dy * dy;

    // Proyeksi target ke segmen ini (dot product), dibatasi 0..1.
    let t = 0;
    if (segLenSq > 0) {
      const tx = (targetLng - lng1) * Math.cos((lat1 * Math.PI) / 180);
      const ty = targetLat - lat1;
      t = (tx * dx + ty * dy) / segLenSq;
      t = Math.min(1, Math.max(0, t));
    }

    const projLng = lng1 + (lng2 - lng1) * t;
    const projLat = lat1 + (lat2 - lat1) * t;
    const ex = (targetLng - projLng) * Math.cos((lat1 * Math.PI) / 180);
    const ey = targetLat - projLat;
    const distance = Math.sqrt(ex * ex + ey * ey);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestPosition = [projLng, projLat];
      bestProgress =
        totalLength > 0 ? (travelled + segmentLengths[i] * t) / totalLength : 0;
    }

    travelled += segmentLengths[i];
  }

  return {
    position: bestPosition,
    progress: Math.min(1, Math.max(0, bestProgress)),
  };
}
