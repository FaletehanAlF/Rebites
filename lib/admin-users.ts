'use client';
import { fetchAdminWithAuth } from './admin-auth';
import { AuthError } from './auth-token';
import type { AdminAccountStatusFilter, AdminRoleFilter } from './admin-user-filters';
export interface AdminUserUmkm {
    id: string | null;
    business_name: string | null;
    slug: string | null;
    is_verified: boolean;
}
export type AdminSellerStatus = 'active' | 'no_subscription' | 'no_store';
export interface AdminUserSubscription {
    plan_name: string | null;
    status: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
}
export interface AdminUserSeller {
    umkm_id: string | null;
    business_name: string | null;
    slug: string | null;
    is_verified: boolean;
    subscription: AdminUserSubscription | null;
}
export interface AdminUserItem {
    id: string | null;
    email: string | null;
    full_name: string | null;
    role: string | null;
    avatar_url: string | null;
    is_super_admin: boolean;
    is_verified: boolean;
    created_at: string | null;
    deleted_at: string | null;
    account_status: string | null;
    has_umkm: boolean;
    umkm: AdminUserUmkm | null;
    seller_status: AdminSellerStatus;
    seller: AdminUserSeller | null;
    coin_balance: number;
}
export interface AdminUserListResult {
    users: AdminUserItem[];
    total: number;
    limit: number;
    offset: number;
}
export class AdminUsersApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'AdminUsersApiError';
        this.status = status;
    }
}
async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
        return await fetchAdminWithAuth(input, init);
    }
    catch (err) {
        if (err instanceof AuthError) {
            throw new AdminUsersApiError(err.message, err.status);
        }
        throw err;
    }
}
async function parseError(res: Response, fallback: string): Promise<never> {
    const json = (await res.json().catch(() => null)) as {
        error?: string;
    } | null;
    throw new AdminUsersApiError(json?.error ?? fallback, res.status);
}
export interface AdminUserDetailUmkm {
    id: string | null;
    business_name: string | null;
    slug: string | null;
    is_verified: boolean;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    phone: string | null;
}
export interface AdminUserDetail {
    id: string | null;
    email: string | null;
    full_name: string | null;
    role: string | null;
    avatar_url: string | null;
    is_super_admin: boolean;
    phone: string | null;
    is_verified: boolean;
    created_at: string | null;
    deleted_at: string | null;
    deletion_reason: string | null;
    account_status: string | null;
    has_umkm: boolean;
    umkm: AdminUserDetailUmkm | null;
    seller_status: AdminSellerStatus;
    seller: AdminUserDetailSeller | null;
}
export interface AdminUserDetailSeller extends AdminUserSeller {
    description: string | null;
    category: string | null;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    phone: string | null;
}
export async function fetchAdminUserDetail(id: string): Promise<AdminUserDetail> {
    const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}`);
    if (!res.ok) {
        await parseError(res, 'Gagal memuat detail pengguna.');
    }
    const json = (await res.json().catch(() => null)) as {
        user?: AdminUserDetail;
    } | null;
    if (!json || !json.user) {
        throw new AdminUsersApiError('Respons detail pengguna tidak valid.', 500);
    }
    return json.user;
}
export type AllowedUserRole = 'buyer' | 'umkm' | 'admin';
export async function updateAdminUserRole(id: string, role: AllowedUserRole): Promise<{
    id: string | null;
    old_role: string | null;
    role: string | null;
}> {
    const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/role`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role }),
    });
    if (!res.ok) {
        await parseError(res, 'Gagal mengubah role.');
    }
    const json = (await res.json().catch(() => null)) as {
        user?: {
            id: string | null;
            old_role: string | null;
            role: string | null;
        };
    } | null;
    if (!json || !json.user) {
        throw new AdminUsersApiError('Respons ubah role tidak valid.', 500);
    }
    return json.user;
}
export type AdminDeletedFilter = 'exclude' | 'include';
export interface AdminUserListQuery {
    limit?: number;
    offset?: number;
    search?: string;
    sellerStatus?: '' | AdminSellerStatus;
    deleted?: AdminDeletedFilter;
    role?: '' | AdminRoleFilter;
    accountStatus?: '' | AdminAccountStatusFilter;
}
export async function fetchAdminUsers(query: AdminUserListQuery = {}): Promise<AdminUserListResult> {
    const limit = query.limit ?? 20;
    const offset = query.offset ?? 0;
    const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
    });
    const search = (query.search ?? '').trim();
    if (search)
        params.set('search', search);
    if (query.sellerStatus)
        params.set('sellerStatus', query.sellerStatus);
    if (query.deleted === 'include')
        params.set('deleted', 'include');
    if (query.role)
        params.set('role', query.role);
    if (query.accountStatus)
        params.set('accountStatus', query.accountStatus);
    const res = await adminFetch(`/api/admin/users?${params.toString()}`);
    if (!res.ok) {
        await parseError(res, 'Gagal memuat daftar pengguna.');
    }
    const json = (await res.json().catch(() => null)) as AdminUserListResult | null;
    if (!json || !Array.isArray(json.users)) {
        throw new AdminUsersApiError('Respons daftar pengguna tidak valid.', 500);
    }
    return {
        users: json.users,
        total: json.total ?? json.users.length,
        limit: json.limit ?? limit,
        offset: json.offset ?? offset,
    };
}
export interface AdminRoleHistoryActor {
    id: string | null;
    full_name: string | null;
    email: string | null;
}
export interface AdminRoleHistoryItem {
    id: string | null;
    old_role: string | null;
    new_role: string | null;
    created_at: string | null;
    actor: AdminRoleHistoryActor | null;
}
export interface AdminRoleHistoryResult {
    logs: AdminRoleHistoryItem[];
    total: number;
    limit: number;
    offset: number;
}
export async function fetchAdminRoleHistory(id: string, limit = 20, offset = 0): Promise<AdminRoleHistoryResult> {
    const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
    });
    const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/role-history?${params.toString()}`);
    if (!res.ok) {
        await parseError(res, 'Gagal memuat riwayat role.');
    }
    const json = (await res.json().catch(() => null)) as AdminRoleHistoryResult | null;
    if (!json || !Array.isArray(json.logs)) {
        throw new AdminUsersApiError('Respons riwayat role tidak valid.', 500);
    }
    return {
        logs: json.logs,
        total: json.total ?? json.logs.length,
        limit: json.limit ?? limit,
        offset: json.offset ?? offset,
    };
}
export interface AdminCoinHistoryItem {
    id: string;
    type: string;
    amount: number;
    description: string;
    orderCode: string | null;
    createdAt: string | null;
}
export interface AdminUserCoinsResult {
    balance: number;
    history: AdminCoinHistoryItem[];
    historyLimit: number;
    canAdjust: boolean;
    maxPerAction: number;
}
export async function fetchAdminUserCoins(id: string): Promise<AdminUserCoinsResult> {
    const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/coins`);
    if (!res.ok) {
        await parseError(res, 'Gagal memuat koin pengguna.');
    }
    const json = (await res.json().catch(() => null)) as AdminUserCoinsResult | null;
    if (!json || typeof json.balance !== 'number' || !Array.isArray(json.history)) {
        throw new AdminUsersApiError('Respons koin pengguna tidak valid.', 500);
    }
    return {
        balance: json.balance,
        history: json.history,
        historyLimit: json.historyLimit ?? json.history.length,
        canAdjust: json.canAdjust === true,
        maxPerAction: json.maxPerAction ?? 0,
    };
}
export async function setAdminUserDeletion(id: string, deleted: boolean, reason?: string): Promise<{
    deleted_at: string | null;
    store_deactivated: boolean;
}> {
    const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/deletion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deleted ? { deleted: true, reason: reason ?? '' } : { deleted: false }),
    });
    if (!res.ok) {
        await parseError(res, 'Gagal menyimpan status penghapusan akun.');
    }
    const json = (await res.json().catch(() => null)) as {
        deleted_at?: string | null;
        store_deactivated?: boolean;
    } | null;
    if (!json) {
        throw new AdminUsersApiError('Respons penghapusan akun tidak valid.', 500);
    }
    return {
        deleted_at: json.deleted_at ?? null,
        store_deactivated: json.store_deactivated === true,
    };
}
export async function adjustAdminUserCoins(id: string, delta: number, reason: string): Promise<{
    balance: number;
    auditRecorded: boolean;
}> {
    const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/coins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta, reason }),
    });
    if (!res.ok) {
        await parseError(res, 'Gagal menyesuaikan koin.');
    }
    const json = (await res.json().catch(() => null)) as {
        balance?: number;
        auditRecorded?: boolean;
    } | null;
    if (!json || typeof json.balance !== 'number') {
        throw new AdminUsersApiError('Respons penyesuaian koin tidak valid.', 500);
    }
    return { balance: json.balance, auditRecorded: json.auditRecorded !== false };
}
export interface AdminHardDeleteImpact {
    ordersAsBuyer: number;
    ordersInStore: number;
    activeOrders: number;
    products: number;
    reviews: number;
    coinTransactions: number;
    articles: number;
}
export interface AdminHardDeletePreview {
    configured: boolean;
    impact: AdminHardDeleteImpact;
    precondition: {
        allowed: true;
    } | {
        allowed: false;
        code: string;
        message: string;
    };
    target: {
        email: string | null;
    };
}
export async function fetchAdminHardDeletePreview(id: string): Promise<AdminHardDeletePreview> {
    const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/hard-deletion`);
    if (!res.ok) {
        await parseError(res, 'Gagal memuat dampak hapus permanen.');
    }
    const json = (await res.json().catch(() => null)) as AdminHardDeletePreview | null;
    if (!json ||
        typeof json.configured !== 'boolean' ||
        !json.impact ||
        !json.precondition) {
        throw new AdminUsersApiError('Respons dampak hapus permanen tidak valid.', 500);
    }
    return json;
}
export async function hardDeleteAdminUser(id: string, password: string, reason: string): Promise<{
    email: string | null;
    impact: AdminHardDeleteImpact;
    auditRecorded: boolean;
}> {
    const res = await adminFetch(`/api/admin/users/${encodeURIComponent(id)}/hard-deletion`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, reason }),
    });
    if (!res.ok) {
        await parseError(res, 'Gagal menghapus akun secara permanen.');
    }
    const json = (await res.json().catch(() => null)) as {
        deleted?: boolean;
        email?: string | null;
        impact?: AdminHardDeleteImpact;
        audit_recorded?: boolean;
    } | null;
    if (!json || json.deleted !== true || !json.impact) {
        throw new AdminUsersApiError('Respons hapus permanen tidak valid.', 500);
    }
    return {
        email: json.email ?? null,
        impact: json.impact,
        auditRecorded: json.audit_recorded !== false,
    };
}
