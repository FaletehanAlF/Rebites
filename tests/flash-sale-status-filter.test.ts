import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesFlashStatus } from '../lib/flash-sale-status.ts';
const PAGI = {
    startIso: '2026-11-08T09:00:00+07:00',
    endIso: '2026-11-08T12:00:00+07:00',
};
const SORE = {
    startIso: '2026-11-08T15:00:00+07:00',
    endIso: '2026-11-08T18:00:00+07:00',
};
const NOW = Date.parse('2026-11-08T10:00:00+07:00');
test('filter Semua meloloskan item apa pun', () => {
    assert.equal(matchesFlashStatus({}, 'Semua', PAGI, NOW), true);
    assert.equal(matchesFlashStatus({ startsAt: '2026-11-08T15:00:00+07:00' }, 'Semua', PAGI, NOW), true);
});
test('item tanpa jadwal sendiri memakai batas slot yang sedang dibuka', () => {
    assert.equal(matchesFlashStatus({}, 'Berlangsung', PAGI, NOW), true);
    assert.equal(matchesFlashStatus({}, 'Akan Datang', PAGI, NOW), false);
});
test('slot yang belum mulai tidak muncul di filter Berlangsung', () => {
    assert.equal(matchesFlashStatus({}, 'Berlangsung', SORE, NOW), false);
    assert.equal(matchesFlashStatus({}, 'Akan Datang', SORE, NOW), true);
});
test('slot yang sudah lewat tidak muncul di kedua filter', () => {
    const lewat = {
        startIso: '2026-11-07T09:00:00+07:00',
        endIso: '2026-11-07T12:00:00+07:00',
    };
    assert.equal(matchesFlashStatus({}, 'Berlangsung', lewat, NOW), false);
    assert.equal(matchesFlashStatus({}, 'Akan Datang', lewat, NOW), false);
});
test('jadwal flash sale milik penjual menang atas batas slot', () => {
    const mulai = { startsAt: '2026-11-08T16:00:00+07:00', endsAt: '2026-11-08T17:00:00+07:00' };
    assert.equal(matchesFlashStatus(mulai, 'Berlangsung', PAGI, NOW), false);
    assert.equal(matchesFlashStatus(mulai, 'Akan Datang', PAGI, NOW), true);
    const jalan = { startsAt: '2026-11-08T09:30:00+07:00', endsAt: '2026-11-08T11:00:00+07:00' };
    assert.equal(matchesFlashStatus(jalan, 'Berlangsung', SORE, NOW), true);
    assert.equal(matchesFlashStatus(jalan, 'Akan Datang', SORE, NOW), false);
});
test('jadwal rusak diperlakukan sebagai tanpa jadwal, bukan menghilang', () => {
    assert.equal(matchesFlashStatus({ startsAt: 'bukan-tanggal' }, 'Berlangsung', PAGI, NOW), true);
    assert.equal(matchesFlashStatus({ endsAt: 'bukan-tanggal' }, 'Berlangsung', PAGI, NOW), true);
});
