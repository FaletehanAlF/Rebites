export const ADMIN_ROLE_FILTERS = ['admin', 'umkm', 'buyer'] as const;
export type AdminRoleFilter = (typeof ADMIN_ROLE_FILTERS)[number];
export const ADMIN_ACCOUNT_STATUS_FILTERS = ['active', 'suspended', 'banned'] as const;
export type AdminAccountStatusFilter = (typeof ADMIN_ACCOUNT_STATUS_FILTERS)[number];
export function isAdminRoleFilter(value: string): value is AdminRoleFilter {
    return (ADMIN_ROLE_FILTERS as readonly string[]).includes(value);
}
export function isAdminAccountStatusFilter(value: string): value is AdminAccountStatusFilter {
    return (ADMIN_ACCOUNT_STATUS_FILTERS as readonly string[]).includes(value);
}
export const ACCOUNT_STATUS_ACTIVE_CONDITION = 'account_status.is.null,account_status.eq.active';
export function accountStatusOrCondition(status: AdminAccountStatusFilter | null): string | null {
    if (!status)
        return null;
    if (status === 'active')
        return ACCOUNT_STATUS_ACTIVE_CONDITION;
    return `account_status.eq.${status}`;
}
export const ACCOUNT_STATUS_FILTER_LABELS: Record<AdminAccountStatusFilter, string> = {
    active: 'Aktif',
    suspended: 'Ditangguhkan',
    banned: 'Diblokir',
};
export const ROLE_FILTER_LABELS: Record<AdminRoleFilter, string> = {
    admin: 'Admin',
    umkm: 'UMKM',
    buyer: 'Pembeli',
};
