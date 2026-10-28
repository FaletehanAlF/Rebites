'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

export const STORE_SETTINGS_UPDATED_EVENT = 'rebites-seller-store-updated';

export interface SellerStoreSettings {
  isOpen: boolean;
  storeName: string;
  description: string;
  image: string;
  address: string;
  openHours: string;
  /** kode pos origin, NULL untuk data legacy. */
  postalCode?: string | null;
  /** telepon toko untuk kontak kurir, NULL jika belum diisi. */
  phone?: string | null;
  /** gunakan kolom existing umkm_profiles.latitude, NULL = belum diketahui. */
  latitude?: number | null;
  /** gunakan kolom existing umkm_profiles.longitude, NULL = belum diketahui. */
  longitude?: number | null;
}

export const DEFAULT_STORE_SETTINGS: SellerStoreSettings = {
  isOpen: true,
  storeName: '',
  description: '',
  image: '',
  address: '',
  openHours: '',
};

function dispatchUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(STORE_SETTINGS_UPDATED_EVENT));
}

export async function getSellerStoreSettings(): Promise<SellerStoreSettings | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return null;

  const { data, error } = await supabase
    .from('umkm_profiles')
    .select('business_name, description, logo_url, address, is_open, open_hours, postal_code, phone, latitude, longitude')
    .eq('user_id', uid)
    .maybeSingle();
  if (error || !data) return null;

  return {
    isOpen: data.is_open ?? true,
    storeName: data.business_name ?? '',
    description: data.description ?? '',
    image: data.logo_url ?? '',
    address: data.address ?? '',
    openHours: data.open_hours ?? '',
    // Backward compat: kolom baru NULL untuk toko lama.
    postalCode: (data as Record<string, unknown>).postal_code as string | null ?? null,
    phone: (data as Record<string, unknown>).phone as string | null ?? null,
    latitude: (data as Record<string, unknown>).latitude as number | null ?? null,
    longitude: (data as Record<string, unknown>).longitude as number | null ?? null,
  };
}

export interface StorePublicSettings {
  storeName: string;
  description: string;
  address: string;
  image: string;
  openHours: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getStoreSettingsByStoreId(
  storeId: string
): Promise<StorePublicSettings | null> {
  if (!storeId) return null;
  const column = UUID_RE.test(storeId) ? 'id' : 'slug';
  const { data, error } = await supabase
    .from('umkm_profiles')
    .select('business_name, description, logo_url, address, open_hours')
    .eq(column, storeId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    storeName: data.business_name ?? '',
    description: data.description ?? '',
    address: data.address ?? '',
    image: data.logo_url ?? '',
    openHours: data.open_hours ?? '',
  };
}

async function patchOwnUmkm(patch: Record<string, unknown>): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return false;

  const { error } = await supabase
    .from('umkm_profiles')
    .update(patch)
    .eq('user_id', uid);
  if (error) {
    console.error('[store-settings] gagal update toko:', error.message);
    return false;
  }
  dispatchUpdated();
  return true;
}

export function setStoreOpen(isOpen: boolean): Promise<boolean> {
  return patchOwnUmkm({ is_open: isOpen });
}

export function setStoreOpenHours(openHours: string): Promise<boolean> {
  return patchOwnUmkm({ open_hours: openHours });
}

export function updateStoreSettings(
  patch: Partial<Omit<SellerStoreSettings, 'isOpen'>>
): Promise<boolean> {
  const payload: Record<string, unknown> = {};
  if (patch.storeName !== undefined) payload.business_name = patch.storeName;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.image !== undefined) payload.logo_url = patch.image;
  if (patch.address !== undefined) payload.address = patch.address;
  if (patch.openHours !== undefined) payload.open_hours = patch.openHours;
  // postal/phone origin (nullable).
  if (patch.postalCode !== undefined)
    payload.postal_code = patch.postalCode?.trim() ? patch.postalCode.trim() : null;
  if (patch.phone !== undefined)
    payload.phone = patch.phone?.trim() ? patch.phone.trim() : null;
  // koordinat origin toko (opsional, dari GPS/manual di pengaturan).
  // Hanya angka finite yang ditulis; selain itu NULL (belum diketahui) —
  // tanpa nilai karangan. Rentang sah ditegakkan form + CHECK constraint DB.
  if (patch.latitude !== undefined)
    payload.latitude =
      typeof patch.latitude === 'number' && Number.isFinite(patch.latitude)
        ? patch.latitude
        : null;
  if (patch.longitude !== undefined)
    payload.longitude =
      typeof patch.longitude === 'number' && Number.isFinite(patch.longitude)
        ? patch.longitude
        : null;
  if (Object.keys(payload).length === 0) return Promise.resolve(true);
  return patchOwnUmkm(payload);
}

export function useSellerStoreSettings() {
  const [settings, setSettings] = useState<SellerStoreSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await getSellerStoreSettings();
    setSettings(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(STORE_SETTINGS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(STORE_SETTINGS_UPDATED_EVENT, refresh);
    };
  }, [refresh]);

  return { settings, loading, refresh };
}
