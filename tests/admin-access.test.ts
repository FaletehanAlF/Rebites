/**
 * Matriks izin Super Admin / admin tim ReBites — lokal, tanpa database.
 *
 * Membuktikan tanpa Supabase:
 * - Hanya Super Admin (env SUPER_ADMIN_USER_ID, dicocokkan dengan id user
 *   terverifikasi) yang boleh mengubah peran; admin tim ditolak 403.
 * - Akun Super Admin tidak dapat didemosi lewat endpoint peran.
 * - Admin tim tidak dapat menyasar admin/Super Admin dengan sanksi;
 *   akun Super Admin terlindungi dari semua sanksi lewat jalur API.
 * - Non-admin selalu ditolak.
 * - Env belum dikonfigurasi / bukan UUID → fail-closed (tidak ada Super Admin).
 * - Payload /api/admin/me hanya berisi dua boolean (tanpa UUID/rahasia).
 * - Batas Toko Saya: hanya pemilik (user_id sama) yang boleh mengelola;
 *   query nyata getSellerUmkm ter-scope user_id sesi.
 *
 * Penegakan akhir di route server dijaga lewat source-guard wiring —
 * route Next tidak dapat dijalankan langsung di node:test (alias '@/',
 * next/server, dan sesi Supabase asli tidak tersedia offline).
 *
 * Jalankan: node --test tests/admin-access.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  buildAdminMePayload,
  canChangeUserRole,
  canCreateRoleRequest,
  canDecideRoleRequest,
  canIssueSanction,
  canManageStore,
  isSuperAdminUserId,
  resolveSuperAdminId,
} from '../lib/admin-access.ts';
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

  // Admin tim TIDAK dapat mengubah peran siapa pun (tidak ada eskalasi).
  const teamActor = actor({ id: TEAM_ID, isSuperAdmin: false });
  for (const nextRole of ['buyer', 'umkm', 'admin'] as const) {
    const denied = canChangeUserRole(teamActor, target(), nextRole);
    assert.equal(denied.allowed, false);
    if (!denied.allowed) {
      assert.equal(denied.status, 403);
      assert.equal(denied.code, 'super-admin-required');
    }
  }

  // Admin tim juga tidak dapat menyentuh akun Super Admin.
  const deniedOnSuper = canChangeUserRole(
    teamActor,
    target({ id: SUPER_ID, role: 'admin', isSuperAdmin: true }),
    'buyer'
  );
  assert.equal(deniedOnSuper.allowed, false);

  // Non-admin (pembeli/penjual) selalu ditolak.
  const buyerDecision = canChangeUserRole(
    actor({ role: 'buyer', isSuperAdmin: false }),
    target(),
    'admin'
  );
  assert.equal(buyerDecision.allowed, false);
  if (!buyerDecision.allowed) assert.equal(buyerDecision.code, 'not-admin');
});

test('canChangeUserRole: Super Admin dapat mengelola admin tim, tetapi tidak dapat didemosi', () => {
  // Super Admin menunjuk admin tim baru / menurunkan admin tim lama.
  assert.deepEqual(
    canChangeUserRole(actor(), target({ id: BUYER_ID, role: 'buyer' }), 'admin'),
    { allowed: true }
  );
  assert.deepEqual(
    canChangeUserRole(actor(), target({ id: TEAM_ID, role: 'admin' }), 'umkm'),
    { allowed: true }
  );

  // Akun Super Admin tidak dapat dicabut hak adminnya, termasuk oleh dirinya.
  for (const nextRole of ['buyer', 'umkm'] as const) {
    const denied = canChangeUserRole(
      actor(),
      target({ id: SUPER_ID, role: 'admin', isSuperAdmin: true }),
      nextRole
    );
    assert.equal(denied.allowed, false);
    if (!denied.allowed) {
      assert.equal(denied.status, 403);
      assert.equal(denied.code, 'self-demotion');
    }
  }

  // Set ke 'admin' (no-op) tidak diblokir kebijakan; route mengembalikan 409.
  assert.deepEqual(
    canChangeUserRole(
      actor(),
      target({ id: SUPER_ID, role: 'admin', isSuperAdmin: true }),
      'admin'
    ),
    { allowed: true }
  );
});

test('canIssueSanction: admin tim tidak dapat menyasar admin/Super Admin', () => {
  const teamActor = actor({ id: TEAM_ID, isSuperAdmin: false });

  // Operasional rutin ke pembeli/UMKM tetap boleh.
  assert.deepEqual(canIssueSanction(teamActor, target()), { allowed: true });
  assert.deepEqual(canIssueSanction(teamActor, target({ role: 'umkm' })), { allowed: true });

  // Menyasar admin lain → ditolak.
  const deniedAdmin = canIssueSanction(teamActor, target({ id: TEAM_ID, role: 'admin' }));
  assert.equal(deniedAdmin.allowed, false);
  if (!deniedAdmin.allowed) {
    assert.equal(deniedAdmin.status, 403);
    assert.equal(deniedAdmin.code, 'admin-protected');
  }

  // Menyasar Super Admin → ditolak.
  const deniedSuper = canIssueSanction(
    teamActor,
    target({ id: SUPER_ID, role: 'admin', isSuperAdmin: true })
  );
  assert.equal(deniedSuper.allowed, false);
  if (!deniedSuper.allowed) assert.equal(deniedSuper.code, 'super-admin-protected');

  // Non-admin ditolak.
  const deniedBuyer = canIssueSanction(actor({ role: 'buyer', isSuperAdmin: false }), target());
  assert.equal(deniedBuyer.allowed, false);
  if (!deniedBuyer.allowed) assert.equal(deniedBuyer.code, 'not-admin');
});

test('canIssueSanction: Super Admin terlindungi dari sanksi; admin tim boleh disasar Super Admin', () => {
  // Super Admin tidak dapat menyasar akun Super Admin (termasuk dirinya).
  const deniedSelf = canIssueSanction(
    actor(),
    target({ id: SUPER_ID, role: 'admin', isSuperAdmin: true })
  );
  assert.equal(deniedSelf.allowed, false);
  if (!deniedSelf.allowed) {
    assert.equal(deniedSelf.code, 'super-admin-protected');
    assert.equal(deniedSelf.status, 403);
  }

  // Sanksi ke admin tim / pembeli boleh oleh Super Admin.
  assert.deepEqual(
    canIssueSanction(actor(), target({ id: TEAM_ID, role: 'admin' })),
    { allowed: true }
  );
  assert.deepEqual(canIssueSanction(actor(), target()), { allowed: true });
});

test('resolveSuperAdminId: hanya UUID valid; case-insensitive; fail-closed bila kosong', () => {
  assert.equal(resolveSuperAdminId({}), null);
  assert.equal(resolveSuperAdminId({ SUPER_ADMIN_USER_ID: '' }), null);
  assert.equal(resolveSuperAdminId({ SUPER_ADMIN_USER_ID: '   ' }), null);
  assert.equal(resolveSuperAdminId({ SUPER_ADMIN_USER_ID: 'bukan-uuid' }), null);
  assert.equal(resolveSuperAdminId({ SUPER_ADMIN_USER_ID: 'admin@rebites.id' }), null);
  assert.equal(resolveSuperAdminId({ SUPER_ADMIN_USER_ID: '1234' }), null);

  // UUID valid dinormalisasi (trim + huruf kecil).
  assert.equal(
    resolveSuperAdminId({ SUPER_ADMIN_USER_ID: `  ${SUPER_ID.toUpperCase()}  ` }),
    SUPER_ID
  );
});

test('isSuperAdminUserId: pencocokan id terverifikasi vs env (tanpa menebak)', () => {
  const env = { SUPER_ADMIN_USER_ID: SUPER_ID };
  assert.equal(isSuperAdminUserId(SUPER_ID, env), true);
  assert.equal(isSuperAdminUserId(SUPER_ID.toUpperCase(), env), true);
  assert.equal(isSuperAdminUserId(` ${SUPER_ID} `, env), true);
  assert.equal(isSuperAdminUserId(TEAM_ID, env), false);
  assert.equal(isSuperAdminUserId(null, env), false);
  assert.equal(isSuperAdminUserId('', env), false);
  // Env kosong → TIDAK ADA yang dianggap Super Admin.
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

  // Alur normal: admin tim mengajukan perubahan role pembeli/UMKM.
  assert.deepEqual(canCreateRoleRequest(teamActor, target(), 'umkm'), { allowed: true });
  assert.deepEqual(canCreateRoleRequest(teamActor, target({ role: 'umkm' }), 'buyer'), {
    allowed: true,
  });
  assert.deepEqual(canCreateRoleRequest(teamActor, target(), 'admin'), { allowed: true });

  // Super Admin mengubah langsung; permintaan hanya untuk admin tim.
  const deniedSuper = canCreateRoleRequest(actor(), target(), 'umkm');
  assert.equal(deniedSuper.allowed, false);
  if (!deniedSuper.allowed) {
    assert.equal(deniedSuper.status, 403);
    assert.equal(deniedSuper.code, 'super-admin-direct');
  }

  // Tidak boleh menargetkan diri sendiri.
  const deniedSelf = canCreateRoleRequest(teamActor, target({ id: TEAM_ID }), 'umkm');
  assert.equal(deniedSelf.allowed, false);
  if (!deniedSelf.allowed) assert.equal(deniedSelf.code, 'self-request');

  // Akun Super Admin selalu terlindungi dari permintaan.
  const deniedProtected = canCreateRoleRequest(
    teamActor,
    target({ id: SUPER_ID, role: 'admin', isSuperAdmin: true }),
    'umkm'
  );
  assert.equal(deniedProtected.allowed, false);
  if (!deniedProtected.allowed) {
    assert.equal(deniedProtected.code, 'super-admin-protected');
  }

  // Admin tim tidak dapat mengajukan perubahan untuk akun admin lain.
  const deniedAdmin = canCreateRoleRequest(
    teamActor,
    target({ id: BUYER_ID, role: 'admin' }),
    'umkm'
  );
  assert.equal(deniedAdmin.allowed, false);
  if (!deniedAdmin.allowed) assert.equal(deniedAdmin.code, 'admin-protected');

  // No-op (role target = role diminta) ditolak 409.
  const deniedNoop = canCreateRoleRequest(teamActor, target(), 'buyer');
  assert.equal(deniedNoop.allowed, false);
  if (!deniedNoop.allowed) {
    assert.equal(deniedNoop.status, 409);
    assert.equal(deniedNoop.code, 'no-change');
  }

  // Non-admin ditolak.
  const deniedBuyer = canCreateRoleRequest(
    actor({ role: 'buyer', isSuperAdmin: false }),
    target(),
    'umkm'
  );
  assert.equal(deniedBuyer.allowed, false);
  if (!deniedBuyer.allowed) assert.equal(deniedBuyer.code, 'not-admin');
});

test('canDecideRoleRequest: hanya Super Admin, bukan pemohon, hanya status pending', () => {
  const pengajuan = { requestedBy: TEAM_ID, status: 'pending', targetIsSuperAdmin: false };

  // Super Admin memutuskan permintaan admin tim.
  assert.deepEqual(canDecideRoleRequest(actor(), pengajuan), { allowed: true });

  // Admin tim tidak dapat memutuskan (tidak ada bypass lewat API).
  const deniedTeam = canDecideRoleRequest(
    actor({ id: TEAM_ID, isSuperAdmin: false }),
    pengajuan
  );
  assert.equal(deniedTeam.allowed, false);
  if (!deniedTeam.allowed) {
    assert.equal(deniedTeam.status, 403);
    assert.equal(deniedTeam.code, 'super-admin-required');
  }

  // Pemohon (walau Super Admin) tidak dapat memutuskan permintaannya sendiri.
  const deniedSelf = canDecideRoleRequest(actor(), {
    requestedBy: SUPER_ID,
    status: 'pending',
    targetIsSuperAdmin: false,
  });
  assert.equal(deniedSelf.allowed, false);
  if (!deniedSelf.allowed) assert.equal(deniedSelf.code, 'requester-cannot-decide');

  // Permintaan yang sudah diputuskan tidak dapat diproses dua kali.
  for (const status of ['approved', 'rejected'] as const) {
    const deniedDecided = canDecideRoleRequest(actor(), { ...pengajuan, status });
    assert.equal(deniedDecided.allowed, false);
    if (!deniedDecided.allowed) {
      assert.equal(deniedDecided.status, 409);
      assert.equal(deniedDecided.code, 'request-not-pending');
    }
  }

  // Target Super Admin tidak dapat diputuskan.
  const deniedTarget = canDecideRoleRequest(actor(), {
    ...pengajuan,
    targetIsSuperAdmin: true,
  });
  assert.equal(deniedTarget.allowed, false);
  if (!deniedTarget.allowed) assert.equal(deniedTarget.code, 'super-admin-protected');

  // Non-admin ditolak.
  const deniedBuyer = canDecideRoleRequest(
    actor({ role: 'buyer', isSuperAdmin: false }),
    pengajuan
  );
  assert.equal(deniedBuyer.allowed, false);
  if (!deniedBuyer.allowed) assert.equal(deniedBuyer.code, 'not-admin');
});

test('wiring server: permintaan role memakai kebijakan + RPC service-role (source guard)', () => {
  // API daftar/ajukan.
  const listRoute = readProjectFile('app/api/admin/role-requests/route.ts');
  assert.match(listRoute, /getAdminActor\(/);
  assert.match(listRoute, /canCreateRoleRequest\(/);
  assert.match(listRoute, /isSuperAdminUserId\(/);
  assert.match(listRoute, /createAuthedServerClient\(/);
  // requested_by_me dihitung server dari id aktor terverifikasi.
  assert.match(listRoute, /requested_by_me: requesterId !== null && requesterId === actor\.id/);

  // Setujui: Super Admin + RPC decide_role_change_request lewat service-role.
  const approveRoute = readProjectFile('app/api/admin/role-requests/[id]/approve/route.ts');
  assert.match(approveRoute, /getAdminActor\(/);
  assert.match(approveRoute, /canDecideRoleRequest\(/);
  assert.match(approveRoute, /isSuperAdminUserId\(/);
  assert.match(approveRoute, /createServiceClient\(/);
  assert.match(approveRoute, /decide_role_change_request/);
  assert.match(approveRoute, /p_decision: 'approved'/);

  // Tolak: kebijakan + RPC yang sama (role tidak disentuh).
  const rejectRoute = readProjectFile('app/api/admin/role-requests/[id]/reject/route.ts');
  assert.match(rejectRoute, /canDecideRoleRequest\(/);
  assert.match(rejectRoute, /createServiceClient\(/);
  assert.match(rejectRoute, /decide_role_change_request/);
  assert.match(rejectRoute, /p_decision: 'rejected'/);

  // Jalur langsung Super Admin kini lewat RPC (tanpa update role langsung).
  const roleRoute = readProjectFile('app/api/admin/users/[id]/role/route.ts');
  assert.match(roleRoute, /apply_role_change/);
  assert.match(roleRoute, /createServiceClient\(/);
  assert.doesNotMatch(roleRoute, /\.update\(\{ role/);

  // Badge Super Admin dari boolean server (tanpa UUID).
  const usersRoute = readProjectFile('app/api/admin/users/route.ts');
  assert.match(usersRoute, /is_super_admin: isSuperAdminUserId\(/);
  const usersView = readProjectFile('app/components/admin/users-management-view.tsx');
  assert.match(usersView, /Super Admin/);
  const detailView = readProjectFile('app/components/admin/user-detail-view.tsx');
  assert.match(detailView, /user\.is_super_admin === true/);

  // Menu + halaman Permintaan Role.
  const sidebar = readProjectFile('app/components/admin/admin-sidebar.tsx');
  assert.match(sidebar, /\/dashboard\/admin\/permintaan-role/);
  const page = readProjectFile('app/dashboard/admin/permintaan-role/page.tsx');
  assert.match(page, /RoleRequestsView/);

  // Editor: admin tim mengajukan (createRoleRequest), Super Admin langsung.
  const editor = readProjectFile('app/components/admin/user-role-editor.tsx');
  assert.match(editor, /createRoleRequest\(/);
  assert.match(editor, /updateAdminUserRole\(/);
});

test('migrasi role_change_requests: RPC service-role + tanpa jalur bypass (source guard)', () => {
  const migrasi = readProjectFile(
    'supabase/migrations/20261017000000_role_request_approval.sql'
  );

  // Tabel + RLS + insert policy terikat pemohon (auth.uid()) + target non-admin.
  assert.match(migrasi, /CREATE TABLE IF NOT EXISTS public\.role_change_requests/);
  assert.match(migrasi, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migrasi, /"role_change_requests_insert_admin"/);
  assert.match(migrasi, /requested_by = auth\.uid\(\)/);
  assert.match(migrasi, /p\.role <> 'admin'/);
  assert.match(migrasi, /requested_by <> target_user_id/);
  // Tanpa policy UPDATE/DELETE untuk authenticated (status hanya via RPC).
  assert.doesNotMatch(migrasi, /role_change_requests_update_admin/);
  assert.doesNotMatch(migrasi, /role_change_requests_delete_admin/);

  // RPC hanya dapat dieksekusi service_role (admin tim ditolak PostgREST).
  assert.match(
    migrasi,
    /REVOKE EXECUTE ON FUNCTION public\.decide_role_change_request\(uuid, uuid, text, text\)\s+FROM PUBLIC, anon, authenticated;/
  );
  assert.match(
    migrasi,
    /GRANT EXECUTE ON FUNCTION public\.decide_role_change_request\(uuid, uuid, text, text\)\s+TO service_role;/
  );
  assert.match(
    migrasi,
    /REVOKE EXECUTE ON FUNCTION public\.apply_role_change\(uuid, text, uuid\)\s+FROM PUBLIC, anon, authenticated;/
  );
  assert.match(
    migrasi,
    /GRANT EXECUTE ON FUNCTION public\.apply_role_change\(uuid, text, uuid\)\s+TO service_role;/
  );

  // Exactly-once + verifikasi pasca-update (rollback bila trigger menolak).
  assert.match(migrasi, /FOR UPDATE/);
  assert.match(migrasi, /AND status = 'pending'/);
  assert.match(migrasi, /role tidak berubah \(konteks bukan service_role\?\)/);

  // Hardening trigger: perubahan role hanya dari konteks service_role.
  assert.match(migrasi, /\(auth\.jwt\(\) ->> 'role'\) = 'service_role'/);
  assert.match(migrasi, /trg_profiles_lock_role/);
  assert.match(migrasi, /DROP TRIGGER IF EXISTS trg_profiles_lock_role ON public\.profiles/);

  // Anti self-approval + satu permintaan pending per target.
  assert.match(migrasi, /role_change_requests_no_self_decision/);
  assert.match(migrasi, /uq_role_change_requests_pending_target/);
});

test('Toko Saya: query getSellerUmkm ter-scope user_id sesi (source guard)', () => {
  const storageSrc = readProjectFile('lib/product-storage.ts');
  const start = storageSrc.indexOf('export async function getSellerUmkm');
  const end = storageSrc.indexOf('export async function getSellerProducts', start);
  assert.ok(start >= 0 && end > start, 'getSellerUmkm tidak ditemukan');

  const fnBody = storageSrc.slice(start, end);
  // Toko hanya diambil milik user yang login; tanpa uid → null (tanpa query).
  assert.match(fnBody, /session\?\.user\?\.id/);
  assert.match(fnBody, /if \(!uid\) return null;/);
  assert.match(fnBody, /\.eq\('user_id', uid\)/);
});
