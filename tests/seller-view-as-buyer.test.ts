/**
 * Dua arah antara sisi penjual dan sisi pembeli.
 *
 * MASALAH YANG DILAPORKAN
 * "ketika role nya penjual langsung masuk ke halaman penjual jadi home penjual
 * dan pembeli beda tapi di sidebar penjual tambahkan menu lihat sebagai
 * pembeli nah pas di klik baru bisa masuk ke halaman pembeli".
 *
 * Dua bagian yang dikunci di sini:
 * 1. MASUK — sidebar penjual menyediakan satu tautan yang disengaja ke
 *    beranda pembeli (/home), sehingga penjual tidak perlu mengetik URL
 *    sendiri untuk memeriksa tampilan tokonya sebagai pembeli.
 * 2. KELUAR — begitu berada di sisi pembeli, penjual harus bisa kembali ke
 *    dashboard-nya. Tanpa ini tautan masuk di atas berubah menjadi jebakan.
 *
 * Yang TIDAK diuji di sini: apakah `profiles.role` benar-benar membuat penjual
 * mendarat di dashboard penjual. Aturan tujuan itu punya tesnya sendiri di
 * tests/post-login-route.test.ts — termasuk kasus penjual yang `profiles.role`
 * -nya masih 'buyer' karena trigger pendaftaran hanya menambah baris
 * `umkm_profiles`.
 *
 * Jalankan: node --test tests/seller-view-as-buyer.test.ts
 */

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
  // Subjudul ("Buka beranda pembeli") pernah dipakai di sini dan membuat baris
  // ini lebih tinggi daripada menu di atasnya, sehingga terbaca sebagai kartu
  // tersendiri padahal ia sekadar satu menu lagi.
  assert.match(
    SELLER_SIDEBAR,
    /<span className="truncate">Lihat sebagai Pembeli<\/span>/
  );
  assert.doesNotMatch(SELLER_SIDEBAR, /Buka beranda pembeli/);
});

test('tautan pratinjau memakai ikon sendiri, bukan ikon menu dashboard', () => {
  // Ikon yang sama dengan menu dashboard membuat baris ini terbaca sebagai
  // halaman dashboard ke-N. "Eye" menandai aktivitas melihat.
  assert.match(SELLER_SIDEBAR, /Eye,/);
  assert.match(SELLER_SIDEBAR, /<Eye/);
  assert.match(SELLER_SIDEBAR, /from 'lucide-react'/);
});

test('tautan pratinjau tetap memenuhi syarat target sentuh dan fokus', () => {
  // min-h-11 = 44px, ambang target sentuh yang dipakai seluruh navigasi repo.
  assert.match(SELLER_SIDEBAR, /group flex min-h-11 items-center gap-3 rounded-xl/);
});

test('sidebar penjual tetap hanya menautkan Panel Admin untuk admin', () => {
  // Blok baru disisipkan tepat sebelum penjaga admin; kalau penjaganya ikut
  // tergeser atau terduplikasi, tautan admin bisa terbuka untuk penjual biasa.
  const guards = SELLER_SIDEBAR.match(/\{isAdmin && \(/g) ?? [];
  assert.equal(guards.length, 1);
  assert.match(SELLER_SIDEBAR, /useIsAdminAccount/);
});

test('penjual tidak terjebak di sisi pembeli: ada jalan kembali', () => {
  // Sidebar pembeli (desktop) menampilkan "Toko Saya" hanya untuk akun yang
  // punya toko.
  assert.match(BUYER_SIDEBAR, /isSeller \? "\/dashboard\/penjual"/);
  assert.match(BUYER_SIDEBAR, /Toko Saya/);
  // Drawer ponsel pembeli menyediakan tujuan yang sama.
  assert.match(BUYER_MOBILE_NAV, /Dashboard Penjual/);
  assert.match(BUYER_MOBILE_NAV, /href="\/dashboard\/penjual"/);
});

test('beranda penjual dan pembeli memang dua halaman berbeda', () => {
  assert.match(SELLER_SIDEBAR, /href: '\/dashboard\/penjual'/);
  assert.doesNotMatch(SELLER_SIDEBAR, /href: '\/home'/);
});
