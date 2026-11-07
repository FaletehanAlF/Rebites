'use client';
import { getValidAuthHeader } from './auth-token';
export interface StoreVisitorDailyPoint {
    day: string;
    visitors: number;
    visits: number;
}
export interface StoreVisitorStats {
    totalVisitors: number;
    totalVisits: number;
    today: number;
    yesterday: number;
    rangeDays: number;
    rangeVisitors: number;
    daily: StoreVisitorDailyPoint[];
    notProvisioned: boolean;
}
function asCount(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed))
        return 0;
    return Math.max(0, Math.trunc(parsed));
}
function asDaily(value: unknown): StoreVisitorDailyPoint[] {
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
        .filter((entry): entry is StoreVisitorDailyPoint => entry !== null);
}
export async function fetchStoreVisitorStats(rangeDays = 14): Promise<StoreVisitorStats> {
    const params = new URLSearchParams({ range: String(rangeDays) });
    const authHeader = await getValidAuthHeader().catch(() => null);
    const res = await fetch(`/api/seller/store-visitors?${params.toString()}`, {
        cache: 'no-store',
        headers: authHeader ? { Authorization: authHeader } : {},
    });
    if (res.status === 404 && !res.ok) {
        const empty: StoreVisitorStats = {
            totalVisitors: 0,
            totalVisits: 0,
            today: 0,
            yesterday: 0,
            rangeDays,
            rangeVisitors: 0,
            daily: [],
            notProvisioned: false,
        };
        return empty;
    }
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new Error(json?.error ?? 'Gagal memuat pengunjung toko.');
    }
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!json)
        throw new Error('Respons pengunjung toko tidak valid.');
    if (json.notProvisioned === true) {
        return {
            totalVisitors: 0,
            totalVisits: 0,
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
        today: asCount(json.today),
        yesterday: asCount(json.yesterday),
        rangeDays: asCount(json.rangeDays) || rangeDays,
        rangeVisitors: asCount(json.rangeVisitors),
        daily: asDaily(json.daily),
        notProvisioned: false,
    };
}
