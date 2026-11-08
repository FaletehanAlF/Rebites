/**
 * Jadwal Flash Sale berbasis tanggal + slot waktu WIB.
 *
 * Modul MURNI tanpa dependensi runtime (selain helper tanggal menu) agar dapat
 * diuji dengan `node --test`. Semua perhitungan memakai zona Asia/Jakarta:
 * `2026-11-02` berarti tanggal 2 November menurut WIB, bukan UTC.
 */

import { formatScheduleDate, toScheduleDateInput } from './menu-schedule.ts';
import type { UrgentSlot } from './types';

export const WIB_TIME_ZONE = 'Asia/Jakarta';
export const WIB_OFFSET_MS = 7 * 3600 * 1000;
export const DAY_MS = 24 * 3600 * 1000;

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface FlashSlotDef {
  key: UrgentSlot;
  label: string;
  range: string;
  start: number;
  end: number;
}

/** 4 slot waktu Flash Sale. Dipakai juga oleh UI pembeli dan penjual. */
export const FLASH_SLOTS: FlashSlotDef[] = [
  { key: '09-12', label: 'Pagi', range: '09.00–12.00', start: 9, end: 12 },
  { key: '12-15', label: 'Siang', range: '12.00–15.00', start: 12, end: 15 },
  { key: '15-18', label: 'Sore', range: '15.00–18.00', start: 15, end: 18 },
  { key: '18-21', label: 'Malam', range: '18.00–21.00', start: 18, end: 21 },
];

