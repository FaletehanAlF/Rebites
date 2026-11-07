'use client';
import { fetchAdminWithAuth } from './admin-auth';
import { AuthError } from './auth-token';
export interface ActivityLogItem {
    id: string;
    userId: string | null;
    userName: string;
    userEmail: string | null;
    userRole: string | null;
    activityType: string;
    description: string;
    targetType: string | null;
    targetId: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
}
export interface ActivityLogsResult {
    logs: ActivityLogItem[];
    total: number;
    limit: number;
    offset: number;
}
export class ActivityLogsApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'ActivityLogsApiError';
        this.status = status;
    }
}
async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    try {
        return await fetchAdminWithAuth(input, init);
    }
    catch (err) {
        if (err instanceof AuthError) {
            throw new ActivityLogsApiError(err.message, err.status);
        }
        throw err;
    }
}
export async function fetchActivityLogs(limit = 20, offset = 0, filters?: {
    activityType?: string;
    targetType?: string;
    userId?: string;
    targetId?: string;
    id?: string;
    from?: string;
    to?: string;
}): Promise<ActivityLogsResult> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (filters?.activityType)
        params.set('activityType', filters.activityType);
    if (filters?.targetType)
        params.set('targetType', filters.targetType);
    if (filters?.userId)
        params.set('userId', filters.userId);
    if (filters?.targetId)
        params.set('targetId', filters.targetId);
    if (filters?.id)
        params.set('id', filters.id);
    if (filters?.from)
        params.set('from', filters.from);
    if (filters?.to)
        params.set('to', filters.to);
    const res = await adminFetch(`/api/admin/activity-logs?${params.toString()}`);
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new ActivityLogsApiError(json?.error ?? 'Gagal memuat log aktivitas.', res.status);
    }
    const json = (await res.json().catch(() => null)) as ActivityLogsResult | null;
    if (!json || !Array.isArray(json.logs)) {
        throw new ActivityLogsApiError('Respons log aktivitas tidak valid.', 500);
    }
    return json;
}
