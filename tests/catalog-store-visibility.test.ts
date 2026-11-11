import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
// Toko yang dinonaktifkan admin (is_active=false) atau dihapus soft-delete
// (deleted_at terisi) tidak boleh muncul di beranda maupun pencarian —
// termasuk saat admin/pemilik toko yang sedang login, karena RLS database
// tetap menampakkan baris itu untuk mereka.
const CATALOG = readProjectFile('lib/catalog.ts');
const FLASH_SALE = readProjectFile('lib/flash-sale.ts');
const DETAIL_DATA = readProjectFile('app/components/buyer/detail-product/detail-data.ts');
test('daftar toko beranda hanya mengambil toko aktif dan belum dihapus', () => {
    assert.match(CATALOG, /from\('umkm_profiles'\)[\s\S]{0,200}\.eq\('is_active', true\)/);
    assert.match(CATALOG, /from\('umkm_profiles'\)[\s\S]{0,200}\.is\('deleted_at', null\)/);
    assert.match(CATALOG, /filter\(\(row: UmkmRow\) => row\.is_active !== false && !row\.deleted_at\)/);
});
test('produk yang di-embed wajib membawa status tokonya untuk disaring', () => {
    assert.match(CATALOG, /umkm:umkm_profiles\(business_name, is_active, deleted_at\)/);
    assert.equal(CATALOG.match(/umkm:umkm_profiles\(business_name\)(?!, is_active)/g), null);
});
test('produk toko nonaktif/terhapus dibuang dari katalog dan kategori', () => {
    assert.match(CATALOG, /function hasActiveStore\(row: ProductRow\): boolean \{[\s\S]*?is_active === false[\s\S]*?deleted_at[\s\S]*?\n\}/);
    const countBlock = CATALOG.match(/export async function fetchCategoryCounts[\s\S]*?\n\}/)?.[0] ?? '';
    assert.match(countBlock, /hasActiveStore\(row as ProductRow\)/);
});
test('flash sale tidak menampilkan produk toko nonaktif/terhapus', () => {
    assert.match(FLASH_SALE, /umkm:umkm_profiles\(business_name, is_active, deleted_at\)/);
    assert.match(FLASH_SALE, /store\.is_active !== false && !store\.deleted_at/);
});
test('produk terkait di halaman detail ikut disaring status tokonya', () => {
    assert.match(DETAIL_DATA, /umkm:umkm_profiles\(business_name, is_active, deleted_at\)/);
    assert.match(DETAIL_DATA, /row\.umkm\.is_active !== false && !row\.umkm\.deleted_at/);
});
