/**
 * Jadwal ketersediaan menu (products.scheduled_start/scheduled_end).
 *
 * Modul MURNI tanpa dependensi runtime agar dapat diuji dengan `node --test`.
 *
 * Semantik:
 * - `scheduled_start` = waktu paling awal menu boleh tayang.
 * - `scheduled_end`   = waktu paling akhir menu masih tayang (inklusif).
 * - Keduanya NULL     = menu tidak dijadwalkan (perilaku lama).
 * - Tanggal dari `<input type="date">` selalu dibaca sebagai tanggal WIB,
 *   sehingga `2026-11-02` berarti 00:00 WIB s.d. 23:59:59 WIB, bukan UTC.
 *
 * Tanggal WIB dipakai karena seluruh jam jual dan flash sale ReBites memakai
 * Asia/Jakarta. Menyimpannya sebagai UTC tengah malam membuat menu baru tayang
 * pukul 07:00 WIB dan tanggal "sampai" berakhir terlalu cepat.
 */

export const WIB_TIME_ZONE = 'Asia/Jakarta';

export type MenuScheduleStatus = 'none' | 'scheduled' | 'active' | 'ended';

export interface MenuSchedule {
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseTimeMs(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isValidDateOnly(value: string): boolean {
  const match = DATE_ONLY_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Status jadwal pada waktu tertentu. */
export function resolveMenuScheduleStatus(
  schedule: MenuSchedule,
  now: number = Date.now()
): MenuScheduleStatus {
  const start = parseTimeMs(schedule.scheduledStart);
  const end = parseTimeMs(schedule.scheduledEnd);
  if (start === null && end === null) return 'none';
  if (start !== null && now < start) return 'scheduled';
  if (end !== null && now > end) return 'ended';
  return 'active';
}

/** true bila menu boleh dilihat pembeli menurut jadwalnya. */
export function isMenuScheduleVisible(
  schedule: MenuSchedule,
  now: number = Date.now()
): boolean {
  const status = resolveMenuScheduleStatus(schedule, now);
  return status === 'none' || status === 'active';
}

/**
 * Ubah nilai `<input type="date">` (YYYY-MM-DD) menjadi awal hari WIB.
 * Nilai ISO lengkap (mis. hasil baca database) diteruskan apa adanya.
 */
export function scheduleStartToIso(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (isValidDateOnly(trimmed)) return `${trimmed}T00:00:00+07:00`;
  return parseTimeMs(trimmed) !== null ? trimmed : null;
}

/**
 * Ubah nilai `<input type="date">` menjadi akhir hari WIB (23:59:59).
 * Dengan begitu tanggal "sampai" tetap inklusif untuk seluruh hari itu.
 */
export function scheduleEndToIso(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (isValidDateOnly(trimmed)) return `${trimmed}T23:59:59+07:00`;
  return parseTimeMs(trimmed) !== null ? trimmed : null;
}

/**
 * Nilai untuk `<input type="date">`: tanggal pada zona Asia/Jakarta.
 * Database mengembalikan timestamptz dalam UTC, jadi `.slice(0, 10)` bisa
 * menghasilkan tanggal sehari sebelumnya untuk awal hari WIB.
 */
export function toScheduleDateInput(value: string | null | undefined): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const trimmed = value.trim();
  if (isValidDateOnly(trimmed)) return trimmed;

  const ms = parseTimeMs(trimmed);
  if (ms === null) return '';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: WIB_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const year = pick('year');
  const month = pick('month');
  const day = pick('day');
  return year && month && day ? `${year}-${month}-${day}` : '';
}

/**
 * Tanggal hari ini pada zona WIB, untuk nilai awal `<input type="date">`.
 * Jangan memakai `new Date().toISOString().slice(0, 10)`: antara pukul 00:00
 * dan 06:59 WIB tanggal UTC masih kemarin, sehingga menu baru terjadwal mundur
 * sehari.
 */
export function todayScheduleDateInput(now: number = Date.now()): string {
  return toScheduleDateInput(new Date(now).toISOString());
}

/** Label tanggal ramah baca, mis. "2 November 2026". */
export function formatScheduleDate(value: string | null | undefined): string {
  const input = toScheduleDateInput(value);
  if (!input) return '';
  const [year, month, day] = input.split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** true bila rentang tanggal valid (selesai tidak mendahului mulai). */
export function isScheduleRangeValid(
  start: string | null | undefined,
  end: string | null | undefined
): boolean {
  const startIso = scheduleStartToIso(start);
  const endIso = scheduleEndToIso(end);
  if (!startIso || !endIso) return true;
  const startMs = parseTimeMs(startIso);
  const endMs = parseTimeMs(endIso);
  if (startMs === null || endMs === null) return true;
  return endMs >= startMs;
}
