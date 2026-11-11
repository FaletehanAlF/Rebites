import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
// Klik kartu menu unggulan / tombol "Lihat Detail" di beranda harus selalu
// menuju halaman detail produk. Pembersihan status toko tutup cukup terjadi
// di halaman detail saat mencoba memesan.
const CARD = readProjectFile('app/components/shared/FoodCard.tsx');
const HOME = readProjectFile('app/(app)/home/page.tsx');
const CATALOG = readProjectFile('lib/catalog.ts');
test('kartu menu tidak lagi memblokir navigasi dengan modal toko tutup', () => {
    assert.doesNotMatch(CARD, /openStoreClosedModal/);
    assert.doesNotMatch(CARD, /isStoreOpen/);
    assert.match(CARD, /onViewDetail\(item\.id\)/);
    assert.match(CARD, /router\.push\(\s*`\/detail\/product\?id=/);
});
test('beranda tidak lagi memasang modal toko tutup yang tidak terpakai', () => {
    assert.doesNotMatch(HOME, /StoreClosedModal/);
    assert.doesNotMatch(HOME, /useStoreClosedModal/);
});
test('query produk & toko di katalog hanya menarik kolom minimal, bukan select bintang', () => {
    // select('*') yang sah hanya ada di query promo_codes — periksa per tabel.
    const segmen = CATALOG.split('.from(').slice(1);
    let queryProducts = 0;
    let queryUmkm = 0;
    for (const seg of segmen) {
        const tabel = seg.slice(0, seg.indexOf(')'));
        if (tabel === "'products'") {
            queryProducts += 1;
            assert.doesNotMatch(seg, /\.select\(\s*'\*'\s*\)/, 'query products memakai select(*)');
        }
        if (tabel === "'umkm_profiles'") {
            queryUmkm += 1;
            assert.doesNotMatch(seg, /\.select\(\s*'\*'\s*\)/, 'query umkm_profiles memakai select(*)');
            assert.match(seg, /\.select\(VENDOR_COLUMNS\)/, 'query umkm_profiles tidak memakai VENDOR_COLUMNS');
        }
    }
    assert.ok(queryProducts >= 3, `query products hilang, ketemu ${queryProducts}`);
    assert.ok(queryUmkm >= 1, `query umkm_profiles hilang, ketemu ${queryUmkm}`);
    for (const kolom of [
        'sell_window_start',
        'stock',
        'discount_percent',
        'umkm:umkm_profiles(business_name, is_active, deleted_at)',
    ]) {
        assert.match(CATALOG, new RegExp(kolom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
});
