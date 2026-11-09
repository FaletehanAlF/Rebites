import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readProjectFile(relativePath: string): string {
    return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('halaman detail toko menyisakan ruang bawah untuk navigasi ponsel', () => {
    const page = readProjectFile('app/(app)/detail/toko/page.tsx');
    assert.ok(page.includes('pb-[calc(4.5rem+env(safe-area-inset-bottom))]'), 'tanpa ruang bawah, ulasan terakhir tertutup navigasi bawah yang menempel di layar');
    assert.ok(page.includes('lg:pb-0'), 'di desktop navigasi bawah tidak tampil');
});

test('halaman detail toko memasang navigasi bawah pembeli', () => {
    const page = readProjectFile('app/(app)/detail/toko/page.tsx');
    assert.ok(page.includes('<BuyerShell>'), 'ruang bawah hanya diperlukan kalau navigasi bawah memang dipasang');
    assert.ok(!page.includes('showBottomNav={false}'), 'navigasi bawah aktif di halaman ini');
});
