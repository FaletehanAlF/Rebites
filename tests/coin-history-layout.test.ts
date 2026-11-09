import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readProjectFile(relativePath: string): string {
    return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('halaman koin menyisakan ruang bawah untuk navigasi ponsel', () => {
    const view = readProjectFile('app/components/shared/coin-history-view.tsx');
    assert.ok(view.includes('min-h-screen bg-white pb-28 lg:pb-12'), 'tanpa ruang bawah, baris transaksi terakhir tertutup navigasi bawah yang menempel di layar');
});

test('halaman koin memasang BuyerShell tanpa mematikan navigasi bawah', () => {
    const page = readProjectFile('app/pengaturan/coin/page.tsx');
    assert.ok(page.includes('<BuyerShell>'), 'ruang bawah hanya diperlukan kalau navigasi bawah memang dipasang');
    assert.ok(!page.includes('showBottomNav={false}'), 'navigasi bawah aktif di halaman ini');
});
