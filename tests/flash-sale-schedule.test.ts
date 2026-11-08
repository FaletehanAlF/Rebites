/**
 * Regresi jadwal Flash Sale — lokal, tanpa database, tanpa jaringan.
 *
 * Fokus:
 * 1. Slot mengikuti tanggal WIB, bukan UTC.
 * 2. Tanggal berikutnya dihitung benar saat slot lewat.
 * 3. Validasi menolak jadwal yang sudah berakhir atau tidak cocok menu.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  todayWibDate,
  addWibDays,
  flashSlotRange,
  isFlashSlotPast,
  isFlashSlotCurrent,
  nextFlashSlotStart,
  formatFlashScheduleLabel,
  formatWibMoment,
  validateFlashSaleSchedule,
} from '../lib/flash-sale-schedule.ts';

// 2 Nov 2026 09.00 WIB
const START_SIANG = '2026-11-02T12:00:00+07:00';
// 2 Nov 2026 15.00 WIB (slot Sore)
const START_SORE = '2026-11-02T15:00:00+07:00';
// 3 Nov 2026 09.00 WIB (besok pagi)
const START_BESOK = '2026-11-03T09:00:00+07:00';

const NOV_2_NOON = Date.UTC(2026, 10, 2, 5, 0, 0); // 12:00 WIB
const NOV_2_10AM = Date.UTC(2026, 10, 2, 3, 0, 0); // 10:00 WIB

test('todayWibDate memakai tanggal WIB', () => {
  assert.equal(todayWibDate(NOV_2_NOON), '2026-11-02');
});

test('addWibDays menambah tanggal WIB', () => {
  assert.equal(addWibDays('2026-11-02', 1), '2026-11-03');
  assert.equal(addWibDays('2026-11-30', 2), '2026-12-02');
});

test('flashSlotRange menghitung slot pada tanggal WIB', () => {
  const range = flashSlotRange('2026-11-02', '12-15');
  assert.notStrictEqual(range, null);
  assert.equal(range!.startIso, '2026-11-02T12:00:00+07:00');
  assert.equal(range!.endIso, '2026-11-02T15:00:00+07:00');
});

test('isFlashSlotPast benar saat slot sudah lewat', () => {
  // Pukul 10:00 WIB (slot pagi 09-12 belum lewat)
  assert.equal(isFlashSlotPast('2026-11-02', '09-12', NOV_2_10AM), false);
  // Pukul 12:01 WIB (slot pagi sudah lewat)
  assert.equal(isFlashSlotPast('2026-11-02', '09-12', NOV_2_NOON), true);
});

test('isFlashSlotCurrent benar saat berada di dalam slot', () => {
  assert.equal(isFlashSlotCurrent('2026-11-02', '09-12', NOV_2_10AM), true);
  assert.equal(isFlashSlotCurrent('2026-11-02', '12-15', NOV_2_NOON), true);
});

test('formatFlashScheduleLabel menghasilkan label lengkap', () => {
  assert.ok(formatFlashScheduleLabel(START_SORE).includes('Sore'));
  assert.ok(formatFlashScheduleLabel(START_BESOK).includes('Besok'));
});

test('validateFlashSaleSchedule menolak jadwal lewat', () => {
  assert.strictEqual(
    validateFlashSaleSchedule({
      startIso: '2026-10-01T09:00:00+07:00',
      endIso: '2026-10-01T12:00:00+07:00',
      now: NOV_2_NOON,
    }),
    'Jadwal Flash Sale sudah berakhir. Pilih tanggal dan slot berikutnya.'
  );
});

test('validateFlashSaleSchedule menolak jadwal sebelum menu tayang', () => {
  const result = validateFlashSaleSchedule({
    startIso: '2026-11-02T09:00:00+07:00',
    endIso: '2026-11-02T13:00:00+07:00',
    scheduledStart: '2026-11-02T11:00:00+07:00',
    scheduledEnd: '2026-11-02T15:00:00+07:00',
    now: NOV_2_NOON,
  });
  assert.ok(result !== null);
  assert.ok(result!.includes('dimulai sebelum menu tayang'));
});

test('validateFlashSaleSchedule menerima jadwal valid', () => {
  assert.strictEqual(
    validateFlashSaleSchedule({
      startIso: START_SIANG,
      endIso: '2026-11-02T15:00:00+07:00',
      scheduledStart: '2026-11-02T09:00:00+07:00',
      scheduledEnd: '2026-11-02T18:00:00+07:00',
      now: NOV_2_NOON,
    }),
    null
  );
});

test('formatWibMoment menampilkan WIB', () => {
  assert.ok(formatWibMoment(Date.parse('2026-11-02T09:00:00+07:00')).includes('WIB'));
});
