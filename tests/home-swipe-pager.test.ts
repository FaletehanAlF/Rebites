import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { arahGeser, arahRoda, halamanBerikut, GESER_MIN_PX, RODA_MIN_PX } from '../lib/use-swipe-pager.ts';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\\r\\n/g, '\\n');
}
const SWIPE = readProjectFile('lib/use-swipe-pager.ts');

test('geser mendatar yang cukup jauh mengganti halaman, ke arah yang benar', () => {
    assert.equal(arahGeser(-120, 4), 1, 'geser ke kiri harus maju ke halaman berikutnya');
    assert.equal(arahGeser(120, -4), -1, 'geser ke kanan harus mundur ke halaman sebelumnya');
});

test('gerakan yang terlalu pendek bukan geseran', () => {
    assert.equal(arahGeser(GESER_MIN_PX - 1, 0), 0);
    assert.equal(arahGeser(0, 0), 0);
    assert.equal(arahGeser(-GESER_MIN_PX + 1, 0), 0);
    assert.equal(arahRoda(RODA_MIN_PX - 1, 0), 0);
});

test('menggeser layar ke atas-bawah tidak ikut memindah halaman', () => {
    assert.equal(arahGeser(70, 200), 0, 'geseran dominan vertikal harus diabaikan');
    assert.equal(arahGeser(-70, 200), 0);
    assert.equal(arahRoda(30, 240), 0, 'guliran mendatar harus benar-benar mendatar');
    assert.equal(arahRoda(0, 240), 0);
});

test('arah geser menang saat gerak mendatar lebih besar daripada vertikal', () => {
    assert.equal(arahGeser(-200, 120), 1);
    assert.equal(arahGeser(200, -120), -1);
    assert.equal(arahRoda(-60, 20), -1);
    assert.equal(arahRoda(60, 20), 1);
});

test('halaman dijepit di ujung: tidak bisa keluar dari rentang', () => {
    assert.equal(halamanBerikut(1, -1, 3), null, 'halaman pertama tidak punya sebelumnya');
    assert.equal(halamanBerikut(3, 1, 3), null, 'halaman terakhir tidak punya berikutnya');
    assert.equal(halamanBerikut(2, 1, 3), 3);
    assert.equal(halamanBerikut(2, -1, 3), 1);
    assert.equal(halamanBerikut(1, 1, 1), null, 'satu halaman tidak bisa berpindah');
});

test('masukan bukan angka tidak pernah memindahkan halaman', () => {
    assert.equal(arahGeser(Number.NaN, 0), 0);
    assert.equal(arahRoda(Number.POSITIVE_INFINITY, 0), 0);
    assert.equal(arahGeser(Number.NaN, Number.NaN), 0);
});

test('ketukan biasa (bukan geseran) tetap memicu klik pada kartu/tombol', () => {
    // Penangkap pointer dapat menelan klik sintetis browser; pastikan ada
    // pemicuan klik manual saat tidak ada geseran agar kartu menu bisa diklik.
    assert.match(SWIPE, /closest\?\.\('button, \[role="button"\]'\)/);
    assert.match(SWIPE, /\.click\(\)/);
    assert.match(SWIPE, /telanSintetis/);
});
