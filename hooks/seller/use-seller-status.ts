'use client';

import { useEffect, useState } from 'react';
import { getSellerUmkm } from '@/lib/product-storage';
import { supabase } from '@/lib/supabase';

export const SELLER_STATUS_UPDATED_EVENT = 'rebites-seller-updated';

export function useSellerStatus() {
  const [isSeller, setIsSeller] = useState(false);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      const umkm = await getSellerUmkm();
      if (!mounted) return;
      setIsSeller(Boolean(umkm));
      setStoreId(umkm?.id ?? null);
      setStoreSlug(umkm?.slug ?? null);
      setBusinessName(umkm?.businessName ?? null);
      setLoading(false);
    };

    void refresh();

    const {
      data,
    }: {
      data: { subscription: { unsubscribe: () => void } };
    } = supabase.auth.onAuthStateChange(() => {
      setLoading(true);
      void refresh();
    });
    window.addEventListener(SELLER_STATUS_UPDATED_EVENT, refresh);

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
      window.removeEventListener(SELLER_STATUS_UPDATED_EVENT, refresh);
    };
  }, []);

  return { isSeller, storeId, storeSlug, businessName, loading };
}
