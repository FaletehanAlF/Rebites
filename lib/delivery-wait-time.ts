/**
 * Durasi tunggu — berapa lama pembeli sudah menunggu pada status sekarang.
 *
 * Logika MURNI: tanpa jaringan, tanpa DB, tanpa jam sistem di dalam modul.
 * Waktu "sekarang" selalu diteruskan dari pemanggil, supaya hasilnya
 * bisa diuji secara deterministik.
 *
 * Prinsip: angka yang ditampilkan harus bisa dipertanggungjawabkan. Modul ini
 * hanya menghitung selisih waktu yang BENAR-BENAR ada. Kalau titik awal tidak
 * diketahui, hasilnya null — bukan "0 menit".
 */

/** Batas bawah durasi yang ditampilkan, supaya tidak bertele-tele. */
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Format durasi dalam bahasa sehari-hari.
 *
 * - < 1 menit  → "kurang dari 1 menit"
 * - < 60 menit → "12 menit"
 * - < 24 jam  → "1 jam 5 menit" / "2 jam"
 * - >= 24 jam → "1 hari 2 jam" / "3 hari"
 *
 * `null` bila titik awal tidak ada atau tidak valid — pemanggil wajib
 * menampilkan "Belum ada" atau menyembunyikan barisnya, bukan menampilkan 0.
 */
export function formatElapsedSince(
  fromIso: string | null | undefined,
  now: number
): string | null {
  if (!fromIso) return null;
  const from = new Date(fromIso).getTime();
  if (!Number.isFinite(from)) return null;
  if (!Number.isFinite(now)) return null;

  const diff = now - from;
  // Waktu di masa depan berarti data tidak konsisten (jam server meleset).
  // Menampilkan durasi negatif akan membingungkan, jadi dianggap tidak ada.
  if (diff < 0) return null;

  if (diff < MINUTE_MS) return 'kurang dari 1 menit';

  if (diff < HOUR_MS) {
    const menit = Math.floor(diff / MINUTE_MS);
    return `${menit} menit`;
  }

  if (diff < DAY_MS) {
    const jam = Math.floor(diff / HOUR_MS);
    const sisaMenit = Math.floor((diff % HOUR_MS) / MINUTE_MS);
    return sisaMenit === 0 ? `${jam} jam` : `${jam} jam ${sisaMenit} menit`;
  }

  const hari = Math.floor(diff / DAY_MS);
  const sisaJam = Math.floor((diff % DAY_MS) / HOUR_MS);
  return sisaJam === 0 ? `${hari} hari` : `${hari} hari ${sisaJam} jam`;
}

/**
 * Tentukan sejak kapan pembeli menunggu.
 *
 * Prioritas:
 * 1. Perubahan status TERAKHIR yang tercatat — inilah yang paling menjawab
 *    "sudah berapa lama saya menunggu pada tahap ini".
 * 2. Bila status belum pernah berubah (pesanan baru), waktu pesanan dibuat.
 *
 * Pesanan yang sudah selesai atau dibatalkan tidak lagi "menunggu" — hasilnya
 * null supaya pemanggil tidak menampilkan angka untuk perjalanan yang sudah
 * berakhir.
 */
export function resolveWaitSince(
  order: {
    status?: string;
    orderStatus?: string;
    createdAt: string;
  },
  lastStatusChangeAt: string | null | undefined
): string | null {
  const os = order.orderStatus ?? 'pending';
  const terminal =
    os === 'completed' ||
    os === 'cancelled' ||
    os === 'refunded' ||
    os === 'failed';
  if (terminal) return null;

  if (lastStatusChangeAt) return lastStatusChangeAt;
  return order.createdAt || null;
}