function pad2(value: number): string {
  return String(value).padStart(2, '0');
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

function parseTimeMs(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function dateOnlyToUtc(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Tanggal hari ini menurut WIB dalam format `YYYY-MM-DD`. */
export function todayWibDate(now: number = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: WIB_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(now));
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

/** Geser tanggal WIB sejumlah hari (aman untuk pergantian bulan/tahun). */
export function addWibDays(dateOnly: string, days: number): string {
  if (!isValidDateOnly(dateOnly)) return dateOnly;
  const date = dateOnlyToUtc(dateOnly);
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate()
  )}`;
}

export interface FlashSlotRange {
  startIso: string;
  endIso: string;
}

/** Rentang absolut satu slot pada satu tanggal WIB. */
export function flashSlotRange(
  dateOnly: string,
  slot: UrgentSlot
): FlashSlotRange | null {
  const def = FLASH_SLOTS.find((item) => item.key === slot);
  if (!def || !isValidDateOnly(dateOnly)) return null;
  return {
    startIso: `${dateOnly}T${pad2(def.start)}:00:00+07:00`,
    endIso: `${dateOnly}T${pad2(def.end)}:00:00+07:00`,
  };
}

/** Slot dianggap lewat bila waktu selesainya sudah tercapai. */
export function isFlashSlotPast(
  dateOnly: string,
  slot: UrgentSlot,
  now: number = Date.now()
): boolean {
  const range = flashSlotRange(dateOnly, slot);
  if (!range) return true;
  return new Date(range.endIso).getTime() <= now;
}

export function isFlashSlotCurrent(
  dateOnly: string,
  slot: UrgentSlot,
  now: number = Date.now()
): boolean {
  const range = flashSlotRange(dateOnly, slot);
  if (!range) return false;
  const start = new Date(range.startIso).getTime();
  const end = new Date(range.endIso).getTime();
  return start <= now && now < end;
}

function wibHourOf(iso: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: WIB_TIME_ZONE,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  return Number(parts.find((part) => part.type === 'hour')?.value ?? 0) % 24;
}

export function slotFromStartIso(iso: string): UrgentSlot {
  const hour = wibHourOf(iso);
  if (hour >= 18) return '18-21';
  if (hour >= 15) return '15-18';
  if (hour >= 12) return '12-15';
  return '09-12';
}

/**
 * Slot terdekat pada hari ini; bila slot hari ini sudah lewat, jadwal
 * otomatis digeser ke hari berikutnya. Dulu perilaku ini satu-satunya cara
 * penjual memilih jadwal; sekarang dipertahankan untuk kompatibilitas.
 */
export function slotToWibIso(
  slot: UrgentSlot,
  now: number = Date.now()
): FlashSlotRange {
  const today = todayWibDate(now);
  const todayRange = flashSlotRange(today, slot);
  if (!todayRange) throw new Error('Slot tidak valid');
  if (new Date(todayRange.endIso).getTime() > now) return todayRange;

  const tomorrow = flashSlotRange(addWibDays(today, 1), slot);
  if (!tomorrow) throw new Error('Slot tidak valid');
  return tomorrow;
}

export interface NextFlashSlot {
  date: string;
  slot: UrgentSlot;
  startIso: string;
}

/** Slot berikutnya yang belum dimulai (untuk hitungan mundur section). */
export function nextFlashSlotStart(now: number = Date.now()): NextFlashSlot {
  const today = todayWibDate(now);
  for (let offset = 0; offset <= 1; offset += 1) {
    const date = addWibDays(today, offset);
    for (const def of FLASH_SLOTS) {
      const range = flashSlotRange(date, def.key);
      if (!range) continue;
      if (new Date(range.startIso).getTime() > now) {
        return { date, slot: def.key, startIso: range.startIso };
      }
    }
  }
  // Praktis tidak tercapai (maksimal besok 09.00), tetapi tetap beri nilai.
  const fallbackDate = addWibDays(today, 2);
  const fallback = flashSlotRange(fallbackDate, '09-12');
  return {
    date: fallbackDate,
    slot: '09-12',
    startIso: fallback?.startIso ?? new Date(now).toISOString(),
  };
}

/** Label tanggal pendek: "Hari ini", "Besok", atau "2 Nov 2026". */
export function formatFlashDateLabel(
  value: string | null | undefined,
  now: number = Date.now()
): string {
  const dateOnly = toScheduleDateInput(value);
  if (!dateOnly) return '';
  const today = todayWibDate(now);
  if (dateOnly === today) return 'Hari ini';
  if (dateOnly === addWibDays(today, 1)) return 'Besok';
  return dateOnlyToUtc(dateOnly).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Label jadwal lengkap, mis. "Besok · Pagi 09.00–12.00". */
export function formatFlashScheduleLabel(
  startIso: string,
  now: number = Date.now()
): string {
  const dateLabel = formatFlashDateLabel(startIso, now);
  if (!dateLabel) return '';
  const def = FLASH_SLOTS.find(
    (slot) => slot.key === slotFromStartIso(startIso)
  );
  return def ? `${dateLabel} · ${def.label} ${def.range}` : dateLabel;
}

/** Label singkat untuk tombol, mis. "Besok · 09.00". */
export function formatFlashStartLabel(
  startIso: string,
  now: number = Date.now()
): string {
  const dateLabel = formatFlashDateLabel(startIso, now);
  if (!dateLabel) return '';
  const def = FLASH_SLOTS.find(
    (slot) => slot.key === slotFromStartIso(startIso)
  );
  return def ? `${dateLabel} · ${pad2(def.start)}.00` : dateLabel;
}

/** Waktu lengkap WIB untuk pesan validasi, mis. "2 November 2026 09.00 WIB". */
export function formatWibMoment(ms: number): string {
  const date = new Date(ms);
  const dateLabel = new Intl.DateTimeFormat('id-ID', {
    timeZone: WIB_TIME_ZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat('en-GB', {
    timeZone: WIB_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
  return `${dateLabel} ${timeLabel} WIB`;
}

export interface FlashSaleScheduleInput {
  startIso: string;
  endIso: string;
  now?: number;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
}

/**
 * Validasi jadwal Flash Sale terhadap waktu sekarang dan jadwal tayang menu.
 * Mengembalikan pesan kesalahan, atau `null` bila jadwal boleh disimpan.
 */
export function validateFlashSaleSchedule(
  input: FlashSaleScheduleInput
): string | null {
  const now = input.now ?? Date.now();
  const start = parseTimeMs(input.startIso);
  const end = parseTimeMs(input.endIso);
  if (start === null || end === null) {
    return 'Jadwal Flash Sale tidak valid.';
  }
  if (end <= start) {
    return 'Waktu selesai harus setelah waktu mulai.';
  }
  if (end <= now) {
    return 'Jadwal Flash Sale sudah berakhir. Pilih tanggal dan slot berikutnya.';
  }

  const menuStart = parseTimeMs(input.scheduledStart);
  const menuEnd = parseTimeMs(input.scheduledEnd);

  if (menuEnd !== null && menuEnd < now) {
    return 'Jadwal tayang menu sudah berakhir. Perbarui jadwal menu sebelum mengatur Flash Sale.';
  }
  if (menuStart !== null && start < menuStart) {
    return `Flash Sale dimulai sebelum menu tayang (${formatWibMoment(
      menuStart
    )}). Pilih slot setelah jadwal tayang menu.`;
  }
  if (menuEnd !== null && end > menuEnd) {
    return `Flash Sale melewati jadwal tayang menu (${formatWibMoment(
      menuEnd
    )}). Pilih slot sebelum jadwal menu berakhir.`;
  }
  return null;
}
