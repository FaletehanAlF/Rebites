'use client';
import { useEffect } from 'react';
const STORAGE_KEY = 'rebites.visitor.key';
const SESSION_FLAG = 'rebites.visitor.recorded';
let sudahDijadwalkan = false;
function bacaPenyimpanan(kind: 'local' | 'session', key: string): string | null {
    try {
        const store = kind === 'local' ? window.localStorage : window.sessionStorage;
        return store.getItem(key);
    }
    catch {
        return null;
    }
}
function tulisPenyimpanan(kind: 'local' | 'session', key: string, value: string): void {
    try {
        const store = kind === 'local' ? window.localStorage : window.sessionStorage;
        store.setItem(key, value);
    }
    catch {
    }
}
function buatKunci(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    const acak = Math.random().toString(36).slice(2, 12);
    return `${Date.now().toString(36)}-${acak}`;
}
export function VisitorTracker() {
    useEffect(() => {
        if (sudahDijadwalkan)
            return;
        sudahDijadwalkan = true;
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
            return;
        }
        if (bacaPenyimpanan('session', SESSION_FLAG) === '1')
            return;
        tulisPenyimpanan('session', SESSION_FLAG, '1');
        let kunci = bacaPenyimpanan('local', STORAGE_KEY);
        if (!kunci) {
            kunci = buatKunci();
            tulisPenyimpanan('local', STORAGE_KEY, kunci);
        }
        void (async () => {
            let authHeader: string | null = null;
            try {
                const { getValidAuthHeader } = await import('@/lib/auth-token');
                authHeader = await getValidAuthHeader();
            }
            catch {
                authHeader = null;
            }
            try {
                await fetch('/api/visitors', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(authHeader ? { Authorization: authHeader } : {}),
                    },
                    body: JSON.stringify({ key: kunci }),
                    cache: 'no-store',
                    keepalive: true,
                });
            }
            catch {
            }
        })();
    }, []);
    return null;
}
