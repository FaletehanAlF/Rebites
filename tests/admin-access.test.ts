import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildAdminMePayload, canChangeUserRole, canCreateRoleRequest, canDecideRoleRequest, canIssueSanction, canManageStore, isSuperAdminUserId, resolveSuperAdminId, } from '../lib/admin-access.ts';
import type { AdminActor, AdminTarget } from '../lib/admin-access.ts';
const SUPER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const TEAM_ID = '11111111-2222-3333-4444-555555555555';
const BUYER_ID = '99999999-8888-7777-6666-555555555555';
function actor(partial: Partial<AdminActor> = {}): AdminActor {
    return { id: SUPER_ID, role: 'admin', isSuperAdmin: true, ...partial };
}
function target(partial: Partial<AdminTarget> = {}): AdminTarget {
    return { id: BUYER_ID, role: 'buyer', isSuperAdmin: false, ...partial };
}
function readProjectFile(relativePath: string): string {
    return readFileSync(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), 'utf8');
}
test('canChangeUserRole: hanya Super Admin yang boleh mengubah peran', () => {
    const decision = canChangeUserRole(actor(), target(), 'umkm');
    assert.deepEqual(decision, { allowed: true });
    const teamActor = actor({ id: TEAM_ID, isSuperAdmin: false });
    for (const nextRole of ['buyer', 'umkm', 'admin'] as const) {
        const denied = canChangeUserRole(teamActor, target(), nextRole);
        assert.equal(denied.allowed, false);
        if (!denied.allowed) {
            assert.equal(denied.status, 403);
            assert.equal(denied.code, 'super-admin-required');
        }
    }
    const deniedOnSuper = canChangeUserRole(teamActor, target({ id: SUPER_ID, role: 'admin', isSuperAdmin: true }), 'buyer');
    assert.equal(deniedOnSuper.allowed, false);
    const buyerDecision = canChangeUserRole(actor({ role: 'buyer', isSuperAdmin: false }), target(), 'admin');
    assert.equal(buyerDecision.allowed, false);
    if (!buyerDecision.allowed)
        assert.equal(buyerDecision.code, 'not-admin');
});
test('canChangeUserRole: Super Admin dapat mengelola admin tim, tetapi tidak dapat didemosi', () => {
    assert.deepEqual(canChangeUserRole(actor(), target({ id: BUYER_ID, role: 'buyer' }), 'admin'), { allowed: true });
    assert.deepEqual(canChangeUserRole(actor(), target({ id: TEAM_ID, role: 'admin' }), 'umkm'), { allowed: true });
    for (const nextRole of ['buyer', 'umkm'] as const) {
        const denied = canChangeUserRole(actor(), target({ id: SUPER_ID, role: 'admin', isSuperAdmin: true }), nextRole);
        assert.equal(denied.allowed, false);
        if (!denied.allowed) {
            assert.equal(denied.status, 403);
            assert.equal(denied.code, 'self-demotion');
        }
    }
    assert.deepEqual(canChangeUserRole(actor(), target({ id: SUPER_ID, role: 'admin', isSuperAdmin: true }), 'admin'), { allowed: true });
});
test('canIssueSanction: admin tim tidak dapat menyasar admin/Super Admin', () => {
    const teamActor = actor({ id: TEAM_ID, isSuperAdmin: false });
    assert.deepEqual(canIssueSanction(teamActor, target()), { allowed: true });
    assert.deepEqual(canIssueSanction(teamActor, target({ role: 'umkm' })), { allowed: true });
    const deniedAdmin = canIssueSanction(teamActor, target({ id: TEAM_ID, role: 'admin' }));
    assert.equal(deniedAdmin.allowed, false);
    if (!deniedAdmin.allowed) {
        assert.equal(deniedAdmin.status, 403);
        assert.equal(deniedAdmin.code, 'admin-protected');
    }
    const deniedSuper = canIssueSanction(teamActor, target({ id: SUPER_ID, role: 'admin', isSuperAdmin: true }));
    assert.equal(deniedSuper.allowed, false);
    if (!deniedSuper.allowed)
        assert.equal(deniedSuper.code, 'super-admin-protected');
    const deniedBuyer = canIssueSanction(actor({ role: 'buyer', isSuperAdmin: false }), target());
    assert.equal(deniedBuyer.allowed, false);
    if (!deniedBuyer.allowed)
        assert.equal(deniedBuyer.code, 'not-admin');
});
test('canIssueSanction: Super Admin terlindungi dari sanksi; admin tim boleh disasar Super Admin', () => {
    const deniedSelf = canIssueSanction(actor(), target({ id: SUPER_ID, role: 'admin', isSuperAdmin: true }));
    assert.equal(deniedSelf.allowed, false);
    if (!deniedSelf.allowed) {
        assert.equal(deniedSelf.code, 'super-admin-protected');
        assert.equal(deniedSelf.status, 403);
    }
    assert.deepEqual(canIssueSanction(actor(), target({ id: TEAM_ID, role: 'admin' })), { allowed: true });
    assert.deepEqual(canIssueSanction(actor(), target()), { allowed: true });
});
test('resolveSuperAdminId: hanya UUID valid; case-insensitive; fail-closed bila kosong', () => {
    assert.equal(resolveSuperAdminId({}), null);
    assert.equal(resolveSuperAdminId({ SUPER_ADMIN_USER_ID: '' }), null);
    assert.equal(resolveSuperAdminId({ SUPER_ADMIN_USER_ID: '   ' }), null);
    assert.equal(resolveSuperAdminId({ SUPER_ADMIN_USER_ID: 'bukan-uuid' }), null);
    assert.equal(resolveSuperAdminId({ SUPER_ADMIN_USER_ID: 'admin@rebites.id' }), null);
    assert.equal(resolveSuperAdminId({ SUPER_ADMIN_USER_ID: '1234' }), null);
    assert.equal(resolveSuperAdminId({ SUPER_ADMIN_USER_ID: `  ${SUPER_ID.toUpperCase()}  ` }), SUPER_ID);
});
test('isSuperAdminUserId: pencocokan id terverifikasi vs env (tanpa menebak)', () => {
    const env = { SUPER_ADMIN_USER_ID: SUPER_ID };
    assert.equal(isSuperAdminUserId(SUPER_ID, env), true);
    assert.equal(isSuperAdminUserId(SUPER_ID.toUpperCase(), env), true);
    assert.equal(isSuperAdminUserId(` ${SUPER_ID} `, env), true);
    assert.equal(isSuperAdminUserId(TEAM_ID, env), false);
    assert.equal(isSuperAdminUserId(null, env), false);
    assert.equal(isSuperAdminUserId('', env), false);
    assert.equal(isSuperAdminUserId(SUPER_ID, {}), false);
    assert.equal(isSuperAdminUserId(SUPER_ID, { SUPER_ADMIN_USER_ID: 'bukan-uuid' }), false);
});
test('buildAdminMePayload: hanya dua boolean, tanpa UUID/rahasia', () => {
    const payload = buildAdminMePayload({ isSuperAdmin: true }, true);
    assert.deepEqual(Object.keys(payload).sort(), ['is_super_admin', 'super_admin_configured']);
    assert.deepEqual(payload, { is_super_admin: true, super_admin_configured: true });
    const serialized = JSON.stringify(payload);
    assert.equal(serialized.includes(SUPER_ID), false);
    assert.equal(serialized.includes(TEAM_ID), false);
    assert.equal(serialized.includes('@'), false);
    assert.deepEqual(buildAdminMePayload({ isSuperAdmin: false }, false), {
        is_super_admin: false,
        super_admin_configured: false,
    });
});
test('canManageStore: Toko Saya hanya milik pemiliknya (user_id sama)', () => {
    assert.equal(canManageStore('user-a', 'user-a'), true);
    assert.equal(canManageStore(' user-a ', 'user-a'), true);
    assert.equal(canManageStore('user-a', 'user-b'), false);
    assert.equal(canManageStore(null, 'user-b'), false);
    assert.equal(canManageStore('user-a', null), false);
    assert.equal(canManageStore(undefined, undefined), false);
    assert.equal(canManageStore('', ''), false);
});
test('wiring server: route sensitif memakai modul kebijakan (source guard)', () => {
    const roleRoute = readProjectFile('app/api/admin/users/[id]/role/route.ts');
    assert.match(roleRoute, /getAdminActor\(/);
    assert.match(roleRoute, /canChangeUserRole\(/);
    assert.match(roleRoute, /isSuperAdminUserId\(/);
    assert.match(roleRoute, /resolveSuperAdminId\(/);
    const sanctionsRoute = readProjectFile('app/api/admin/sanctions/route.ts');
    assert.match(sanctionsRoute, /getAdminActor\(/);
    assert.match(sanctionsRoute, /canIssueSanction\(/);
    assert.match(sanctionsRoute, /isSuperAdminUserId\(/);
    const meRoute = readProjectFile('app/api/admin/me/route.ts');
    assert.match(meRoute, /getAdminActor\(/);
    assert.match(meRoute, /buildAdminMePayload\(/);
    assert.match(meRoute, /resolveSuperAdminId\(/);
    const serverSupabase = readProjectFile('lib/server/supabase.ts');
    assert.match(serverSupabase, /export async function getAdminActor\(/);
    assert.match(serverSupabase, /isSuperAdminUserId\(/);
});
test('canCreateRoleRequest: admin tim mengajukan; Super Admin/self/terlindungi ditolak', () => {
    const teamActor = actor({ id: TEAM_ID, isSuperAdmin: false });
    assert.deepEqual(canCreateRoleRequest(teamActor, target(), 'umkm'), { allowed: true });
    assert.deepEqual(canCreateRoleRequest(teamActor, target({ role: 'umkm' }), 'buyer'), {
        allowed: true,
    });
    assert.deepEqual(canCreateRoleRequest(teamActor, target(), 'admin'), { allowed: true });
    const deniedSuper = canCreateRoleRequest(actor(), target(), 'umkm');
    assert.equal(deniedSuper.allowed, false);
    if (!deniedSuper.allowed) {
        assert.equal(deniedSuper.status, 403);
        assert.equal(deniedSuper.code, 'super-admin-direct');
    }
    const deniedSelf = canCreateRoleRequest(teamActor, target({ id: TEAM_ID }), 'umkm');
    assert.equal(deniedSelf.allowed, false);
    if (!deniedSelf.allowed)
        assert.equal(deniedSelf.code, 'self-request');
    const deniedProtected = canCreateRoleRequest(teamActor, target({ id: SUPER_ID, role: 'admin', isSuperAdmin: true }), 'umkm');
    assert.equal(deniedProtected.allowed, false);
    if (!deniedProtected.allowed) {
        assert.equal(deniedProtected.code, 'super-admin-protected');
    }
    const deniedAdmin = canCreateRoleRequest(teamActor, target({ id: BUYER_ID, role: 'admin' }), 'umkm');
    assert.equal(deniedAdmin.allowed, false);
    if (!deniedAdmin.allowed)
        assert.equal(deniedAdmin.code, 'admin-protected');
    const deniedNoop = canCreateRoleRequest(teamActor, target(), 'buyer');
    assert.equal(deniedNoop.allowed, false);
    if (!deniedNoop.allowed) {
        assert.equal(deniedNoop.status, 409);
        assert.equal(deniedNoop.code, 'no-change');
    }
    const deniedBuyer = canCreateRoleRequest(actor({ role: 'buyer', isSuperAdmin: false }), target(), 'umkm');
    assert.equal(deniedBuyer.allowed, false);
    if (!deniedBuyer.allowed)
        assert.equal(deniedBuyer.code, 'not-admin');
});
test('canDecideRoleRequest: hanya Super Admin, bukan pemohon, hanya status pending', () => {
    const pengajuan = { requestedBy: TEAM_ID, status: 'pending', targetIsSuperAdmin: false };
    assert.deepEqual(canDecideRoleRequest(actor(), pengajuan), { allowed: true });
    const deniedTeam = canDecideRoleRequest(actor({ id: TEAM_ID, isSuperAdmin: false }), pengajuan);
    assert.equal(deniedTeam.allowed, false);
    if (!deniedTeam.allowed) {
        assert.equal(deniedTeam.status, 403);
        assert.equal(deniedTeam.code, 'super-admin-required');
    }
    const deniedSelf = canDecideRoleRequest(actor(), {
        requestedBy: SUPER_ID,
        status: 'pending',
        targetIsSuperAdmin: false,
    });
    assert.equal(deniedSelf.allowed, false);
    if (!deniedSelf.allowed)
        assert.equal(deniedSelf.code, 'requester-cannot-decide');
    for (const status of ['approved', 'rejected'] as const) {
        const deniedDecided = canDecideRoleRequest(actor(), { ...pengajuan, status });
        assert.equal(deniedDecided.allowed, false);
        if (!deniedDecided.allowed) {
            assert.equal(deniedDecided.status, 409);
            assert.equal(deniedDecided.code, 'request-not-pending');
        }
    }
    const deniedTarget = canDecideRoleRequest(actor(), {
        ...pengajuan,
        targetIsSuperAdmin: true,
    });
    assert.equal(deniedTarget.allowed, false);
    if (!deniedTarget.allowed)
        assert.equal(deniedTarget.code, 'super-admin-protected');
    const deniedBuyer = canDecideRoleRequest(actor({ role: 'buyer', isSuperAdmin: false }), pengajuan);
    assert.equal(deniedBuyer.allowed, false);
    if (!deniedBuyer.allowed)
        assert.equal(deniedBuyer.code, 'not-admin');
});
test('wiring server: permintaan role memakai kebijakan + RPC service-role (source guard)', () => {
    const listRoute = readProjectFile('app/api/admin/role-requests/route.ts');
    assert.match(listRoute, /getAdminActor\(/);
    assert.match(listRoute, /canCreateRoleRequest\(/);
    assert.match(listRoute, /isSuperAdminUserId\(/);
    assert.match(listRoute, /createAuthedServerClient\(/);
    assert.match(listRoute, /requested_by_me: requesterId !== null && requesterId === actor\.id/);
    const approveRoute = readProjectFile('app/api/admin/role-requests/[id]/approve/route.ts');
    assert.match(approveRoute, /getAdminActor\(/);
    assert.match(approveRoute, /canDecideRoleRequest\(/);
    assert.match(approveRoute, /isSuperAdminUserId\(/);
    assert.match(approveRoute, /createServiceClient\(/);
    assert.match(approveRoute, /decide_role_change_request/);
    assert.match(approveRoute, /p_decision: 'approved'/);
    const rejectRoute = readProjectFile('app/api/admin/role-requests/[id]/reject/route.ts');
    assert.match(rejectRoute, /canDecideRoleRequest\(/);
    assert.match(rejectRoute, /createServiceClient\(/);
    assert.match(rejectRoute, /decide_role_change_request/);
    assert.match(rejectRoute, /p_decision: 'rejected'/);
    const roleRoute = readProjectFile('app/api/admin/users/[id]/role/route.ts');
    assert.match(roleRoute, /apply_role_change/);
    assert.match(roleRoute, /createServiceClient\(/);
    assert.doesNotMatch(roleRoute, /\.update\(\{ role/);
    const usersRoute = readProjectFile('app/api/admin/users/route.ts');
    assert.match(usersRoute, /is_super_admin: isSuperAdminUserId\(/);
    const usersView = readProjectFile('app/components/admin/users-management-view.tsx');
    assert.match(usersView, /Super Admin/);
    const detailView = readProjectFile('app/components/admin/user-detail-view.tsx');
    assert.match(detailView, /user\.is_super_admin === true/);
    const sidebar = readProjectFile('app/components/admin/admin-sidebar.tsx');
    assert.match(sidebar, /\/dashboard\/admin\/permintaan-role/);
    const page = readProjectFile('app/dashboard/admin/permintaan-role/page.tsx');
    assert.match(page, /RoleRequestsView/);
    const editor = readProjectFile('app/components/admin/user-role-editor.tsx');
    assert.match(editor, /createRoleRequest\(/);
    assert.match(editor, /updateAdminUserRole\(/);
});
test('migrasi role_change_requests: RPC service-role + tanpa jalur bypass (source guard)', () => {
    const migrasi = readProjectFile('supabase/migrations/20261017000000_role_request_approval.sql');
    assert.match(migrasi, /CREATE TABLE IF NOT EXISTS public\.role_change_requests/);
    assert.match(migrasi, /ENABLE ROW LEVEL SECURITY/);
    assert.match(migrasi, /"role_change_requests_insert_admin"/);
    assert.match(migrasi, /requested_by = auth\.uid\(\)/);
    assert.match(migrasi, /p\.role <> 'admin'/);
    assert.match(migrasi, /requested_by <> target_user_id/);
    assert.doesNotMatch(migrasi, /role_change_requests_update_admin/);
    assert.doesNotMatch(migrasi, /role_change_requests_delete_admin/);
    assert.match(migrasi, /REVOKE EXECUTE ON FUNCTION public\.decide_role_change_request\(uuid, uuid, text, text\)\s+FROM PUBLIC, anon, authenticated;/);
    assert.match(migrasi, /GRANT EXECUTE ON FUNCTION public\.decide_role_change_request\(uuid, uuid, text, text\)\s+TO service_role;/);
    assert.match(migrasi, /REVOKE EXECUTE ON FUNCTION public\.apply_role_change\(uuid, text, uuid\)\s+FROM PUBLIC, anon, authenticated;/);
    assert.match(migrasi, /GRANT EXECUTE ON FUNCTION public\.apply_role_change\(uuid, text, uuid\)\s+TO service_role;/);
    assert.match(migrasi, /FOR UPDATE/);
    assert.match(migrasi, /AND status = 'pending'/);
    assert.match(migrasi, /role tidak berubah \(konteks bukan service_role\?\)/);
    assert.match(migrasi, /\(auth\.jwt\(\) ->> 'role'\) = 'service_role'/);
    assert.match(migrasi, /trg_profiles_lock_role/);
    assert.match(migrasi, /DROP TRIGGER IF EXISTS trg_profiles_lock_role ON public\.profiles/);
    assert.match(migrasi, /role_change_requests_no_self_decision/);
    assert.match(migrasi, /uq_role_change_requests_pending_target/);
});
test('Toko Saya: query getSellerUmkm ter-scope user_id sesi (source guard)', () => {
    const storageSrc = readProjectFile('lib/product-storage.ts');
    const start = storageSrc.indexOf('export async function getSellerUmkm');
    const end = storageSrc.indexOf('export async function getSellerProducts', start);
    assert.ok(start >= 0 && end > start, 'getSellerUmkm tidak ditemukan');
    const fnBody = storageSrc.slice(start, end);
    assert.match(fnBody, /session\?\.user\?\.id/);
    assert.match(fnBody, /if \(!uid\)[\s\S]{0,20}return null;/);
    assert.match(fnBody, /\.eq\('user_id', uid\)/);
});
