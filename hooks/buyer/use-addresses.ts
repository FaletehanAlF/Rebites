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
    postalCode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
}
type AddressRow = Record<string, any>;
function rowToAddress(row: AddressRow): DeliveryAddress {
    return {
        id: row.id,
        label: row.label as AddressLabel,
        isSelected: row.is_selected === true,
        receiverName: row.receiver_name ?? '',
        phone: row.phone ?? '',
        province: row.province ?? '',
        city: row.city ?? '',
        district: row.district ?? '',
        fullAddress: row.full_address ?? '',
        note: row.note ?? undefined,
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
    const [error, setError] = useState<string | null>(null);
    const [reloadToken, setReloadToken] = useState(0);
    const reload = useCallback(() => setReloadToken((value) => value + 1), []);
    useEffect(() => {
        let mounted = true;
        if (userLoading)
            return;
        if (!userId) {
            setAddresses([]);
            setSelectedAddressId(null);
            setLoading(false);
            return;
        }
        (async () => {
            setLoading(true);
            let list: DeliveryAddress[] = [];
            let apiFailed = false;
            try {
                const res = await fetchWithAuth('/api/profile/addresses');
                if (res.ok) {
                    const json = (await res.json()) as {
                        addresses?: AddressRow[];
                    };
                    list = (json.addresses ?? []).map(rowToAddress);
                }
                else {
                    apiFailed = true;
                }
            }
            catch {
                apiFailed = true;
            }
            let loadError: string | null = null;
            if (list.length === 0) {
                const fallback = await supabase
                    .from('addresses')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: true });
                if (fallback.error) {
                    list = [];
                    if (apiFailed) {
                        loadError = 'Gagal memuat alamat. Periksa koneksi lalu coba lagi.';
                    }
                }
                else {
                    list = (fallback.data ?? []).map(rowToAddress);
                }
            }
            if (!mounted)
                return;
            setError(loadError);
            setAddresses(list);
            const selected = list.find((item) => item.isSelected) ?? list[0] ?? null;
            setSelectedAddressId((prev) => prev && list.some((item) => item.id === prev) ? prev : selected?.id ?? null);
            setLoading(false);
        })();
        return () => {
            mounted = false;
        };
    }, [userId, userLoading, reloadToken]);
    const selectAddress = useCallback((id: string) => {
        setSelectedAddressId(id);
        setAddresses((prev) => prev.map((item) => ({ ...item, isSelected: item.id === id })));
        if (!userId)
            return;
        (async () => {
            try {
                await fetchWithAuth('/api/profile/addresses', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, is_selected: true }),
                });
            }
            catch {
            }
        })();
    }, [userId]);
    const addAddress = useCallback(async (values: AddressFormValues): Promise<DeliveryAddress | null> => {
        if (!userId)
            return null;
        try {
            const res = await fetchWithAuth('/api/profile/addresses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(valuesToRow(values)),
            });
            if (!res.ok) {
                const json = (await res.json().catch(() => null)) as {
                    error?: string;
                } | null;
                console.error('[use-addresses] gagal menambah alamat:', json?.error ?? res.status);
                return null;
            }
            const json = (await res.json()) as {
                address?: AddressRow;
            };
            if (!json.address)
                return null;
            const created = rowToAddress(json.address);
            setAddresses((prev) => [...prev, created]);
            selectAddress(created.id);
            return created;
        }
        catch (e) {
            console.error('[use-addresses] gagal menambah alamat:', e);
            return null;
        }
    }, [userId, selectAddress]);
    const updateAddress = useCallback(async (id: string, values: AddressFormValues): Promise<boolean> => {
        if (!userId)
            return false;
        try {
            const res = await fetchWithAuth('/api/profile/addresses', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...valuesToRow(values) }),
            });
            if (!res.ok) {
                const json = (await res.json().catch(() => null)) as {
                    error?: string;
                } | null;
                console.error('[use-addresses] gagal memperbarui alamat:', json?.error ?? res.status);
                return false;
            }
            const json = (await res.json()) as {
                address?: AddressRow;
            };
            if (!json.address)
                return false;
            const updated = rowToAddress(json.address);
            setAddresses((prev) => prev.map((item) => (item.id === id ? updated : item)));
            return true;
        }
        catch (e) {
            console.error('[use-addresses] gagal memperbarui alamat:', e);
            return false;
        }
    }, [userId]);
    const selectedAddress = useMemo(() => addresses.find((item) => item.id === selectedAddressId) ?? addresses[0] ?? null, [addresses, selectedAddressId]);
    return {
        addresses,
        selectedAddress,
        selectedAddressId: selectedAddress?.id ?? null,
        selectAddress,
        addAddress,
        updateAddress,
        loading,
        error,
        reload,
    };
}
