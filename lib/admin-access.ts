/**
 * Kebijakan akses admin ReBites — modul MURNI (tanpa dependensi runtime)
 * sehingga matriks izin dapat diuji langsung dengan `node --test`.
 *
 * Prinsip:
 * - `profiles.role = 'admin'` berarti "admin tim". Admin tim boleh
 *   menjalankan operasional rutin (moderasi, peringatan, sanksi ke pengguna
 *   biasa), TETAPI tidak boleh mengubah peran siapa pun dan tidak boleh
 *   menyasar akun admin lain / Super Admin.
 * - Super Admin ditunjuk EKSPLISIT lewat env server-only
 *   `SUPER_ADMIN_USER_ID` (UUID auth.users, dicocokkan dengan user yang
 *   diverifikasi server). Bila env kosong/tidak valid → TIDAK ADA yang
 *   dianggap Super Admin (fail-closed); semua keputusan sensitif ditolak.
 * - Satu-satunya Super Admin TIDAK dapat didemosi dan TIDAK dapat dikenai
 *   sanksi (suspend/ban/delete) lewat API — termasuk oleh dirinya sendiri
 *   (anti-lockout).
 */

export type AdminUserRole = 'admin' | 'umkm' | 'buyer';

/** Subset process.env yang dibutuhkan; dipisah agar test bisa menyuntik env. */
export interface SuperAdminEnv {
  SUPER_ADMIN_USER_ID?: string | undefined;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function superAdminEnvFromProcess(): SuperAdminEnv {
  return { SUPER_ADMIN_USER_ID: process.env.SUPER_ADMIN_USER_ID };
}

/**
 * Baca UUID Super Admin dari env (server-only).
 * - Trim + normalisasi huruf kecil (UUID Supabase selalu huruf kecil).
 * - Bukan UUID valid → null (dianggap belum dikonfigurasi; JANGAN diam-diam
 *   mempercayai nilai bebas). Nilai mentah TIDAK pernah dicatat ke log.
 */
export function resolveSuperAdminId(
  env: SuperAdminEnv = superAdminEnvFromProcess()
): string | null {
  const raw =
    typeof env.SUPER_ADMIN_USER_ID === 'string' ? env.SUPER_ADMIN_USER_ID.trim() : '';
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[admin-access] SUPER_ADMIN_USER_ID bukan UUID valid; penunjukan diabaikan (fail-closed).'
      );
    }
    return null;
  }
  return normalized;
}

/** true hanya bila `userId` (dari user terverifikasi server) = Super Admin terkonfigurasi. */
export function isSuperAdminUserId(
  userId: string | null | undefined,
  env: SuperAdminEnv = superAdminEnvFromProcess()
): boolean {
  if (typeof userId !== 'string' || !userId.trim()) return false;
  const configured = resolveSuperAdminId(env);
  if (!configured) return false;
  return configured === userId.trim().toLowerCase();
}

export interface AdminActor {
  id: string;
  /** `'admin'` setelah getAdminUser() lolos verifikasi profiles.role. */
  role: AdminUserRole | string | null | undefined;
  /** true HANYA bila id actor = SUPER_ADMIN_USER_ID terkonfigurasi. */
  isSuperAdmin: boolean;
}

export interface AdminTarget {
  id: string;
  role: AdminUserRole | string | null | undefined;
  /** true bila id target = SUPER_ADMIN_USER_ID terkonfigurasi. */
  isSuperAdmin: boolean;
}

export type AdminDenyCode =
  | 'not-admin'
  | 'super-admin-required'
  | 'super-admin-protected'
  | 'admin-protected'
  | 'self-demotion'
  | 'super-admin-direct'
  | 'self-request'
  | 'requester-cannot-decide'
  | 'request-not-pending'
  | 'no-change';

export type AdminDecision =
  | { allowed: true }
  | { allowed: false; status: 403 | 409; code: AdminDenyCode; message: string };

function deny(code: AdminDenyCode, message: string): AdminDecision {
  return { allowed: false, status: 403, code, message };
}

function denyWith(
  status: 403 | 409,
  code: AdminDenyCode,
  message: string
): AdminDecision {
  return { allowed: false, status, code, message };
}

/**
 * Ubah peran pengguna (PATCH /api/admin/users/:id/role).
 *
 * - Admin tim SELALU ditolak → tidak ada eskalasi hak akses.
 * - Hanya Super Admin boleh mengubah peran (termasuk menunjuk/mencabut
 *   admin tim).
 * - Akun Super Admin tidak dapat dicabut hak adminnya (demosi) oleh siapa
 *   pun, termasuk dirinya sendiri (anti-lockout).
 */
export function canChangeUserRole(
  actor: AdminActor,
  target: AdminTarget,
  nextRole: AdminUserRole
): AdminDecision {
  if (actor.role !== 'admin') {
    return deny('not-admin', 'Akses ditolak. Hanya admin.');
  }
  if (!actor.isSuperAdmin) {
    return deny(
      'super-admin-required',
      'Akses ditolak. Perubahan peran hanya dapat dilakukan oleh Super Admin.'
    );
  }
  if (target.isSuperAdmin && nextRole !== 'admin') {
    return deny(
      'self-demotion',
      'Akun Super Admin tidak dapat dicabut hak adminnya (demosi).'
    );
  }
  return { allowed: true };
}

/**
 * Ajukan permintaan perubahan role (POST /api/admin/role-requests).
 *
 * - Hanya admin tim (bukan Super Admin) yang mengajukan; Super Admin
 *   mengubah role langsung lewat PATCH /api/admin/users/:id/role.
 * - Target tidak boleh diri sendiri, bukan akun Super Admin, dan bukan
 *   akun admin tim (konsisten: admin tim tidak menyasar akun admin).
 * - Permintaan no-op (role target = role diminta) ditolak 409.
 *
 * Ini spesifikasi yang diuji; penegakan sebenarnya tetap di route server.
 */
