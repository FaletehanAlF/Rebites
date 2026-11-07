'use client';
import { useEffect } from 'react';
export function AuthScrollLock() {
    useEffect(() => {
        const root = document.documentElement;
        root.classList.add('auth-scroll-lock');
        return () => {
            root.classList.remove('auth-scroll-lock');
        };
    }, []);
    return null;
}
