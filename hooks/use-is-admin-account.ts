'use client';
import { useEffect, useState } from 'react';
import { fetchCurrentUserRole } from '@/lib/current-user';
export function useIsAdminAccount(): boolean {
    const [isAdmin, setIsAdmin] = useState(false);
    useEffect(() => {
        let active = true;
        fetchCurrentUserRole()
            .then((role) => {
            if (active)
                setIsAdmin(role === 'admin');
        })
            .catch(() => {
            if (active)
                setIsAdmin(false);
        });
        return () => {
            active = false;
        };
    }, []);
    return isAdmin;
}
