'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
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
  };
}

/** Header auth Bearer untuk memanggil API backend profile. */
async function getAuthHeaders(): Promise<Record<string, string> | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return { Authorization: `Bearer ${session.access_token}` };
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
        const headers = await getAuthHeaders();
        if (headers) {
          const res = await fetch('/api/profile/addresses', { headers });
          if (res.ok) {
            const json = (await res.json()) as { addresses?: AddressRow[] };
            list = (json.addresses ?? []).map(rowToAddress);
          }
        }
      } catch {
        // fallback di bawah
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
          const headers = await getAuthHeaders();
          if (!headers) return;
          await fetch('/api/profile/addresses', {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
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
        const headers = await getAuthHeaders();
        if (!headers) return null;
        const res = await fetch('/api/profile/addresses', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
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
        const headers = await getAuthHeaders();
        if (!headers) return;
        const res = await fetch('/api/profile/addresses', {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
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
