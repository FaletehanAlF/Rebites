'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StoredOrder } from '@/lib/types';
import { ORDERS_UPDATED_EVENT, completeExpiredOrders, getUserOrders, } from '@/lib/order-storage';
import { useCurrentUser } from '@/lib/current-user';
import { subscribeOrdersRealtime } from '@/lib/orders-realtime';
const SWEEP_INTERVAL_MS = 15000;
const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'refunded']);
export function useOrders() {
    const { userId, loading: userLoading } = useCurrentUser();
    const [orders, setOrders] = useState<StoredOrder[]>([]);
    const [hydrated, setHydrated] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const refresh = useCallback(async () => {
        if (!userId) {
            setOrders([]);
            setError(null);
            setHydrated(true);
            return;
        }
        try {
            const list = await getUserOrders(userId);
            setOrders(list);
            void completeExpiredOrders(userId, list);
            setError(null);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Gagal memuat pesanan.');
        }
        finally {
            setHydrated(true);
        }
    }, [userId]);
    useEffect(() => {
        if (userLoading)
            return;
        refresh();
        window.addEventListener(ORDERS_UPDATED_EVENT, refresh);
        const unsubscribeRealtime = subscribeOrdersRealtime({
            label: 'buyer',
            onChange: refresh,
        });
        const intervalId = window.setInterval(refresh, SWEEP_INTERVAL_MS);
        return () => {
            window.removeEventListener(ORDERS_UPDATED_EVENT, refresh);
            unsubscribeRealtime();
            window.clearInterval(intervalId);
        };
    }, [userLoading, refresh]);
    const activeOrders = useMemo(() => orders
        .filter((order) => {
        if (order.status === 'completed')
            return false;
        const os = order.orderStatus;
        if (os && TERMINAL_STATUSES.has(os))
            return false;
        return true;
    })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [orders]);
    const completedOrders = useMemo(() => orders
        .filter((order) => order.status === 'completed' || order.orderStatus === 'completed')
        .sort((a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt)), [orders]);
    const cancelledOrders = useMemo(() => orders
        .filter((order) => order.status !== 'completed' &&
        (order.orderStatus === 'cancelled' || order.orderStatus === 'refunded'))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [orders]);
    return {
        orders,
        activeOrders,
        completedOrders,
        cancelledOrders,
        error,
        refetch: refresh,
        hydrated,
        loading: !hydrated || userLoading,
    };
}
