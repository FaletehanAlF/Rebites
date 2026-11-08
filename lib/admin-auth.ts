'use client';
import { AuthError, fetchWithAuth as baseFetchWithAuth, getValidAuthHeader, refreshSessionSafe, } from './auth-token';
export class AdminAuthError extends AuthError {
    constructor(message = 'Sesi habis, silakan login ulang.', status = 401) {
        super(message, status);
        this.name = 'AdminAuthError';
    }
}
export interface AdminAuthHeaderOptions {
    forceRefresh?: boolean;
}
export async function getAdminAuthHeader(opts?: AdminAuthHeaderOptions): Promise<string> {
    try {
        return await getValidAuthHeader(opts);
    }
    catch (err) {
        if (err instanceof AuthError) {
            throw new AdminAuthError(err.message, err.status);
        }
        throw err;
    }
}
export async function refreshAdminSessionSafe(): Promise<boolean> {
    return refreshSessionSafe();
}
export { baseFetchWithAuth as fetchAdminWithAuth };
