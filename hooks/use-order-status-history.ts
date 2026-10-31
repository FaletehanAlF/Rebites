'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  fetchOrderStatusHistory,
  type OrderStatusHistoryEntry,
} from '@/lib/order-status-history';

/**
 * Riwayat status pesanan untuk tampilan.
 *
 * Mengambil satu kali per `dbId` dan menyimpan hasilnya, supaya timeline dan
 * panel status tidak melakukan query ganda ke tabel yang sama.
 *
 * Kegagalan baca sengaja tidak dilempar: riwayat melengkapi tampilan, dan
 * halaman pesanan harus tetap tampil walaupun tabelnya belum terisi.
 */
export function useOrderStatusHistory(dbId: string | null | undefined) {
  const [history, setHistory] = useState<OrderStatusHistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let aktif = true;
    setLoaded(false);
    if (!dbId) {
      setHistory([]);
      setLoaded(true);
      return () => {
        aktif = false;
      };
    }
    void fetchOrderStatusHistory(dbId).then((riwayat) => {
      if (!aktif) return;
      setHistory(riwayat);
      setLoaded(true);
    });
    return () => {
      aktif = false;
    };
  }, [dbId]);

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
