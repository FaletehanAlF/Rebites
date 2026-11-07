'use client';
import { AdminAuthError, getAdminAuthHeader } from './admin-auth';
import { isAdminHealthReport, type AdminHealthReport, } from './health-status';
export type { AdminHealthReport, HealthServiceReport, HealthStatus } from './health-status';
export class AdminHealthApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'AdminHealthApiError';
        this.status = status;
    }
}
export async function fetchAdminHealth(): Promise<AdminHealthReport> {
    let authorization: string;
    try {
        authorization = await getAdminAuthHeader();
    }
    catch (err) {
        if (err instanceof AdminAuthError) {
            throw new AdminHealthApiError(err.message, 401);
        }
        throw err;
    }
    const res = await fetch('/api/admin/health', {
        headers: { Authorization: authorization },
        cache: 'no-store',
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
        const message = json &&
            typeof json === 'object' &&
            !Array.isArray(json) &&
            typeof (json as {
                error?: unknown;
            }).error === 'string'
            ? (json as {
                error: string;
            }).error
            : 'Gagal memeriksa kesehatan sistem.';
        throw new AdminHealthApiError(message, res.status);
    }
    if (!isAdminHealthReport(json)) {
        throw new AdminHealthApiError('Respons pemeriksaan kesehatan tidak valid.', 500);
    }
    return json;
}
