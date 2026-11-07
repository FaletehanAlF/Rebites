'use client';
import { useEffect } from 'react';
const STORAGE_KEY = 'rebites.visitor.key';
const SESSION_PREFIX = 'rebites.storeVisitor.recorded:';
function bacaLocal(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    }
    catch {
        return null;
    }
}
function tulisLocal(key: string, value: string): void {
    try {
        window.localStorage.setItem(key, value);
    }
    catch {
    }
}
function bacaSession(key: string): string | null {
    try {
        return window.sessionStorage.getItem(key);
    }
    catch {
        return null;
    }
}
function tulisSession(key: string, value: string): void {
    try {
        window.sessionStorage.setItem(key, value);
    }
    catch {
    }
}
function buatKunci(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function StoreVisitorTracker({ storeId }: {
    storeId: string;
}) {
    const valid = UUID_PATTERN.test(storeId?.trim() ?? '');
    useEffect(() => {
        if (!valid)
            return;
        const id = storeId.trim().toLowerCase();
        const flag = `${SESSION_PREFIX}${id}`;
        if (bacaSession(flag) === '1')
            return;
        tulisSession(flag, '1');
        let kunci = bacaLocal(STORAGE_KEY);
        if (!kunci) {
            kunci = buatKunci();
            tulisLocal(STORAGE_KEY, kunci);
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
                await fetch('/api/store-visitors', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(authHeader ? { Authorization: authHeader } : {}),
                    },
                    body: JSON.stringify({ storeId: id, key: kunci }),
                    cache: 'no-store',
                    keepalive: true,
                });
            }
            catch {
            }
        })();
    }, [valid, storeId]);
    return null;
}
