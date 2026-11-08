'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
const POLL_INTERVAL_MS = 20000;
export const SUPPORT_UPDATED_EVENT = 'rebites-support-updated';
function useVisibilityPolling(enabled: boolean, load: () => void) {
    useEffect(() => {
        if (!enabled)
            return;
        const intervalId = window.setInterval(() => {
            if (document.visibilityState === 'visible')
                load();
        }, POLL_INTERVAL_MS);
        const onVisible = () => {
            if (document.visibilityState === 'visible')
                load();
        };
        const onUpdated = () => load();
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener(SUPPORT_UPDATED_EVENT, onUpdated);
        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener(SUPPORT_UPDATED_EVENT, onUpdated);
        };
    }, [enabled, load]);
}
export function useAdminSupportBadge(enabled: boolean): {
    count: number | null;
} {
    const [count, setCount] = useState<number | null>(null);
    const requestIdRef = useRef(0);
    const load = useCallback(async () => {
        if (!enabled)
            return;
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        try {
            const { count: total, error } = await supabase
                .from('support_threads')
                .select('id', { count: 'exact', head: true })
                .gt('admin_unread_count', 0);
            if (requestId !== requestIdRef.current)
                return;
            if (error) {
                setCount(null);
                return;
            }
            setCount(total ?? 0);
        }
        catch {
            if (requestId !== requestIdRef.current)
                return;
            setCount(null);
        }
    }, [enabled]);
    useEffect(() => {
        if (!enabled) {
            setCount(null);
            return;
        }
        void load();
    }, [enabled, load]);
    useVisibilityPolling(enabled, load);
    return { count };
}
