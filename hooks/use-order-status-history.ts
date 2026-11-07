'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchOrderStatusHistory, type OrderStatusHistoryEntry, } from '@/lib/order-status-history';
import { subscribeOrdersRealtime } from '@/lib/orders-realtime';
const POLL_INTERVAL_MS = 15000;
export function useOrderStatusHistory(dbId: string | null | undefined) {
    const [history, setHistory] = useState<OrderStatusHistoryEntry[]>([]);
    const [loaded, setLoaded] = useState(false);
    const refetch = useCallback(async () => {
        if (!dbId) {
            setHistory([]);
            setLoaded(true);
            return;
        }
        const riwayat = await fetchOrderStatusHistory(dbId);
        setHistory(riwayat);
        setLoaded(true);
    }, [dbId]);
    useEffect(() => {
        if (!dbId) {
            setHistory([]);
            setLoaded(true);
            return;
        }
        setLoaded(false);
        void refetch();
        const unsubscribe = subscribeOrdersRealtime({
            label: 'status-history',
            table: 'order_status_history',
            debounceMs: 300,
            onChange: () => {
                void refetch();
            },
        });
        const intervalId = window.setInterval(() => {
            void refetch();
        }, POLL_INTERVAL_MS);
        return () => {
            unsubscribe();
            window.clearInterval(intervalId);
        };
    }, [dbId, refetch]);
    const lastStatusChangeAt = useMemo(() => {
        for (let i = history.length - 1; i >= 0; i -= 1) {
            const at = history[i]?.at;
            if (at)
                return at;
        }
        return null;
    }, [history]);
    return { history, lastStatusChangeAt, loaded };
}
