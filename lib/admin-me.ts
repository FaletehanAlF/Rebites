'use client';
import { fetchAdminWithAuth } from './admin-auth';
import { AuthError } from './auth-token';
export interface AdminMe {
    isSuperAdmin: boolean;
    superAdminConfigured: boolean;
}
export class AdminMeApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'AdminMeApiError';
        this.status = status;
    }
}
export async function fetchAdminMe(): Promise<AdminMe> {
    let res: Response;
    try {
        res = await fetchAdminWithAuth('/api/admin/me', { cache: 'no-store' });
    }
    catch (err) {
        if (err instanceof AuthError) {
            throw new AdminMeApiError(err.message, err.status);
        }
        throw err;
    }
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new AdminMeApiError(json?.error ?? 'Gagal memuat status akses admin.', res.status);
    }
    const json = (await res.json().catch(() => null)) as {
        is_super_admin?: unknown;
        super_admin_configured?: unknown;
    } | null;
    if (!json ||
        typeof json.is_super_admin !== 'boolean' ||
        typeof json.super_admin_configured !== 'boolean') {
        throw new AdminMeApiError('Respons status akses admin tidak valid.', 500);
    }
    return {
        isSuperAdmin: json.is_super_admin,
        superAdminConfigured: json.super_admin_configured,
    };
}
