'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWithAuth } from '@/lib/auth-token';

/**
 * Tugas pengiriman untuk kurir yang login.
 *
 * Penugasan dibuat OTOMATIS di database saat pesanan masuk
 * 'out_for_delivery' — jadi daftar ini cukup dibaca, tidak ada tombol
 * "ambil pesanan" yang bisa diklik-klik berebut.
 */
export type AssignmentStatus = 'assigned' | 'picked_up' | 'delivering' | 'completed' | 'cancelled';

export interface CourierAssignment {
  id: string;
  orderId: string;
  status: AssignmentStatus;
  distanceKm: number | null;
  assignedAt: string | null;
  pickedUpAt: string | null;
  completedAt: string | null;
  order: {
    orderCode: string;
    productName: string;
    vendorName: string;
    fulfillment: 'delivery' | 'pickup';
    orderStatus: string;
    addressSnapshot: Record<string, unknown> | null;
    shippingSnapshot: Record<string, unknown> | null;
  } | null;
}

export function useCourierAssignments(enabled = true) {
  const [assignments, setAssignments] = useState<CourierAssignment[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetchWithAuth('/api/courier/assignments');
      if (!res.ok) {
        setError('Gagal memuat tugas.');
        return;
      }
      const json = (await res.json()) as { assignments?: CourierAssignment[] };
      setAssignments(json.assignments ?? []);
      setError(null);
    } catch {
      setError('Gagal memuat tugas.');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
    if (!enabled) return;
    // Polling: penugasan baru muncul dari trigger database, dan tidak ada
    // push ke browser kurir saat itu terjadi.
    const id = window.setInterval(() => {
      void refresh();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [refresh, enabled]);

  /** Ubah status penugasan (ambil pesanan / mulai antar / selesai). */
  const updateStatus = useCallback(
    async (assignmentId: string, status: AssignmentStatus) => {
      const res = await fetchWithAuth('/api/courier/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId, status }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? 'Gagal memperbarui status.');
      }
      await refresh();
    },
    [refresh]
  );

  return { assignments, loading, error, refresh, updateStatus };
}

/**
 * Kirim posisi kurir ke server selama pesanan sedang diantar.
 *
 * Berhenti otomatis saat halaman tidak terlihat (`visibilitychange`) supaya
 * perangkat tidak mengirim posisi di belakang layar — boros kuota dan
 *baterai, dan posisi di belakang layar tidak berguna.
 *
 * Interval 10 detik, sesuai aturan di migrasi.
 */
export function useCourierPositionSender({
  orderId,
  active,
}: {
  orderId: string | null;
  active: boolean;
}) {
  const lastSentAt = useRef<number | null>(null);
  const [lastSentAtIso, setLastSentAtIso] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    if (!orderId || !active) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Perangkat ini tidak mendukung GPS.');
      return;
    }
    setSending(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15_000,
          maximumAge: 0,
        });
      });
      const { latitude, longitude, accuracy } = position.coords;
      const res = await fetchWithAuth('/api/courier/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          latitude,
          longitude,
          accuracy: accuracy ?? null,
        }),
      });
      if (!res.ok) {
        setError('Gagal mengirim posisi.');
        return;
      }
      lastSentAt.current = Date.now();
      setLastSentAtIso(new Date().toISOString());
      setError(null);
    } catch (err) {
      const message =
        err instanceof GeolocationPositionError
          ? err.code === err.PERMISSION_DENIED
            ? 'Izin lokasi ditolak. Aktifkan lokasi untuk mengirim posisi.'
            : 'Gagal mengambil posisi perangkat.'
          : 'Gagal mengirim posisi.';
      setError(message);
    } finally {
      setSending(false);
    }
  }, [orderId, active]);

  useEffect(() => {
    if (!orderId || !active) return;
    if (typeof document === 'undefined') return;

    // Kirim sekali langsung supaya pembeli tidak menunggu posisi pertama.
    void send();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') void send();
    }, 10_000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void send();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [orderId, active, send]);

  return { send, sending, lastSentAtIso, error };
}
