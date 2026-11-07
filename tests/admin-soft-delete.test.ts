import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { canManageAccountDeletion, canManageStoreDeletion, } from '../lib/admin-access.ts';
import type { AdminActor, AdminTarget } from '../lib/admin-access.ts';
import { isAccountDeleted, isStoreDeleted } from '../lib/account-deletion.ts';
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}
const SUPER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const TEAM_ID = '11111111-2222-4333-8444-555555555555';
const TARGET_ID = '99999999-8888-4777-8666-555555555555';
function actor(overrides: Partial<AdminActor> = {}): AdminActor {
    return { id: SUPER_ID, role: 'admin', isSuperAdmin: true, ...overrides };
}
function target(overrides: Partial<AdminTarget> = {}): AdminTarget {
    return { id: TARGET_ID, role: 'buyer', isSuperAdmin: false, ...overrides };
}
test('canManageAccountDeletion: hanya Super Admin, akun sendiri & Super Admin terlindungi', () => {
    assert.deepEqual(canManageAccountDeletion(actor(), target()), { allowed: true });
    assert.deepEqual(canManageAccountDeletion(actor(), target({ role: 'umkm' })), {
        allowed: true,
    });
    assert.deepEqual(canManageAccountDeletion(actor(), target({ role: 'admin' })), {
        allowed: true,
    });
    const deniedTeam = canManageAccountDeletion(actor({ id: TEAM_ID, isSuperAdmin: false }), target());
    assert.equal(deniedTeam.allowed, false);
    if (!deniedTeam.allowed) {
        assert.equal(deniedTeam.code, 'super-admin-required');
        assert.equal(deniedTeam.status, 403);
    }
    const deniedNonAdmin = canManageAccountDeletion(actor({ role: 'umkm' }), target());
    assert.equal(deniedNonAdmin.allowed, false);
    if (!deniedNonAdmin.allowed)
        assert.equal(deniedNonAdmin.code, 'not-admin');
    const deniedSelf = canManageAccountDeletion(actor(), target({ id: SUPER_ID }));
    assert.equal(deniedSelf.allowed, false);
    if (!deniedSelf.allowed) {
        assert.equal(deniedSelf.code, 'self-delete');
        assert.equal(deniedSelf.status, 403);
    }
    const deniedProtected = canManageAccountDeletion(actor(), target({ id: TARGET_ID, role: 'admin', isSuperAdmin: true }));
    assert.equal(deniedProtected.allowed, false);
    if (!deniedProtected.allowed)
        assert.equal(deniedProtected.code, 'super-admin-protected');
});
test('canManageStoreDeletion: Super Admin saja; toko milik Super Admin dilindungi', () => {
    assert.deepEqual(canManageStoreDeletion(actor(), {
        id: 'store-1',
        ownerId: TARGET_ID,
        ownerIsSuperAdmin: false,
    }), { allowed: true });
    const deniedTeam = canManageStoreDeletion(actor({ id: TEAM_ID, isSuperAdmin: false }), {
        id: 'store-1',
        ownerId: TARGET_ID,
        ownerIsSuperAdmin: false,
    });
    assert.equal(deniedTeam.allowed, false);
    if (!deniedTeam.allowed)
        assert.equal(deniedTeam.code, 'super-admin-required');
    const deniedProtected = canManageStoreDeletion(actor(), {
        id: 'store-1',
        ownerId: SUPER_ID,
        ownerIsSuperAdmin: true,
    });
    assert.equal(deniedProtected.allowed, false);
    if (!deniedProtected.allowed)
        assert.equal(deniedProtected.code, 'super-admin-protected');
    const deniedNonAdmin = canManageStoreDeletion(actor({ role: 'buyer' }), {
        id: 'store-1',
        ownerId: TARGET_ID,
        ownerIsSuperAdmin: false,
    });
    assert.equal(deniedNonAdmin.allowed, false);
    if (!deniedNonAdmin.allowed)
        assert.equal(deniedNonAdmin.code, 'not-admin');
});
test('isAccountDeleted: NULL/kosong = aktif; nilai terisi = terhapus (fail-closed)', () => {
    assert.equal(isAccountDeleted({ deleted_at: null }), false);
    assert.equal(isAccountDeleted({}), false);
    assert.equal(isAccountDeleted({ deleted_at: undefined }), false);
    assert.equal(isAccountDeleted({ deleted_at: '   ' }), false);
    assert.equal(isAccountDeleted(null), false);
    assert.equal(isAccountDeleted(undefined), false);
    assert.equal(isAccountDeleted('bukan-objek'), false);
    assert.equal(isAccountDeleted({ deleted_at: '2026-11-06T00:00:00.000Z' }), true);
    assert.equal(isAccountDeleted({ deleted_at: 1 }), true);
    assert.equal(isAccountDeleted({ deleted_at: true }), true);
    assert.equal(isStoreDeleted({ deleted_at: null }), false);
    assert.equal(isStoreDeleted({ deleted_at: '2026-11-06T00:00:00.000Z' }), true);
});
test('migrasi menambah kolom jejak penghapusan di profiles dan umkm_profiles', () => {
    const migration = readProjectFile('supabase/migrations/20261106000000_admin_soft_delete.sql');
    assert.match(migration, /ADD COLUMN IF NOT EXISTS deleted_at timestamptz/);
    assert.match(migration, /ADD COLUMN IF NOT EXISTS deleted_by uuid/);
    assert.match(migration, /ADD COLUMN IF NOT EXISTS deletion_reason text/);
    assert.match(migration, /ALTER TABLE public\.profiles[\s\S]{0,200}deleted_at/);
    assert.match(migration, /ALTER TABLE public\.umkm_profiles[\s\S]{0,200}deleted_at/);
});
test('migrasi mengunci kolom penghapusan dari non-admin, tanpa policy baru', () => {
    const migration = readProjectFile('supabase/migrations/20261106000000_admin_soft_delete.sql');
    assert.match(migration, /lock_profiles_deletion_on_update/);
    assert.match(migration, /lock_umkm_deletion_on_update/);
    assert.match(migration, /trg_profiles_lock_deletion/);
    assert.match(migration, /trg_umkm_lock_deletion/);
    assert.match(migration, /NEW\.deleted_at := OLD\.deleted_at/);
    assert.match(migration, /auth\.jwt\(\) ->> 'role'\) = 'service_role'/);
    assert.doesNotMatch(migration, /CREATE POLICY|DROP POLICY/);
});
test('otorisasi admin mencabut akun yang dihapus (fail-closed)', () => {
    const errorsModule = readProjectFile('lib/server/supabase-errors.ts');
    assert.match(errorsModule, /deleted_at/);
    assert.match(errorsModule, /deletedAt !== null && deletedAt !== undefined/);
    const serverSupabase = readProjectFile('lib/server/supabase.ts');
    assert.match(serverSupabase, /select\('role, account_status, deleted_at'\)/);
});
test('route penghapusan akun: kebijakan Super Admin + alasan wajib + audit', () => {
    const route = readProjectFile('app/api/admin/users/[id]/deletion/route.ts');
    assert.match(route, /canManageAccountDeletion\(/);
    assert.match(route, /isSuperAdminUserId\(/);
    assert.match(route, /Alasan penghapusan wajib diisi/);
    assert.match(route, /from\('admin_audit_logs'\)[\s\S]{0,120}\.insert\(/);
    assert.match(route, /soft_delete_user/);
    assert.match(route, /restore_user/);
    assert.match(route, /\.is\('deleted_at', null\)/);
    assert.match(route, /status: 409/);
});
test('route penghapusan toko: kebijakan Super Admin + nonaktifkan + audit', () => {
    const route = readProjectFile('app/api/admin/umkm/[id]/deletion/route.ts');
    assert.match(route, /canManageStoreDeletion\(/);
    assert.match(route, /isSuperAdminUserId\(/);
    assert.match(route, /Alasan penghapusan toko wajib diisi/);
    assert.match(route, /soft_delete_store/);
    assert.match(route, /restore_store/);
    assert.match(route, /is_active: false/);
    assert.match(route, /deactivation_reason: reason/);
    assert.match(route, /is_active: true/);
});
test('lib klien memanggil endpoint penghapusan, bukan DELETE fisik', () => {
    const usersLib = readProjectFile('lib/admin-users.ts');
    assert.match(usersLib, /setAdminUserDeletion\(/);
    assert.match(usersLib, /\/deletion`/);
    assert.match(usersLib, /deleted: true, reason/);
    const umkmLib = readProjectFile('lib/admin-umkm.ts');
    assert.match(umkmLib, /setUmkmDeletion\(/);
    assert.match(umkmLib, /\/deletion`/);
    assert.doesNotMatch(usersLib, /method: 'DELETE'[\s\S]{0,80}\/deletion/);
    assert.doesNotMatch(umkmLib, /method: 'DELETE'[\s\S]{0,80}\/deletion/);
});
test('daftar admin menyembunyikan baris terhapus, admin dapat memintanya', () => {
    const usersRoute = readProjectFile('app/api/admin/users/route.ts');
    assert.match(usersRoute, /includeDeleted/);
    assert.match(usersRoute, /\.is\('deleted_at', null\)/);
    assert.match(usersRoute, /deleted_at: r\.deleted_at \?\? null/);
    const umkmRoute = readProjectFile('app/api/admin/umkm/route.ts');
    assert.match(umkmRoute, /includeDeleted/);
    assert.match(umkmRoute, /\.is\('deleted_at', null\)/);
    assert.match(umkmRoute, /deleted_at: r\.deleted_at \?\? null/);
    for (const view of [
        'app/components/admin/users-management-view.tsx',
        'app/components/admin/umkm-management-view.tsx',
    ]) {
        const source = readProjectFile(view);
        assert.match(source, /DELETED_FILTER_OPTIONS/);
        assert.match(source, /include/);
        assert.match(source, /\{item\.deleted_at && <Badge variant="destructive">Dihapus<\/Badge>\}/);
    }
});
test('jalur login menolak akun terhapus/diblokir dan memutus sesinya', () => {
    const currentUser = readProjectFile('lib/current-user.ts');
    assert.match(currentUser, /isAccountDeleted\(data\)/);
    assert.match(currentUser, /'account-deleted'/);
    assert.match(currentUser, /select\('role, deleted_at, account_status'\)/);
    assert.match(currentUser, /classifyAccountBlock\(data\)/);
    assert.match(currentUser, /'account-banned'/);
    assert.match(currentUser, /'account-suspended'/);
    const postLogin = readProjectFile('lib/auth-post-login.ts');
    assert.match(postLogin, /isBlockedRoleErrorCode\(err\.code\)/);
    assert.match(postLogin, /supabase\.auth\.signOut\(\)/);
    const penjualLogin = readProjectFile('app/components/auth/penjual-login-form.tsx');
    assert.match(penjualLogin, /isBlockedRoleErrorCode\(roleErr\.code\)/);
    assert.match(penjualLogin, /isBannedAuthError\(signInError\)/);
    assert.match(penjualLogin, /sb\.auth\.signOut\(\)/);
});
test('panel soft delete terpasang di detail pengguna dan detail UMKM', () => {
    const panel = readProjectFile('app/components/admin/soft-delete-panel.tsx');
    assert.match(panel, /useAdminMe\(/);
    assert.match(panel, /targetProtected/);
    assert.match(panel, /accessFailed/);
    assert.match(panel, /export function SoftDeletePanel\(/);
    const userDetail = readProjectFile('app/components/admin/user-detail-view.tsx');
    assert.match(userDetail, /<SoftDeletePanel/);
    assert.match(userDetail, /kind="user"/);
    assert.match(userDetail, /targetProtected=\{user\.is_super_admin === true\}/);
    const umkmDetail = readProjectFile('app/components/admin/umkm-detail-view.tsx');
    assert.match(umkmDetail, /<SoftDeletePanel/);
    assert.match(umkmDetail, /kind="store"/);
    assert.match(umkmDetail, /targetProtected=\{owner\?\.is_super_admin === true\}/);
});
test('toko terhapus tidak dapat diaktifkan kembali lewat jalur lain', () => {
    const migration = readProjectFile('supabase/migrations/20261106000000_admin_soft_delete.sql');
    assert.match(migration, /keep_deleted_store_inactive/);
    assert.match(migration, /trg_umkm_deleted_store_inactive/);
    assert.match(migration, /IF NEW\.deleted_at IS NOT NULL AND NEW\.is_active = true THEN/);
    const patchRoute = readProjectFile('app/api/admin/umkm/[id]/route.ts');
    assert.match(patchRoute, /select\('id, is_active, deleted_at'\)/);
    assert.match(patchRoute, /Pulihkan dulu dari panel pemulihan/);
    const activationRoute = readProjectFile('app/api/admin/umkm/[id]/activation/route.ts');
    assert.match(activationRoute, /select\('id, is_active, deleted_at'\)/);
    assert.match(activationRoute, /Pulihkan dulu dari panel pemulihan/);
});
test('menghapus akun menonaktifkan tokonya agar tidak menerima pesanan baru', () => {
    const route = readProjectFile('app/api/admin/users/[id]/deletion/route.ts');
    assert.match(route, /store_deactivated/);
    assert.match(route, /is_active: false/);
    assert.match(route, /Akun pemilik dihapus oleh admin\./);
    assert.match(route, /deactivate store error/);
});
test('alur konfirmasi panel: kolom alasan muncul SEBELUM alasan diperiksa', () => {
    const panel = readProjectFile('app/components/admin/soft-delete-panel.tsx');
    const handleDelete = panel.slice(panel.indexOf('const handleDelete'));
    const bukaKolom = handleDelete.indexOf('if (!confirming)');
    const periksaAlasan = handleDelete.indexOf('Alasan penghapusan wajib diisi.');
    assert.match(panel, /const handleDelete/);
    assert.ok(bukaKolom >= 0, 'klik pertama harus membuka kolom alasan');
    assert.ok(periksaAlasan >= 0, 'alasan wajib diperiksa sebelum menghapus');
    assert.ok(bukaKolom < periksaAlasan, 'pembukaan kolom alasan harus lebih dulu daripada pemeriksaan isiannya');
    assert.match(panel, /autoFocus/);
});
test('label audit untuk empat aksi penghapusan/pemulihan tersedia', () => {
    const format = readProjectFile('app/components/admin/admin-format.ts');
    assert.match(format, /soft_delete_user: '/);
    assert.match(format, /restore_user: '/);
    assert.match(format, /soft_delete_store: '/);
    assert.match(format, /restore_store: '/);
});