export function canCreateRoleRequest(
  actor: AdminActor,
  target: AdminTarget,
  requestedRole: AdminUserRole
): AdminDecision {
  if (actor.role !== 'admin') {
    return deny('not-admin', 'Akses ditolak. Hanya admin.');
  }
  if (actor.isSuperAdmin) {
    return deny(
      'super-admin-direct',
      'Super Admin dapat mengubah peran secara langsung, tanpa permintaan.'
    );
  }
  if (target.id === actor.id) {
    return deny(
      'self-request',
      'Tidak dapat mengajukan permintaan untuk diri sendiri.'
    );
  }
  if (target.isSuperAdmin) {
    return deny(
      'super-admin-protected',
      'Akun Super Admin dilindungi dan perannya tidak dapat diubah lewat permintaan.'
    );
  }
  if (target.role === 'admin') {
    return deny(
      'admin-protected',
      'Perubahan peran akun admin hanya dapat dilakukan Super Admin secara langsung.'
    );
  }
  if (target.role === requestedRole) {
    return denyWith(
      409,
      'no-change',
      `Role pengguna sudah '${requestedRole}'. Tidak ada perubahan.`
    );
  }
  return { allowed: true };
}

/** Input keputusan (nilai dari server, bukan payload client). */
export interface RoleRequestDecisionInput {
  requestedBy: string;
  status: string;
  targetIsSuperAdmin: boolean;
}

/**
 * Putuskan permintaan perubahan role
 * (POST /api/admin/role-requests/:id/approve|reject).
 *
 * - Hanya Super Admin.
 * - Pemohon tidak dapat memutuskan permintaannya sendiri (anti self-approval),
 *   termasuk bila pemohon adalah Super Admin.
 * - Hanya status 'pending' yang dapat diputuskan (anti proses ganda).
 * - Akun Super Admin tidak dapat menjadi target keputusan.
 *
 * Klaim atomik + exactly-once tetap ditegakkan di RPC database
 * (decide_role_change_request); fungsi ini spesifikasi teruji untuk route.
 */
export function canDecideRoleRequest(
  actor: AdminActor,
  request: RoleRequestDecisionInput
): AdminDecision {
  if (actor.role !== 'admin') {
    return deny('not-admin', 'Akses ditolak. Hanya admin.');
  }
  if (!actor.isSuperAdmin) {
    return deny(
      'super-admin-required',
      'Akses ditolak. Hanya Super Admin yang dapat menyetujui atau menolak permintaan.'
    );
  }
  if (request.requestedBy === actor.id) {
    return deny(
      'requester-cannot-decide',
      'Permintaan yang Anda ajukan sendiri tidak dapat Anda putuskan.'
    );
  }
  if (request.targetIsSuperAdmin) {
    return deny(
      'super-admin-protected',
      'Akun Super Admin dilindungi dan tidak dapat menjadi target keputusan.'
    );
  }
  if (request.status !== 'pending') {
    return denyWith(
      409,
      'request-not-pending',
      `Permintaan sudah diputuskan (status: ${request.status}).`
    );
  }
  return { allowed: true };
}

/**
 * Terbitkan sanksi (POST /api/admin/sanctions: suspend/ban/delete).
 *
 * - Akun Super Admin dilindungi dari semua bentuk sanksi lewat jalur ini,
 *   oleh siapa pun (termasuk dirinya sendiri).
 * - Admin tim tidak boleh menyasar akun admin lain (termasuk Super Admin);
 *   sanksi ke akun admin hanya oleh Super Admin.
 * - Admin tim tetap boleh memberi sanksi ke pembeli/UMKM.
 */
export function canIssueSanction(actor: AdminActor, target: AdminTarget): AdminDecision {
  if (actor.role !== 'admin') {
    return deny('not-admin', 'Akses ditolak. Hanya admin.');
  }
  if (target.isSuperAdmin) {
    return deny(
      'super-admin-protected',
      'Akun Super Admin dilindungi dan tidak dapat dikenai sanksi.'
    );
  }
  if (!actor.isSuperAdmin && target.role === 'admin') {
    return deny(
      'admin-protected',
      'Admin tim tidak dapat memberikan sanksi kepada akun admin. Tindakan ini hanya untuk Super Admin.'
    );
  }
  return { allowed: true };
}

export interface AdminMePayload {
  is_super_admin: boolean;
  super_admin_configured: boolean;
}

/**
 * Payload minimum GET /api/admin/me untuk gating UI.
 * TIDAK memuat id/email/UUID siapa pun — hanya dua boolean.
 */
export function buildAdminMePayload(
  actor: Pick<AdminActor, 'isSuperAdmin'>,
  superAdminConfigured: boolean
): AdminMePayload {
  return {
    is_super_admin: actor.isSuperAdmin === true,
    super_admin_configured: superAdminConfigured === true,
  };
}

/**
 * Batas kepemilikan toko: toko (Toko Saya) hanya boleh dikelola pemiliknya.
 * Dipakai sebagai spesifikasi yang diuji; penegakan data sebenarnya ada di
 * query ber-scope `user_id = uid` + RLS Supabase.
 */
export function canManageStore(
  actorUserId: string | null | undefined,
  storeOwnerUserId: string | null | undefined
): boolean {
  if (typeof actorUserId !== 'string' || typeof storeOwnerUserId !== 'string') {
    return false;
  }
  const actor = actorUserId.trim();
  const owner = storeOwnerUserId.trim();
  return Boolean(actor && owner && actor === owner);
}
