'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchOrderStatusHistory,
  type OrderStatusHistoryEntry,
} from '@/lib/order-status-history';
import { subscribeOrdersRealtime } from '@/lib/orders-realtime';

/** Fallback bila Realtime putus tanpa memberi tahu. */
const POLL_INTERVAL_MS = 15_000;

/**
 * Riwayat status pesanan untuk tampilan.
 *
 * SUMBER DATA
 * - `order_status_history`, yang mencatat setiap perubahan status beserta
 *   jamnya (settlement pembayaran dan state machine sama-sama menulis).
 *
 * PEMBARUAN
 * - Realtime `postgres_changes` pada tabel riwayat: tahap yang baru selesai
 *   muncul dalam hitungan detik, tanpa pembeli harus refresh.
 * - Polling 15 detik sebagai fallback: Realtime bisa diam tanpa memberi tahu.
 *
 * KENAPA DULU TIDAK JALAN
 * Hook ini hanya mengambil data SEKALI saat halaman dibuka. Selama pembeli
 * diam di halaman, tahap berikutnya tidak pernah muncul — pesanan terlihat
 * macet di "Menunggu" walaupun penjual sudah memajukannya.
 *
 * Kegagalan baca sengaja tidak dilempar: riwayat melengkapi tampilan, dan
 * halaman pesanan harus tetap tampil walaupun tabelnya belum terisi.
 */
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

  /**
   * Waktu perubahan status TERAKHIR.
   *
   * Ini yang dipakai untuk menghitung "sudah menunggu X": yang penting bukan
   * kapan pesanan dibuat, tapi berapa lama pembeli sudah menunggu pada tahap
   * yang sedang berjalan.
   */
  const lastStatusChangeAt = useMemo(() => {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const at = history[i]?.at;
      if (at) return at;
    }
    return null;
  }, [history]);

  return { history, lastStatusChangeAt, loaded };
}
