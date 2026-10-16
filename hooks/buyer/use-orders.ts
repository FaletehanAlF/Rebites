'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StoredOrder } from '@/lib/types';
import {
  ORDERS_UPDATED_EVENT,
  completeExpiredOrders,
  syncDeliveringNotifications,
  getUserOrders,
} from '@/lib/order-storage';
import { useCurrentUser } from '@/lib/current-user';

const SWEEP_INTERVAL_MS = 15_000;

export function useOrders() {
  const { userId, loading: userLoading } = useCurrentUser();
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) {
      setOrders([]);
      setHydrated(true);
      return;
    }
    await completeExpiredOrders(userId);
    await syncDeliveringNotifications(userId);
    const list = await getUserOrders(userId);
    setOrders(list);
    setHydrated(true);
  }, [userId]);

  useEffect(() => {
    if (userLoading) return;
    refresh();

    window.addEventListener(ORDERS_UPDATED_EVENT, refresh);
    const intervalId = window.setInterval(refresh, SWEEP_INTERVAL_MS);

    return () => {
      window.removeEventListener(ORDERS_UPDATED_EVENT, refresh);
      window.clearInterval(intervalId);
    };
  }, [userLoading, refresh]);

  const activeOrders = useMemo(
    () =>
      orders
        .filter((order) => {
          
          if (order.status === 'completed') return false;
          const os = order.orderStatus;
          if (os === 'completed' || os === 'cancelled' || os === 'refunded') return false;
          return true;
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [orders]
  );

  const completedOrders = useMemo(
    () =>
      orders
        .filter((order) => order.status === 'completed' || order.orderStatus === 'completed')
        .sort(
          (a, b) =>
            (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt)
        ),
    [orders]
  );

  return {
    orders,
    activeOrders,
    completedOrders,
    hydrated,
    loading: !hydrated || userLoading,
  };
}
