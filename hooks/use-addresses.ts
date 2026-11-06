'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth } from '@/lib/auth-token';
import { useCurrentUser } from '@/lib/current-user';
import type { AddressLabel, DeliveryAddress } from '@/lib/types';

export interface AddressFormValues {
  label: AddressLabel;
  receiverName: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  fullAddress: string;
  note?: string;
  /** kode pos 5 digit, opsional (NULL untuk legacy). */
  postalCode?: string | null;
  /** koordinat GPS/manual dari form (opsional, pasangan lengkap). */
  latitude?: number | null;
  /** koordinat GPS/manual dari form (opsional, pasangan lengkap). */
  longitude?: number | null;
}

type AddressRow = Record<string, any>;

function rowToAddress(row: AddressRow): DeliveryAddress {
  return {
    id: row.id,
    label: row.label as AddressLabel,
    receiverName: row.receiver_name ?? '',
    phone: row.phone ?? '',
    province: row.province ?? '',
    city: row.city ?? '',
    district: row.district ?? '',
    fullAddress: row.full_address ?? '',
    note: row.note ?? undefined,
    // Backward compat: order/alamat lama tanpa kolom baru -> null.
    postalCode: row.postal_code ?? null,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
  };
}

function valuesToRow(values: AddressFormValues): AddressRow {
  return {
    label: values.label,
    receiver_name: values.receiverName,
    phone: values.phone,
    province: values.province,
    city: values.city,
    district: values.district,
    full_address: values.fullAddress,
    note: values.note ?? null,
    // postal opsional ("" -> NULL di API); lat/lng pasangan
    // lengkap dari form GPS/manual (NULL bila dikosongkan).
    postal_code: values.postalCode?.trim() ? values.postalCode.trim() : null,
    latitude: values.latitude ?? null,
    longitude: values.longitude ?? null,
  };
}

export function useAddresses() {
  const { userId, loading: userLoading } = useCurrentUser();
  const [addresses, setAddresses] = useState<DeliveryAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    if (userLoading) return;
    if (!userId) {
      setAddresses([]);
      setSelectedAddressId(null);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      let list: DeliveryAddress[] = [];
      try {
        // fetchWithAuth: token fresh + retry 1x setelah force-refresh bila 401.
        const res = await fetchWithAuth('/api/profile/addresses');
        if (res.ok) {
          const json = (await res.json()) as { addresses?: AddressRow[] };
          list = (json.addresses ?? []).map(rowToAddress);
        }
      } catch {
        // fallback di bawah (mis. tidak ada session sama sekali)
      }
      if (list.length === 0) {
        // Fallback: baca langsung dari tabel via RLS
        const { data, error } = await supabase
          .from('addresses')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });
        list = error ? [] : (data ?? []).map(rowToAddress);
      }
      if (!mounted) return;
      setAddresses(list);
      const selected = list.find((item) => item.id) ?? null;
      setSelectedAddressId((prev) =>
        prev && list.some((item) => item.id === prev) ? prev : selected?.id ?? null
      );
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [userId, userLoading]);

  const selectAddress = useCallback(
    (id: string) => {
      setSelectedAddressId(id);
      if (!userId) return;
      (async () => {
        try {
          await fetchWithAuth('/api/profile/addresses', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, is_selected: true }),
          });
        } catch {
          // Optimistic UI - biarkan state lokal yang dipakai
        }
      })();
    },
    [userId]
  );

  const addAddress = useCallback(
    async (values: AddressFormValues): Promise<DeliveryAddress | null> => {
      if (!userId) return null;
      try {
        const res = await fetchWithAuth('/api/profile/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(valuesToRow(values)),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as { error?: string } | null;
          console.error('[use-addresses] gagal menambah alamat:', json?.error ?? res.status);
          return null;
        }
        const json = (await res.json()) as { address?: AddressRow };
        if (!json.address) return null;
        const created = rowToAddress(json.address);
        setAddresses((prev) => [...prev, created]);
        selectAddress(created.id);
        return created;
      } catch (e) {
        console.error('[use-addresses] gagal menambah alamat:', e);
        return null;
      }
    },
    [userId, selectAddress]
  );

  const updateAddress = useCallback(
    async (id: string, values: AddressFormValues): Promise<void> => {
      if (!userId) return;
      try {
        const res = await fetchWithAuth('/api/profile/addresses', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...valuesToRow(values) }),
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as { error?: string } | null;
          console.error('[use-addresses] gagal memperbarui alamat:', json?.error ?? res.status);
          return;
        }
        const json = (await res.json()) as { address?: AddressRow };
        if (!json.address) return;
        const updated = rowToAddress(json.address);
        setAddresses((prev) => prev.map((item) => (item.id === id ? updated : item)));
      } catch (e) {
        console.error('[use-addresses] gagal memperbarui alamat:', e);
      }
    },
    [userId]
  );

  const selectedAddress = useMemo(
    () => addresses.find((item) => item.id === selectedAddressId) ?? addresses[0] ?? null,
    [addresses, selectedAddressId]
  );

  return {
    addresses,
    selectedAddress,
    selectedAddressId: selectedAddress?.id ?? null,
    selectAddress,
    addAddress,
    updateAddress,
    loading,
  };
}
