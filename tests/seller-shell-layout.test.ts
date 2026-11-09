import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readProjectFile(relativePath: string): string {
    return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('isi dashboard penjual menyisakan ruang bawah untuk navigasi ponsel', () => {
    const shell = readProjectFile('app/components/dashboard-penjual/SellerShell.tsx');
    assert.ok(shell.includes('pb-[calc(4.5rem+env(safe-area-inset-bottom))]'), 'tanpa ruang bawah, kartu terakhir tertutup navigasi bawah yang menempel di layar');
    assert.ok(shell.includes('lg:pb-0'), 'di desktop navigasi bawah tidak tampil');
});

test('navigasi bawah penjual dipasang selama drawer tertutup', () => {
    const shell = readProjectFile('app/components/dashboard-penjual/SellerShell.tsx');
    assert.ok(shell.includes('<MobileSellerNav storeId={storeId} />'), 'navigasi bawah penjual memasang tautan ke halaman lain');
});
