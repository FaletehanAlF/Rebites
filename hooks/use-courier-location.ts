'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth } from '@/lib/auth-token';
import {
  resolveLocationFreshness,
  type LocationFreshness,
} from '@/lib/courier-location';

/**
 * Posisi kurir yang LIVE untuk satu pesanan.
 *
 * Sumber data: tabel `delivery_locations` (satu baris per pesanan = posisi
 * TERKINI). Datanya dibaca lewat Realtime Postgres Changes — bukan
 * Broadcast — jadi hanya pihak yang berhak (pembeli, penjual, kurir)
 * yang menerimanya.
 *
 * Polling tetap dipertahankan sebagai fallback: Realtime bisa terputus
 * (jaringan berubah, laptop tidur), dan posisi kurir yang tidak bergerak
 * selama berjam-jam lebih buruk daripada posisi yang beberapa detik basi.
 *
 * KEJUJURAN
 * - `location` bernilai null berarti kurir belum mengirim posisi. UI TIDAK
 *   boleh menampilkan marker di titik karangan.
 * - `freshness` menentukan apa yang ditampilkan: `aktif` (posisi
 *   terkini), `terlambat` (tampilkan tapi sebut basi), atau
 *   `tidak_tersedia` (jangan tunjuk peta).
 */
export interface LiveCourierLocation {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  recordedAt: string;
}

export interface UseCourierLocationResult {
  location: LiveCourierLocation | null;
  freshness: LocationFreshness;
  loading: boolean;
  error: string | null;
}

const POLL_INTERVAL_MS = 10_000;

/** Timer untuk memperbarui label "terlambat". 15 detik cukup. */
const FRESHNESS_TICK_MS = 15_000;

export function useCourierLocation(
  orderDbId: string | null | undefined,
  enabled = true
): UseCourierLocationResult {
  const [location, setLocation] = useState<LiveCourierLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const active = Boolean(orderDbId) && enabled;

  const refresh = useCallback(async () => {
    if (!orderDbId || !enabled) return;
    try {
      const res = await fetchWithAuth(
        `/api/courier/location?orderId=${encodeURIComponent(orderDbId)}`
      );
      if (!res.ok) {
        setError('Gagal memuat posisi kurir.');
        return;
      }
      const json = (await res.json()) as { location?: LiveCourierLocation | null };
      setLocation(json.location ?? null);
      setError(null);
    } catch {
      setError('Gagal memuat posisi kurir.');
    }
  }, [orderDbId, enabled]);

  // Kesegaran dihitung terhadap waktu berjalan, bukan hanya saat data masuk:
  // posisi yang tadinya "aktif" bisa jadi basi tanpa ada data baru masuk.
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), FRESHNESS_TICK_MS);
    return () => window.clearInterval(id);
  }, [active]);

  useEffect(() => {
    if (!orderDbId || !enabled) {
      setLocation(null);
      setError(null);
      return;
    }

    setLoading(true);
    void refresh();

    const channel = supabase
      .channel(`rebites-courier-location-${orderDbId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_locations',
          filter: `order_id=eq.${orderDbId}`,
        },
        (payload) => {
          const row = (payload.new ?? {}) as Record<string, unknown>;
          if (row.latitude == null || row.longitude == null) {
            // Baris dihapus (pesanan selesai) -> tidak ada posisi lagi.
            setLocation(null);
            return;
          }
          setLocation({
            latitude: Number(row.latitude),
            longitude: Number(row.longitude),
            accuracyM: row.accuracy_m == null ? null : Number(row.accuracy_m),
            recordedAt: row.recorded_at
              ? String(row.recorded_at)
              : new Date().toISOString(),
          });
          setError(null);
          setNow(Date.now());
        }
      )
      .subscribe();

    // Fallback polling: Realtime bisa terputus tanpa memberi tahu.
    const intervalId = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      void supabase.removeChannel(channel);
      window.clearInterval(intervalId);
      setLoading(false);
    };
  }, [orderDbId, enabled, refresh]);

  const freshness: LocationFreshness = location
    ? resolveLocationFreshness(location.recordedAt, now)
    : 'tidak_tersedia';

  return { location, freshness, loading, error };
}
