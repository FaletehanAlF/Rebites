'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { StoredOrder } from '@/lib/types';
import {
  ORDERS_UPDATED_EVENT,
  completeExpiredOrders,
  getUserOrders,
} from '@/lib/order-storage';
import { useCurrentUser } from '@/lib/current-user';

const SWEEP_INTERVAL_MS = 15_000;

/** Status terminal yang tidak lagi dianggap "berlangsung". */
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
      // Ambil daftar SEKALI, lalu teruskan ke penyelesaian otomatis: fungsi
      // itu tidak perlu mengambil ulang daftar yang sama (satu round-trip
      // database hilang dari setiap refresh 15 detik).
      const list = await getUserOrders(userId);
      setOrders(list);
      // Penyelesaian otomatis berjalan SETELAH daftar tampil, supaya pembeli
      // tidak menunggu urusan housekeeping sebelum melihat pesanannya.
      void completeExpiredOrders(userId, list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat pesanan.');
    } finally {
      setHydrated(true);
    }
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
          if (os && TERMINAL_STATUSES.has(os)) return false;
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

  // Dibatalkan/refunded: sebelumnya filter ini tidak pernah punya isi karena
  // daftar pesanan batal tidak pernah dihitung di mana pun.
  const cancelledOrders = useMemo(
    () =>
      orders
        .filter(
          (order) =>
            order.status !== 'completed' &&
            (order.orderStatus === 'cancelled' || order.orderStatus === 'refunded')
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [orders]
  );

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
