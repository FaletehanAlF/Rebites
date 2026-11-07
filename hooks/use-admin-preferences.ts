'use client';
import { useEffect, useState } from 'react';
import { ADMIN_PREFERENCES_EVENT, DEFAULT_ADMIN_PREFERENCES, readAdminPreferences, type AdminPreferences, } from '@/lib/admin-preferences';
export function useAdminPreferences(): AdminPreferences {
    const [preferences, setPreferences] = useState<AdminPreferences>(DEFAULT_ADMIN_PREFERENCES);
    useEffect(() => {
        const sync = () => setPreferences(readAdminPreferences());
        sync();
        window.addEventListener(ADMIN_PREFERENCES_EVENT, sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener(ADMIN_PREFERENCES_EVENT, sync);
            window.removeEventListener('storage', sync);
        };
    }, []);
    return preferences;
}
