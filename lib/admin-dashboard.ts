'use client';
import { AuthError } from './auth-token';
import { fetchAdminWithAuth } from './admin-auth';
import type { AdminAnalyticsData, AnalyticsRangeDays } from './admin-analytics';
export interface DashboardTrendPoint {
    date: string;
    orders: number;
    revenue: number;
}
export interface DashboardActivityItem {
    id: string;
    activityType: string;
    description: string;
    targetType: string | null;
    targetId: string | null;
    orderCode: string | null;
    createdAt: string;
    userName: string | null;
    userEmail: string | null;
}
export interface AdminDashboardData {
    generatedAt: string;
    users: {
        total: number;
        active: number;
        suspended: number;
        banned: number;
    };
    umkm: {
        total: number;
        active: number;
    };
    orders: {
        today: number;
        yesterday: number;
        last7Days: number;
        failedPayments: number;
    };
    revenue: {
        today: number;
        yesterday: number;
        last7Days: number;
    };
    subscriptions: {
        active: number;
        expiringSoon: number;
        pending: number;
        expired: number;
    };
    reports: {
        open: number;
        reviewing: number;
        staleOpen: number;
    };
    warnings: {
        level1: number;
        level2: number;
        level3: number;
        usersAtThree: number;
    };
    sanctions: {
        active: number;
    };
    shipments: {
        stale: number;
    };
    activity: DashboardActivityItem[];
    trends: DashboardTrendPoint[];
}
export class AdminDashboardApiError extends Error {
    status: number = 500;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'AdminDashboardApiError';
        this.status = status;
    }
}
export async function fetchAdminDashboard(): Promise<AdminDashboardData> {
    let res: Response;
    try {
        res = await fetchAdminWithAuth('/api/admin/dashboard', { cache: 'no-store' });
    }
    catch (err) {
        if (err instanceof AuthError)
            throw new AdminDashboardApiError(err.message, err.status);
        throw err;
    }
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new AdminDashboardApiError(json?.error ?? 'Gagal memuat dashboard.', res.status);
    }
    return (await res.json()) as AdminDashboardData;
}
export class AdminAnalyticsApiError extends Error {
    status: number = 500;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'AdminAnalyticsApiError';
        this.status = status;
    }
}
export async function fetchAdminAnalytics(rangeDays: AnalyticsRangeDays = 14): Promise<AdminAnalyticsData> {
    const params = new URLSearchParams({ range: String(rangeDays) });
    let res: Response;
    try {
        res = await fetchAdminWithAuth(`/api/admin/analytics?${params.toString()}`, {
            cache: 'no-store',
        });
    }
    catch (err) {
        if (err instanceof AuthError)
            throw new AdminAnalyticsApiError(err.message, err.status);
        throw err;
    }
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new AdminAnalyticsApiError(json?.error ?? 'Gagal memuat analytics.', res.status);
    }
    return (await res.json()) as AdminAnalyticsData;
}
