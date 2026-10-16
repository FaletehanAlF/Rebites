'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  PRODUCTS_UPDATED_EVENT,
  getStoreProductsBySlug,
  type SellerProduct,
} from '@/lib/product-storage';
import { STORE_SETTINGS_UPDATED_EVENT } from '@/lib/store-settings-storage';

export function useStoreProducts(slug: string) {
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    
    if (!slug) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    const load = async () => {
      const result = await getStoreProductsBySlug(slug);
      if (!mounted) return;
      setProducts(result.products);
      setError(result.error);
      setLoading(false);
    };

    load();
    window.addEventListener(PRODUCTS_UPDATED_EVENT, load);
    window.addEventListener(STORE_SETTINGS_UPDATED_EVENT, load);
    return () => {
      mounted = false;
      window.removeEventListener(PRODUCTS_UPDATED_EVENT, load);
      window.removeEventListener(STORE_SETTINGS_UPDATED_EVENT, load);
    };
  }, [slug, reloadKey]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  return { products, loading, error, refresh };
}
