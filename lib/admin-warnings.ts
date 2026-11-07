'use client';
import { AdminAuthError, getAdminAuthHeader } from './admin-auth';
export type WarningLevel = 1 | 2 | 3;
export interface WarningItem {
    id: string;
    userId: string | null;
    userName: string;
    userEmail: string | null;
    reportId: string | null;
    issuedBy: string | null;
    issuerName: string;
    issuerEmail: string | null;
    warningLevel: number;
    category: string;
    reason: string;
    createdAt: string;
}
export interface WarningsResult {
    warnings: WarningItem[];
    total: number;
    limit: number;
    offset: number;
}
export interface WarningOverviewUser {
    userId: string;
    userName: string;
    userEmail: string | null;
    warningCount: number;
    maxLevel: number;
    lastWarningAt: string | null;
}
export interface WarningOverviewResult {
    users: WarningOverviewUser[];
    total: number;
    limit: number;
    offset: number;
}
export class WarningsApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'WarningsApiError';
        this.status = status;
    }
}
async function authHeader(): Promise<string> {
    try {
        return await getAdminAuthHeader();
    }
    catch (err) {
        if (err instanceof AdminAuthError) {
            throw new WarningsApiError(err.message, 401);
        }
        throw err;
    }
}
export async function fetchWarnings(limit = 20, offset = 0, warningLevel?: WarningLevel, filters?: {
    userId?: string;
    reportId?: string;
    from?: string;
    to?: string;
}): Promise<WarningsResult> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (warningLevel)
        params.set('warningLevel', String(warningLevel));
    if (filters?.userId)
        params.set('userId', filters.userId);
    if (filters?.reportId)
        params.set('reportId', filters.reportId);
    if (filters?.from)
        params.set('from', filters.from);
    if (filters?.to)
        params.set('to', filters.to);
    const res = await fetch(`/api/admin/warnings?${params.toString()}`, {
        headers: { Authorization: await authHeader() },
    });
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new WarningsApiError(json?.error ?? 'Gagal memuat peringatan.', res.status);
    }
    const json = (await res.json().catch(() => null)) as WarningsResult | null;
    if (!json || !Array.isArray(json.warnings)) {
        throw new WarningsApiError('Respons peringatan tidak valid.', 500);
    }
    return json;
}
export async function fetchWarningOverview(limit = 50, offset = 0, q?: string): Promise<WarningOverviewResult> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (q)
        params.set('q', q);
    const res = await fetch(`/api/admin/warnings/overview?${params.toString()}`, {
        headers: { Authorization: await authHeader() },
    });
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new WarningsApiError(json?.error ?? 'Gagal memuat ringkasan peringatan.', res.status);
    }
    const json = (await res.json().catch(() => null)) as WarningOverviewResult | null;
    if (!json || !Array.isArray(json.users)) {
        throw new WarningsApiError('Respons peringatan tidak valid.', 500);
    }
    return json;
}
export async function issueWarning(input: {
    userId: string;
    warningLevel: WarningLevel;
    category: string;
    reason: string;
    reportId?: string | null;
}): Promise<void> {
    const res = await fetch('/api/admin/warnings', {
        method: 'POST',
        headers: {
            Authorization: await authHeader(),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new WarningsApiError(json?.error ?? 'Gagal menyimpan peringatan.', res.status);
    }
}
