import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isVendorReallyOpen, orderVendorsOpenFirst, } from '../lib/store-status.ts';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
const SECTION = readProjectFile('app/components/home/VendorSection.tsx');
const CARD = readProjectFile('app/components/home/VendorCard.tsx');
const HOME_PAGE = readProjectFile('app/(app)/home/page.tsx');
const FOOTER = readProjectFile('app/components/shared/app-footer.tsx');
const CLOSED = { id: 'tutup', isOpen: false, openHours: null };
const OPEN = { id: 'buka', isOpen: true, openHours: null };
test('toko tutup tetap ada di daftar beranda, hanya turun urutannya', () => {
    const ordered = orderVendorsOpenFirst([CLOSED, OPEN]);
    assert.equal(ordered.length, 2);
    assert.deepEqual(ordered.map((vendor) => vendor.id), ['buka', 'tutup']);
});
test('mengurutkan tidak mengubah array milik pemanggil', () => {
    const input = [CLOSED, OPEN];
    orderVendorsOpenFirst(input);
    assert.deepEqual(input.map((vendor) => vendor.id), ['tutup', 'buka']);
});
test('paket prioritas naik di dalam kelompoknya, bukan melompati toko buka', () => {
    const vendors = [
        { id: 'biasa-buka', isOpen: true, openHours: null },
        { id: 'prioritas-tutup', isOpen: false, openHours: null },
        { id: 'prioritas-buka', isOpen: true, openHours: null },
    ];
    const denganPrioritasBuka = orderVendorsOpenFirst(vendors, 'prioritas-buka');
    assert.equal(denganPrioritasBuka[0].id, 'prioritas-buka');
    assert.equal(denganPrioritasBuka.at(-1)?.id, 'prioritas-tutup');
    const denganPrioritasTutup = orderVendorsOpenFirst(vendors, 'prioritas-tutup');
    assert.equal(denganPrioritasTutup[0].id, 'biasa-buka');
    assert.equal(denganPrioritasTutup.at(-1)?.id, 'prioritas-tutup');
});
test('status buka tetap dihitung dari toggle penjual', () => {
    assert.equal(isVendorReallyOpen({ isOpen: false, openHours: '08.00-21.00' }), false);
});
test('bagian toko tidak menyaring toko tutup lagi', () => {
    assert.doesNotMatch(SECTION, /isVendorReallyOpen/);
    assert.match(SECTION, /orderVendorsOpenFirst/);
    assert.doesNotMatch(SECTION, /Belum ada toko yang buka/);
});
test('kartu toko menandai keadaan tutup di tengah foto', () => {
    assert.match(CARD, /Toko sudah tutup/);
    assert.match(CARD, /absolute inset-0 flex items-center justify-center/);
    assert.match(CARD, /bg-forest-900\/70/);
    assert.doesNotMatch(CARD, /'Tutup'/);
});
test('halaman beranda pembeli tidak memasang footer terpadu', () => {
    assert.doesNotMatch(HOME_PAGE, /AppFooter/);
});
test('footer menyisakan ruang agar tidak tertutup tombol asisten', () => {
    assert.match(FOOTER, /pb-\[calc\(4\.5rem\+env\(safe-area-inset-bottom\)\)\]/);
    assert.match(FOOTER, /lg:pb-0/);
});
test('setiap tautan footer menunjuk tujuan internal, bukan placeholder', () => {
    const hrefs = Array.from(FOOTER.matchAll(/href: "([^"]+)"/g)).map((match) => match[1]);
    assert.ok(hrefs.length >= 3, 'footer butuh tautan yang benar-benar dipakai');
    for (const href of hrefs) {
        assert.match(href, /^\//, `${href} harus path internal`);
        assert.notEqual(href, '#');
    }
});
