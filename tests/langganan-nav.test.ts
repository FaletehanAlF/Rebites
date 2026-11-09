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
const SIDEBAR = readProjectFile('app/components/shared/profile-sidebar-nav.tsx');
const MOBILE_NAV = readProjectFile('app/components/shared/MobileNavbar.tsx');
const BOTTOM_NAV = readProjectFile('app/components/shared/MobileBottomNav.tsx');
const HOME_PAGE = readProjectFile('app/(app)/home/page.tsx');
const DEALS = readProjectFile('app/components/buyer/home/UrgentDealsSection.tsx');
const FLASH_SALE = readProjectFile('app/components/buyer/home/FlashSaleSection.tsx');
const VENDOR_SECTION = readProjectFile('app/components/buyer/home/VendorSection.tsx');
const LANGGANAN_PAGE = readProjectFile('app/(app)/langganan/page.tsx');
test('menu Makanan, UMKM, dan Flash Sale sudah tidak ada di navigasi pembeli', () => {
    assert.doesNotMatch(SIDEBAR, /title="Makanan"/);
    assert.doesNotMatch(SIDEBAR, /title="UMKM"/);
    assert.doesNotMatch(SIDEBAR, /Flash Sale/);
    assert.doesNotMatch(MOBILE_NAV, /Flash Sale/);
    assert.doesNotMatch(BOTTOM_NAV, /"\/makanan"/);
});
test('menu Langganan ada di sidebar dan drawer ponsel, dan halamannya nyata', () => {
    assert.match(SIDEBAR, /href="\/langganan"/);
    assert.match(MOBILE_NAV, /href: "\/langganan"/);
    assert.ok(projectFileExists('app/(app)/langganan/page.tsx'));
});
test('beranda tidak lagi memakai tombol "Lihat semua" untuk katalog', () => {
    assert.doesNotMatch(DEALS, /Lihat semua makanan/);
    assert.doesNotMatch(FLASH_SALE, /Lihat semua makanan/);
    assert.doesNotMatch(VENDOR_SECTION, /Lihat semua toko/);
});
test('menu unggulan beranda memakai paginasi nomor seperti daftar toko', () => {
    assert.match(DEALS, /ITEMS_PER_PAGE/);
    assert.match(DEALS, /aria-label="Halaman menu"/);
    assert.match(DEALS, /Ke halaman menu/);
    assert.match(DEALS, /justify-start/);
    assert.match(DEALS, /aria-current=\{active \? "page" : undefined\}/);
});
test('kartu paket langganan pindah dari beranda ke halaman Langganan', () => {
    assert.doesNotMatch(HOME_PAGE, /SubscriptionSection/);
    assert.doesNotMatch(HOME_PAGE, /SUBSCRIPTION_PLANS/);
    assert.match(LANGGANAN_PAGE, /SUBSCRIPTION_PLANS/);
    assert.match(LANGGANAN_PAGE, /RequireAuth/);
});
