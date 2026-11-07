'use client';
import { fetchAdminWithAuth } from './admin-auth';
import { AuthError } from './auth-token';
export interface VisitorDailyPoint {
    day: string;
    visitors: number;
    visits: number;
}
export interface AdminVisitorStats {
    totalVisitors: number;
    totalVisits: number;
    anonymousVisitors: number;
    registeredVisitors: number;
    today: number;
    yesterday: number;
    rangeDays: number;
    rangeVisitors: number;
    daily: VisitorDailyPoint[];
    notProvisioned: boolean;
}
export class AdminVisitorsApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'AdminVisitorsApiError';
        this.status = status;
    }
}
function asCount(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed))
        return 0;
    return Math.max(0, Math.trunc(parsed));
}
function asDaily(value: unknown): VisitorDailyPoint[] {
    if (!Array.isArray(value))
        return [];
    return value
        .map((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry))
            return null;
        const row = entry as Record<string, unknown>;
        const day = typeof row.day === 'string' ? row.day : null;
        if (!day)
            return null;
        return { day, visitors: asCount(row.visitors), visits: asCount(row.visits) };
    })
        .filter((entry): entry is VisitorDailyPoint => entry !== null);
}
export async function fetchAdminVisitorStats(rangeDays = 14): Promise<AdminVisitorStats> {
    const params = new URLSearchParams({ range: String(rangeDays) });
    let res: Response;
    try {
        res = await fetchAdminWithAuth(`/api/admin/visitors?${params.toString()}`, {
            cache: 'no-store',
        });
    }
    catch (err) {
        if (err instanceof AuthError) {
            throw new AdminVisitorsApiError(err.message, err.status);
        }
        throw err;
    }
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new AdminVisitorsApiError(json?.error ?? 'Gagal memuat data pengunjung.', res.status);
    }
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!json) {
        throw new AdminVisitorsApiError('Respons data pengunjung tidak valid.', 500);
    }
    if (json.not_provisioned === true) {
        return {
            totalVisitors: 0,
            totalVisits: 0,
            anonymousVisitors: 0,
            registeredVisitors: 0,
            today: 0,
            yesterday: 0,
            rangeDays,
            rangeVisitors: 0,
            daily: [],
            notProvisioned: true,
        };
    }
    return {
        totalVisitors: asCount(json.totalVisitors),
        totalVisits: asCount(json.totalVisits),
        anonymousVisitors: asCount(json.anonymousVisitors),
        registeredVisitors: asCount(json.registeredVisitors),
        today: asCount(json.today),
        yesterday: asCount(json.yesterday),
        rangeDays: asCount(json.rangeDays) || rangeDays,
        rangeVisitors: asCount(json.rangeVisitors),
        daily: asDaily(json.daily),
        notProvisioned: false,
    };
}
