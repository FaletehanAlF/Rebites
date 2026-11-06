/**
 * Waktu Indonesia Barat (UTC+7) untuk agregasi dan ekspor admin.
 *
 * WIB tidak memakai daylight saving, sehingga offset tetap aman dipakai untuk
 * mengubah batas hari dan label tanggal. Semua fungsi di sini murni (tanpa
 * database / Next.js) agar dapat diuji langsung dengan `node --test`.
 */

export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

function toEpoch(value: Date | number | string): number | null {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Awal hari WIB yang memuat `input`, dikembalikan sebagai epoch UTC. */
export function startOfDayWib(input: Date | number | string = Date.now()): number {
  const ms = toEpoch(input);
  if (ms === null) return Number.NaN;
  const shifted = new Date(ms + WIB_OFFSET_MS);
  return (
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
    WIB_OFFSET_MS
  );
}

/**
 * Awal jendela `days` hari yang berakhir pada hari WIB saat ini.
 * Contoh: `days = 7` menghasilkan 7 titik harian termasuk hari ini.
 */
export function startOfDaysWindowWib(days: number, now: Date | number = Date.now()): number {
  const normalizedDays = Number.isFinite(days) ? Math.max(1, Math.floor(days)) : 1;
  return startOfDayWib(now) - (normalizedDays - 1) * DAY_MS;
}

/** `YYYY-MM-DD` menurut WIB, atau null bila timestamp tidak valid. */
export function wibDayKey(iso: string | number | Date): string | null {
  const ms = toEpoch(iso);
  if (ms === null) return null;
  return new Date(ms + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Format tanggal saja (`YYYY-MM-DD`) menurut WIB. */
export function formatWibDateOnly(input: Date | number | string = Date.now()): string | null {
  return wibDayKey(input);
}

/** Format `YYYY-MM-DD HH:mm:ss` menurut WIB untuk sel CSV. */
export function formatWibDateTime(input: Date | number | string): string | null {
  const ms = toEpoch(input);
  if (ms === null) return null;
  return new Date(ms + WIB_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Parse tanggal kalender `YYYY-MM-DD` sebagai awal hari WIB.
 *
 * Pemeriksaan round-trip menolak tanggal yang "digulung" JavaScript seperti
 * `2026-02-31`, sehingga filter tanggal tidak diam-diam berubah arti.
 */
export function parseWibDateOnly(raw: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const ms = new Date(`${raw}T00:00:00+07:00`).getTime();
  if (!Number.isFinite(ms)) return null;
  return wibDayKey(ms) === raw ? ms : null;
}
