import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { canManageProductDeletion } from '../lib/admin-access.ts';
import type { AdminActor } from '../lib/admin-access.ts';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
}
const SUPER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const TEAM_ID = '11111111-2222-4333-8444-555555555555';
function actor(overrides: Partial<AdminActor> = {}): AdminActor {
    return { id: SUPER_ID, role: 'admin', isSuperAdmin: true, ...overrides };
}
test('canManageProductDeletion: hanya Super Admin yang boleh', () => {
    assert.deepEqual(canManageProductDeletion(actor()), { allowed: true });
    const deniedTeam = canManageProductDeletion(actor({ id: TEAM_ID, isSuperAdmin: false }));
    assert.equal(deniedTeam.allowed, false);
    if (!deniedTeam.allowed) {
        assert.equal(deniedTeam.code, 'super-admin-required');
        assert.equal(deniedTeam.status, 403);
    }
    const deniedNonAdmin = canManageProductDeletion(actor({ role: 'umkm' }));
    assert.equal(deniedNonAdmin.allowed, false);
    if (!deniedNonAdmin.allowed)
        assert.equal(deniedNonAdmin.code, 'not-admin');
});
test('migrasi: kolom jejak + pengunci, tanpa policy baru', () => {
    const migration = readProjectFile('supabase/migrations/20261107000000_admin_product_soft_delete.sql');
    assert.match(migration, /ADD COLUMN IF NOT EXISTS deleted_by uuid/);
    assert.match(migration, /ADD COLUMN IF NOT EXISTS deletion_reason text/);
    assert.match(migration, /lock_products_deletion_on_update/);
    assert.match(migration, /trg_products_lock_deletion/);
    assert.match(migration, /NEW\.deleted_at := OLD\.deleted_at/);
    assert.match(migration, /auth\.jwt\(\) ->> 'role'\) = 'service_role'/);
    assert.doesNotMatch(migration, /CREATE POLICY|DROP POLICY/);
});
test('route penghapusan produk: Super Admin + alasan wajib + audit + concurrency', () => {
    const route = readProjectFile('app/api/admin/products/[id]/deletion/route.ts');
    assert.match(route, /canManageProductDeletion\(/);
    assert.match(route, /isSuperAdminUserId\(/);
    assert.match(route, /Alasan penghapusan produk wajib diisi/);
    assert.match(route, /soft_delete_product/);
    assert.match(route, /restore_product/);
    assert.match(route, /from\('admin_audit_logs'\)[\s\S]{0,120}\.insert\(/);
    assert.match(route, /\.is\('deleted_at', null\)/);
    assert.match(route, /status: 409/);
    assert.match(route, /ditarik oleh penjual/);
});
test('lib klien memakai PATCH penanda, bukan DELETE fisik', () => {
    const lib = readProjectFile('lib/admin-product-moderation.ts');
    assert.match(lib, /setAdminProductDeletion\(/);
    assert.match(lib, /\/deletion`/);
    assert.match(lib, /method: 'PATCH'/);
    assert.doesNotMatch(lib, /method: 'DELETE'/);
});
test('drawer produk memasang panel hapus/pulihkan dengan catatan pemulihan penjual', () => {
    const drawer = readProjectFile('app/components/admin/product-detail-drawer.tsx');
    assert.match(drawer, /<SoftDeletePanel/);
    assert.match(drawer, /kind="product"/);
    assert.match(drawer, /restoreNote=/);
    assert.match(drawer, /Dihapus admin/);
    assert.match(drawer, /setAdminProductDeletion\(/);
});
test('daftar produk membedakan hapus admin versus penjual', () => {
    const view = readProjectFile('app/components/admin/products-management-view.tsx');
    assert.match(view, /item\.deletedBy \? 'Dihapus admin' : 'Dihapus penjual'/);
    const listRoute = readProjectFile('app/api/admin/products/route.ts');
    assert.match(listRoute, /'deleted_by'/);
    assert.match(listRoute, /deletedBy: asString\(p\.deleted_by\)/);
});
test('panel mendukung tiga jenis target: akun, toko, dan produk', () => {
    const panel = readProjectFile('app/components/admin/soft-delete-panel.tsx');
    assert.match(panel, /type SoftDeleteKind = 'user' \| 'store' \| 'product'/);
    assert.match(panel, /product: \{/);
    assert.match(panel, /variant\?: 'card' \| 'inline'/);
    assert.match(panel, /variant === 'inline'/);
});
test('tombol hapus toko duduk di baris aksi header dan kartu lama sudah hilang', () => {
    const view = readProjectFile('app/components/admin/umkm-detail-view.tsx');
    const occurrences = view.split('<SoftDeletePanel').length - 1;
    assert.equal(occurrences, 1, 'panel toko hanya boleh dirender sekali');
    assert.match(view, /variant="inline"/);
    const actionsIdx = view.indexOf('actions={');
    const panelIdx = view.indexOf('<SoftDeletePanel');
    const firstCardIdx = view.indexOf('<Card className="mb-6">');
    assert.ok(actionsIdx >= 0 && panelIdx > actionsIdx, 'panel harus di dalam actions header');
    assert.ok(firstCardIdx > panelIdx, 'panel harus berada sebelum kartu identitas (sejajar dengan tombol header lain)');
});
test('label audit aksi produk tersedia di formatter admin', () => {
    const format = readProjectFile('app/components/admin/admin-format.ts');
    assert.match(format, /soft_delete_product: '/);
    assert.match(format, /restore_product: '/);
});
