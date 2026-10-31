'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchWithAuth } from '@/lib/auth-token';

/**
 * Profil kurir untuk user yang login.
 *
 * `schemaReady`false berarti tabel `couriers` belum ada (migrasi belum
 * dijalankan). Itu kondisi yang harus ditampilkan apa adanya, bukan
 * disamarkan sebagai "belum terdaftar" — keduanya punya arti berbeda.
 */
export interface CourierProfile {
  fullName: string;
  phone: string | null;
  vehicleType: 'motor' | 'mobil' | 'sepeda';
  isActive: boolean;
  isAvailable: boolean;
}

export interface CourierProfileState {
  courier: CourierProfile | null;
  schemaReady: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useCourierProfile(): CourierProfileState {
  const [courier, setCourier] = useState<CourierProfile | null>(null);
  const [schemaReady, setSchemaReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/courier/profile');
      if (!res.ok) {
        setError('Gagal memuat profil kurir.');
        setLoading(false);
        return;
      }
      const json = (await res.json()) as {
        courier?: CourierProfile | null;
        schemaReady?: boolean;
      };
      setCourier(json.courier ?? null);
      setSchemaReady(json.schemaReady !== false);
      setError(null);
    } catch {
      setError('Gagal memuat profil kurir.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { courier, schemaReady, loading, error, refresh };
}
