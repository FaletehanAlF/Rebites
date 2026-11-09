import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}
const SELLER_SIDEBAR = readProjectFile('app/components/dashboard-penjual/Sidebar.tsx');
const BUYER_SIDEBAR = readProjectFile('app/components/shared/profile-sidebar-nav.tsx');
const BUYER_MOBILE_NAV = readProjectFile('app/components/shared/MobileNavbar.tsx');
test('sidebar penjual punya satu jalan masuk ke beranda pembeli', () => {
    assert.match(SELLER_SIDEBAR, /Lihat sebagai Pembeli/);
    assert.match(SELLER_SIDEBAR, /href="\/home"/);
});
test('baris pratinjau satu baris, setinggi menu lain', () => {
    assert.match(SELLER_SIDEBAR, /<span className="truncate">Lihat sebagai Pembeli<\/span>/);
    assert.doesNotMatch(SELLER_SIDEBAR, /Buka beranda pembeli/);
});
test('tautan pratinjau memakai ikon sendiri, bukan ikon menu dashboard', () => {
    assert.match(SELLER_SIDEBAR, /Eye,/);
    assert.match(SELLER_SIDEBAR, /<Eye/);
    assert.match(SELLER_SIDEBAR, /from 'lucide-react'/);
});
test('tautan pratinjau tetap memenuhi syarat target sentuh dan fokus', () => {
    assert.match(SELLER_SIDEBAR, /group flex min-h-\[44px\] items-center gap-3 rounded-xl/);
});
test('sidebar penjual tetap hanya menautkan Panel Admin untuk admin', () => {
    const guards = SELLER_SIDEBAR.match(/\{isAdmin && \(/g) ?? [];
    assert.equal(guards.length, 1);
    assert.match(SELLER_SIDEBAR, /useIsAdminAccount/);
});
test('penjual tidak terjebak di sisi pembeli: ada jalan kembali', () => {
    assert.match(BUYER_SIDEBAR, /isSeller \? "\/dashboard\/penjual"/);
    assert.match(BUYER_SIDEBAR, /Toko Saya/);
    assert.match(BUYER_MOBILE_NAV, /Toko Saya/);
    assert.match(BUYER_MOBILE_NAV, /href="\/dashboard\/penjual"/);
});
test('beranda penjual dan pembeli memang dua halaman berbeda', () => {
    assert.match(SELLER_SIDEBAR, /sellerStorePath\(storeId/);
    assert.match(SELLER_SIDEBAR, /from '@\/lib\/seller-store-path'/);
    assert.doesNotMatch(SELLER_SIDEBAR, /href: '\/home'/);
});
