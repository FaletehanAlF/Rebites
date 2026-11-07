'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ADMIN_ACTIVITY_SEEN_EVENT, ensureActivitySeenBaseline, } from '@/lib/admin-preferences';
const POLL_INTERVAL_MS = 20000;
export function useStoreActivationBadge(enabled: boolean): {
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
            const seenAt = ensureActivitySeenBaseline();
            const { count: total, error } = await supabase
                .from('store_activation_requests')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'pending')
                .gt('created_at', seenAt);
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
        const intervalId = window.setInterval(() => {
            if (document.visibilityState === 'visible')
                void load();
        }, POLL_INTERVAL_MS);
        const onVisible = () => {
            if (document.visibilityState === 'visible')
                void load();
        };
        const onSeen = () => void load();
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener(ADMIN_ACTIVITY_SEEN_EVENT, onSeen);
        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener(ADMIN_ACTIVITY_SEEN_EVENT, onSeen);
        };
    }, [enabled, load]);
    return { count };
}
