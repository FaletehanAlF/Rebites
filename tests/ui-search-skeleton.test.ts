import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
function projectFileExists(relativePath: string): boolean {
    return existsSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)));
}
const SEARCH_BAR = readProjectFile('app/components/shared/BuyerSearchBar.tsx');
const TOPBAR = readProjectFile('app/components/shared/navbar.tsx');
const MOBILE_NAV = readProjectFile('app/components/shared/MobileNavbar.tsx');
const SKELETON = readProjectFile('app/components/ui/skeleton.tsx');
const TAILWIND = readProjectFile('tailwind.config.ts');
const HOME_DEALS = readProjectFile('app/components/home/UrgentDealsSection.tsx');
const REQUIRE_AUTH = readProjectFile('app/components/auth/require-auth.tsx');
const SELLER_SHELL = readProjectFile('app/components/dashboard-penjual/SellerShell.tsx');
const SELLER_SKELETON = readProjectFile('app/components/dashboard-penjual/SellerShellSkeleton.tsx');
test('kolom pencarian membuka detail makanan tanpa pindah ke halaman katalog', () => {
    assert.match(SEARCH_BAR, /router\.push\(/);
    assert.match(SEARCH_BAR, /\/detail\/product\?id=\$\{encodeURIComponent\(id\)\}/);
    assert.match(SEARCH_BAR, /role="combobox"/);
    assert.match(SEARCH_BAR, /aria-autocomplete="list"/);
});
test('kolom pencarian bisa dipakai keyboard dan dibaca pembaca layar', () => {
    assert.match(SEARCH_BAR, /role="search"/);
    assert.match(SEARCH_BAR, /type="search"/);
    assert.match(SEARCH_BAR, /aria-label="Cari nama makanan"/);
    assert.match(SEARCH_BAR, /placeholder="Cari nama makanan"/);
    assert.match(SEARCH_BAR, /aria-label="Hapus pencarian"/);
    assert.match(SEARCH_BAR, /inputRef\.current\?\.focus\(\)/);
    assert.match(SEARCH_BAR, /focus-visible:ring-2/);
});
test('kolom pencarian terpasang di navbar desktop dan navbar ponsel', () => {
    assert.match(TOPBAR, /import \{ BuyerSearchBar \}/);
    assert.match(TOPBAR, /<BuyerSearchBar/);
    assert.match(MOBILE_NAV, /import \{ BuyerSearchBar \}/);
    assert.match(MOBILE_NAV, /<BuyerSearchBar/);
});
test('kolom pencarian di beranda sudah dihapus, bukan sekadar disembunyikan', () => {
    assert.doesNotMatch(HOME_DEALS, /SearchFilterBar/);
    assert.doesNotMatch(HOME_DEALS, /Cari makanan surplus/);
    assert.equal(projectFileExists('app/components/shared/SearchFilterBar.tsx'), false);
});
test('halaman katalog /makanan sudah dihapus, bukan sekadar disembunyikan', () => {
    assert.equal(projectFileExists('app/(app)/makanan/page.tsx'), false);
});
test('pencarian menyaring saat mengetik, tanpa memuat ulang halaman', () => {
    assert.match(SEARCH_BAR, /suggestFoods/);
    assert.match(SEARCH_BAR, /useMemo/);
    assert.doesNotMatch(SEARCH_BAR, /CATALOG_SEARCH_EVENT/);
    assert.doesNotMatch(SEARCH_BAR, /window\.history\.replaceState/);
    const helper = readProjectFile('lib/food-search.ts');
    assert.match(helper, /export function suggestFoods/);
});
test('kerangka isi berkilau, bukan denyut opacity biasa', () => {
    assert.match(SKELETON, /animate-shimmer/);
    assert.match(SKELETON, /-translate-x-full/);
    assert.match(SKELETON, /pointer-events-none/);
});
test('kilau berhenti saat pengguna memilih kurangi gerak', () => {
    assert.match(SKELETON, /motion-reduce:animate-none/);
});
test('token shimmer terdaftar di tema Tailwind', () => {
    assert.match(TAILWIND, /shimmer: \{/);
    assert.match(TAILWIND, /from: \{ transform: 'translateX\(-100%\)' \}/);
    assert.match(TAILWIND, /to: \{ transform: 'translateX\(100%\)' \}/);
    assert.match(TAILWIND, /shimmer: 'shimmer 1\.6s linear infinite'/);
});
test('pemeriksaan sesi login memakai kerangka, bukan spinner berputar', () => {
    assert.match(REQUIRE_AUTH, /import \{ Skeleton \}/);
    assert.match(REQUIRE_AUTH, /<Skeleton/);
    assert.doesNotMatch(REQUIRE_AUTH, /animate-spin/);
    assert.match(REQUIRE_AUTH, /aria-label="Memeriksa sesi login"/);
});
test('shell penjual memakai kerangka dashboard, bukan spinner halaman penuh', () => {
    assert.match(SELLER_SHELL, /import \{ SellerShellSkeleton \}/);
    assert.match(SELLER_SHELL, /if \(loading\) \{\s*return <SellerShellSkeleton \/>;/);
    assert.match(SELLER_SKELETON, /aria-label="Memuat dashboard penjual"/);
    assert.match(SELLER_SKELETON, /<Skeleton/);
});
test('pengalih alamat toko penjual memakai kerangka yang sama', () => {
    const redirect = readProjectFile('app/components/dashboard-penjual/seller-store-redirect.tsx');
    assert.match(redirect, /SellerShellSkeleton/);
    assert.doesNotMatch(redirect, /animate-spin/);
});
test('katalog kategori memuat dengan kerangka kartu', () => {
    assert.match(projectFile('app/components/shared/FoodCardSkeleton.tsx'), /<Skeleton/);
    assert.match(projectFile('app/components/shared/VendorCardSkeleton.tsx'), /<Skeleton/);
    assert.match(readProjectFile('app/components/makanan-category/category-view.tsx'), /<FoodCardSkeleton/);
});
test('riwayat pesanan dan detail pesanan memuat dengan kerangka', () => {
    assert.match(readProjectFile('app/components/order-history/order-history-view.tsx'), /<Skeleton/);
    assert.match(readProjectFile('app/riwayatPesanan/[orderCode]/page.tsx'), /<Skeleton/);
});
test('halaman penjual memuat menu, pesanan, dan ulasan dengan kerangka', () => {
    assert.match(readProjectFile('app/(app)/dashboard/penjual/[storeId]/menu/page.tsx'), /<Skeleton/);
    assert.match(readProjectFile('app/(app)/dashboard/penjual/[storeId]/pesanan/page.tsx'), /<Skeleton/);
    assert.match(readProjectFile('app/(app)/dashboard/penjual/[storeId]/ulasan/page.tsx'), /<Skeleton/);
});
function projectFile(relativePath: string): string {
    return readProjectFile(relativePath);
}
