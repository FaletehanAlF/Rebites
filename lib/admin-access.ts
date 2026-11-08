export type AdminUserRole = 'admin' | 'umkm' | 'buyer';
export interface SuperAdminEnv {
    SUPER_ADMIN_USER_ID?: string | undefined;
}
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function superAdminEnvFromProcess(): SuperAdminEnv {
    return { SUPER_ADMIN_USER_ID: process.env.SUPER_ADMIN_USER_ID };
}
export function resolveSuperAdminId(env: SuperAdminEnv = superAdminEnvFromProcess()): string | null {
    const raw = typeof env.SUPER_ADMIN_USER_ID === 'string' ? env.SUPER_ADMIN_USER_ID.trim() : '';
    if (!raw)
        return null;
    const normalized = raw.toLowerCase();
    if (!UUID_PATTERN.test(normalized)) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('[admin-access] SUPER_ADMIN_USER_ID bukan UUID valid; penunjukan diabaikan (fail-closed).');
        }
        return null;
    }
    return normalized;
}
export function isSuperAdminUserId(userId: string | null | undefined, env: SuperAdminEnv = superAdminEnvFromProcess()): boolean {
    if (typeof userId !== 'string' || !userId.trim())
        return false;
    const configured = resolveSuperAdminId(env);
    if (!configured)
        return false;
    return configured === userId.trim().toLowerCase();
}
export interface AdminActor {
    id: string;
    role: AdminUserRole | string | null | undefined;
    isSuperAdmin: boolean;
}
export interface AdminTarget {
    id: string;
    role: AdminUserRole | string | null | undefined;
    isSuperAdmin: boolean;
}
export type AdminDenyCode = 'not-admin' | 'super-admin-required' | 'super-admin-protected' | 'admin-protected' | 'self-demotion' | 'self-delete' | 'super-admin-direct' | 'self-request' | 'requester-cannot-decide' | 'request-not-pending' | 'no-change';
export type AdminDecision = {
    allowed: true;
} | {
    allowed: false;
    status: 403 | 409;
    code: AdminDenyCode;
    message: string;
};
function deny(code: AdminDenyCode, message: string): AdminDecision {
    return { allowed: false, status: 403, code, message };
}
function denyWith(status: 403 | 409, code: AdminDenyCode, message: string): AdminDecision {
    return { allowed: false, status, code, message };
}
export function canChangeUserRole(actor: AdminActor, target: AdminTarget, nextRole: AdminUserRole): AdminDecision {
    if (actor.role !== 'admin') {
        return deny('not-admin', 'Akses ditolak. Hanya admin.');
    }
    if (!actor.isSuperAdmin) {
        return deny('super-admin-required', 'Akses ditolak. Perubahan peran hanya dapat dilakukan oleh Super Admin.');
    }
    if (target.isSuperAdmin && nextRole !== 'admin') {
        return deny('self-demotion', 'Akun Super Admin tidak dapat dicabut hak adminnya (demosi).');
    }
    return { allowed: true };
}
export function canCreateRoleRequest(actor: AdminActor, target: AdminTarget, requestedRole: AdminUserRole): AdminDecision {
    if (actor.role !== 'admin') {
        return deny('not-admin', 'Akses ditolak. Hanya admin.');
    }
    if (actor.isSuperAdmin) {
        return deny('super-admin-direct', 'Super Admin dapat mengubah peran secara langsung, tanpa permintaan.');
    }
    if (target.id === actor.id) {
        return deny('self-request', 'Tidak dapat mengajukan permintaan untuk diri sendiri.');
    }
    if (target.isSuperAdmin) {
        return deny('super-admin-protected', 'Akun Super Admin dilindungi dan perannya tidak dapat diubah lewat permintaan.');
    }
    if (target.role === 'admin') {
        return deny('admin-protected', 'Perubahan peran akun admin hanya dapat dilakukan Super Admin secara langsung.');
    }
    if (target.role === requestedRole) {
        return denyWith(409, 'no-change', `Role pengguna sudah '${requestedRole}'. Tidak ada perubahan.`);
    }
    return { allowed: true };
}
export interface RoleRequestDecisionInput {
    requestedBy: string;
    status: string;
    targetIsSuperAdmin: boolean;
}
export function canDecideRoleRequest(actor: AdminActor, request: RoleRequestDecisionInput): AdminDecision {
    if (actor.role !== 'admin') {
        return deny('not-admin', 'Akses ditolak. Hanya admin.');
    }
    if (!actor.isSuperAdmin) {
        return deny('super-admin-required', 'Akses ditolak. Hanya Super Admin yang dapat menyetujui atau menolak permintaan.');
    }
    if (request.requestedBy === actor.id) {
        return deny('requester-cannot-decide', 'Permintaan yang Anda ajukan sendiri tidak dapat Anda putuskan.');
    }
    if (request.targetIsSuperAdmin) {
        return deny('super-admin-protected', 'Akun Super Admin dilindungi dan tidak dapat menjadi target keputusan.');
    }
    if (request.status !== 'pending') {
        return denyWith(409, 'request-not-pending', `Permintaan sudah diputuskan (status: ${request.status}).`);
    }
    return { allowed: true };
}
export function canIssueSanction(actor: AdminActor, target: AdminTarget): AdminDecision {
    if (actor.role !== 'admin') {
        return deny('not-admin', 'Akses ditolak. Hanya admin.');
    }
    if (target.isSuperAdmin) {
        return deny('super-admin-protected', 'Akun Super Admin dilindungi dan tidak dapat dikenai sanksi.');
    }
    if (!actor.isSuperAdmin && target.role === 'admin') {
        return deny('admin-protected', 'Admin tim tidak dapat memberikan sanksi kepada akun admin. Tindakan ini hanya untuk Super Admin.');
    }
    return { allowed: true };
}
export interface AdminMePayload {
    is_super_admin: boolean;
    super_admin_configured: boolean;
}
export function buildAdminMePayload(actor: Pick<AdminActor, 'isSuperAdmin'>, superAdminConfigured: boolean): AdminMePayload {
    return {
        is_super_admin: actor.isSuperAdmin === true,
        super_admin_configured: superAdminConfigured === true,
    };
}
export function canManageStore(actorUserId: string | null | undefined, storeOwnerUserId: string | null | undefined): boolean {
    if (typeof actorUserId !== 'string' || typeof storeOwnerUserId !== 'string') {
        return false;
    }
    const actor = actorUserId.trim();
    const owner = storeOwnerUserId.trim();
    return Boolean(actor && owner && actor === owner);
}
export interface AdminStoreTarget {
    id: string;
    ownerId: string;
    ownerIsSuperAdmin: boolean;
}
export function canManageAccountDeletion(actor: AdminActor, target: AdminTarget): AdminDecision {
    if (actor.role !== 'admin') {
        return deny('not-admin', 'Akses ditolak. Hanya admin.');
    }
    if (!actor.isSuperAdmin) {
        return deny('super-admin-required', 'Akses ditolak. Menghapus atau memulihkan akun hanya dapat dilakukan Super Admin.');
    }
    if (target.id === actor.id) {
        return deny('self-delete', 'Akun Anda sendiri tidak dapat dihapus dari panel admin.');
    }
    if (target.isSuperAdmin) {
        return deny('super-admin-protected', 'Akun Super Admin dilindungi dan tidak dapat dihapus.');
    }
    return { allowed: true };
}
export function canManageStoreDeletion(actor: AdminActor, target: AdminStoreTarget): AdminDecision {
    if (actor.role !== 'admin') {
        return deny('not-admin', 'Akses ditolak. Hanya admin.');
    }
    if (!actor.isSuperAdmin) {
        return deny('super-admin-required', 'Akses ditolak. Menghapus atau memulihkan toko hanya dapat dilakukan Super Admin.');
    }
    if (target.ownerIsSuperAdmin) {
        return deny('super-admin-protected', 'Toko milik akun Super Admin dilindungi dan tidak dapat dihapus.');
    }
    return { allowed: true };
}
export function canManageProductDeletion(actor: AdminActor): AdminDecision {
    if (actor.role !== 'admin') {
        return deny('not-admin', 'Akses ditolak. Hanya admin.');
    }
    if (!actor.isSuperAdmin) {
        return deny('super-admin-required', 'Akses ditolak. Menghapus atau memulihkan produk hanya dapat dilakukan Super Admin.');
    }
    return { allowed: true };
}
