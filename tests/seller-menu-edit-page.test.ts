import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}

function projectFileExists(relativePath: string): boolean {
    return existsSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)));
}

const PAGE = readProjectFile('app/(app)/dashboard/penjual/[storeId]/menu/page.tsx');
const FORM = readProjectFile('app/components/seller/tambahMenu/EditProductForm.tsx');
const LEGACY_PAGE = readProjectFile('app/(app)/dashboard/penjual/menu/page.tsx');

test('ikon pensil kartu menu pindah halaman, bukan membuka dialog', () => {
    assert.doesNotMatch(PAGE, /EditProductModal/);
    assert.match(PAGE, /editHref/);
    assert.match(PAGE, /<Link href=\{editHref\}/);
});

test('halaman ubah menu benar-benar ada di kedua bentuk rute', () => {
    assert.ok(projectFileExists('app/(app)/dashboard/penjual/[storeId]/menu/[id]/edit/page.tsx'));
    assert.ok(projectFileExists('app/(app)/dashboard/penjual/menu/[id]/edit/page.tsx'));
    assert.ok(projectFileExists('app/components/seller/tambahMenu/EditMenuPage.tsx'));
});

test('form ubah menu dipisah dari dialognya, jadi bisa dipakai sebagai halaman', () => {
    assert.match(FORM, /export function EditProductForm\(/);
    assert.doesNotMatch(FORM, /<Dialog/);
    assert.doesNotMatch(FORM, /DialogContent/);
    assert.equal(projectFileExists('app/components/seller/tambahMenu/EditProductModal.tsx'), false);
});

test('rute Menu Saya tanpa id toko mengalihkan ke rute kanonik', () => {
    assert.match(LEGACY_PAGE, /SellerStoreRedirect/);
    assert.match(LEGACY_PAGE, /sub="menu"/);
});

test('Flash Sale disetel lewat satu ikon pensil, tanpa teks detail yang membingungkan', () => {
    assert.match(PAGE, /aria-label=\{`Atur Flash Sale \$\{product\.name\}`\}/);
    assert.doesNotMatch(PAGE, /Lihat detail/);
    assert.doesNotMatch(PAGE, /Sembunyikan detail/);
    assert.doesNotMatch(PAGE, /showDetails/);
});

test('pengatur Flash Sale masih menawarkan keluar, jadi tidak ada jalan buntu', () => {
    assert.match(PAGE, /Keluar dari Flash Sale/);
    assert.match(PAGE, /removeFlashSale\(product\.id\)/);
});
