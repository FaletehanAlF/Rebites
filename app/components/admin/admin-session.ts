'use client';
import { refreshAdminSessionSafe } from '@/lib/admin-auth';
export async function redirectIfSessionExpired(status: number, router: {
    replace: (href: string) => void;
}, onOffline: () => void): Promise<boolean> {
    if (status === 503) {
        onOffline();
        return true;
    }
    if (status !== 401)
        return false;
    const refreshed = await refreshAdminSessionSafe();
    if (!refreshed) {
        router.replace('/auth/login');
        return true;
    }
    return false;
}
