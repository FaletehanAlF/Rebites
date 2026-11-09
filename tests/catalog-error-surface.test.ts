import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function readProjectFile(relative: string): string {
    return readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
}

function errorBeforeEmpty(source: string, errorMarker: string, emptyMarker: string): boolean {
    const errorAt = source.indexOf(errorMarker);
    const emptyAt = source.indexOf(emptyMarker);
    return errorAt !== -1 && emptyAt !== -1 && errorAt < emptyAt;
}

test('pemeriksa urutan menangkap cabang kosong yang mendahului cabang gagal', () => {
    assert.equal(errorBeforeEmpty('kosong : catalogError ? gagal', 'catalogError ?', 'kosong'), false);
    assert.equal(errorBeforeEmpty('catalogError ? gagal : kosong', 'catalogError ?', 'kosong'), true);
    assert.equal(errorBeforeEmpty('catalogError ? gagal', 'catalogError ?', 'kosong'), false);
});

test('useCatalog membawa error katalog dan tidak meninggalkan skeleton menggantung', () => {
    const source = readProjectFile('lib/catalog.ts');
    assert.match(source, /export interface CatalogData \{[\s\S]*?error: string \| null;/);
    assert.match(source, /error: foodResult\.error \?\?/);
    assert.match(source, /urgentResult\.error \?\?/);
    assert.match(source, /vendorResult\.error \?\?/);
    assert.match(source, /setData\(\{ \.\.\.EMPTY_CATALOG, error: CATALOG_ERROR_MESSAGE \}\)/);
    assert.match(source, /finally \{\s*setLoading\(false\);/);
});

test('beranda: cabang gagal muncul sebelum cabang kosong, dengan Coba lagi', () => {
    const vendor = readProjectFile('app/components/home/VendorSection.tsx');
    assert.equal(errorBeforeEmpty(vendor, 'Gagal memuat daftar toko', '!loading && !catalogError && sortedVendors.length === 0'), true);
    assert.ok(vendor.includes('Coba lagi'));
    assert.ok(vendor.includes('refreshCatalog()'));

    const urgent = readProjectFile('app/components/home/UrgentDealsSection.tsx');
    assert.equal(errorBeforeEmpty(urgent, 'Gagal memuat daftar menu', '!loading && !catalogError && items.length === 0'), true);
    assert.ok(urgent.includes('Coba lagi'));
    assert.ok(urgent.includes('refreshCatalog()'));

    const flash = readProjectFile('app/components/home/FlashSaleSection.tsx');
    assert.equal(errorBeforeEmpty(flash, 'Gagal memuat flash sale', '!catalogLoading && !catalogError && visibleItems.length === 0'), true);
    assert.ok(flash.includes('Coba lagi'));
    assert.ok(flash.includes('refreshCatalog()'));
});

test('katalog kategori dan daftar toko: gagal memuat bukan "belum ada"', () => {
    const category = readProjectFile('app/components/makanan-category/category-view.tsx');
    assert.equal(errorBeforeEmpty(category, 'catalogError ?', 'isCategoryEmpty ?'), true);
    assert.ok(category.includes('Gagal memuat makanan'));
    assert.ok(category.includes('refreshCatalog()'));
});

test('detail toko: galat menu toko punya Coba Lagi, bukan daftar kosong', () => {
    const detail = readProjectFile('app/(app)/detail/toko/page.tsx');
    assert.equal(errorBeforeEmpty(detail, 'storeError ?', 'storeProducts.length === 0 ?'), true);
    assert.ok(detail.includes('Menu gagal dimuat'));
    assert.ok(detail.includes('Coba Lagi'));
});

test('toko-diikuti: galat pemuatan daftar toko diikuti ditampilkan sebagai galat', () => {
    const source = readProjectFile('app/toko-diikuti/page.tsx');
    assert.ok(source.includes('Gagal memuat daftar toko'));
    assert.ok(source.includes('loadError'));
});
