/**
 * Regresi jadwal menu — lokal, tanpa database, tanpa jaringan.
 *
 * Fokus:
 * 1. Produk yang dijadwalkan belum boleh tayang sebelum `scheduled_start`.
 * 2. Produk yang jadwalnya berakhir tidak boleh tayang lagi.
 * 3. Tanggal dari input tanggal dibaca sebagai hari WIB, bukan UTC.
 * 4. Tanggal dari database (UTC) dikembalikan ke tanggal WIB yang benar.
 *
 * Jalankan: node --test tests/menu-schedule.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatScheduleDate,
  isMenuScheduleVisible,
  isScheduleRangeValid,
  resolveMenuScheduleStatus,
  scheduleEndToIso,
  scheduleStartToIso,
  toScheduleDateInput,
} from '../lib/menu-schedule.ts';

// 2 November 2026 12:00 WIB = 05:00 UTC.
const NOON_WIB = Date.UTC(2026, 10, 2, 5, 0, 0);

test('tanpa jadwal: menu dianggap tayang seperti biasa', () => {
  assert.equal(resolveMenuScheduleStatus({}, NOON_WIB), 'none');
  assert.equal(isMenuScheduleVisible({}, NOON_WIB), true);
});

test('sebelum scheduled_start: menu terjadwal dan belum tayang', () => {
  const schedule = { scheduledStart: '2026-11-05T00:00:00+07:00' };
  assert.equal(resolveMenuScheduleStatus(schedule, NOON_WIB), 'scheduled');
  assert.equal(isMenuScheduleVisible(schedule, NOON_WIB), false);
});

test('di dalam rentang: menu tayang', () => {
  const schedule = {
    scheduledStart: '2026-11-01T00:00:00+07:00',
    scheduledEnd: '2026-11-03T23:59:59+07:00',
  };
  assert.equal(resolveMenuScheduleStatus(schedule, NOON_WIB), 'active');
  assert.equal(isMenuScheduleVisible(schedule, NOON_WIB), true);
});

test('setelah scheduled_end: menu berakhir dan tidak tayang', () => {
  const schedule = { scheduledEnd: '2026-11-01T23:59:59+07:00' };
  assert.equal(resolveMenuScheduleStatus(schedule, NOON_WIB), 'ended');
  assert.equal(isMenuScheduleVisible(schedule, NOON_WIB), false);
});

test('input tanggal menjadi awal dan akhir hari WIB', () => {
  assert.equal(scheduleStartToIso('2026-11-02'), '2026-11-02T00:00:00+07:00');
  assert.equal(scheduleEndToIso('2026-11-02'), '2026-11-02T23:59:59+07:00');
});

test('tanggal selesai inklusif sampai 23:59 WIB', () => {
  const schedule = {
    scheduledStart: scheduleStartToIso('2026-11-02'),
    scheduledEnd: scheduleEndToIso('2026-11-02'),
  };
  assert.equal(
    resolveMenuScheduleStatus(schedule, Date.UTC(2026, 10, 2, 16, 0, 0)),
    'active',
    'pukul 23:00 WIB pada tanggal terakhir masih tayang'
  );
  assert.equal(
    resolveMenuScheduleStatus(schedule, Date.UTC(2026, 10, 2, 17, 0, 1)),
    'ended',
    'setelah 00:00 WIB hari berikutnya sudah berakhir'
  );
});

test('ISO dari database dikembalikan ke tanggal WIB, bukan UTC', () => {
  // 3 Nov 2026 00:00 WIB disimpan/ dikembalikan PostgREST sebagai 2 Nov 17:00 UTC.
  assert.equal(toScheduleDateInput('2026-11-02T17:00:00+00:00'), '2026-11-03');
  assert.equal(formatScheduleDate('2026-11-02T17:00:00+00:00'), '3 November 2026');
});

test('nilai kosong/tidak valid tidak menghasilkan jadwal palsu', () => {
  assert.equal(scheduleStartToIso(''), null);
  assert.equal(scheduleStartToIso('bukan-tanggal'), null);
  assert.equal(scheduleEndToIso(null), null);
  assert.equal(toScheduleDateInput('bukan-tanggal'), '');
  assert.equal(resolveMenuScheduleStatus({ scheduledStart: 'x' }, NOON_WIB), 'none');
});

test('rentang tanggal: selesai tidak boleh mendahului mulai', () => {
  assert.equal(isScheduleRangeValid('2026-11-02', '2026-11-02'), true);
  assert.equal(isScheduleRangeValid('2026-11-02', '2026-11-05'), true);
  assert.equal(isScheduleRangeValid('2026-11-05', '2026-11-02'), false);
  assert.equal(isScheduleRangeValid('2026-11-02', null), true);
});
