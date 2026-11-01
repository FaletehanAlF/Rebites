'use client';

import { useCallback, useEffect, useState } from 'react';
import { PRODUCTS_UPDATED_EVENT } from '@/lib/product-storage';
import { ORDERS_UPDATED_EVENT } from '@/lib/order-storage';
import {
  getSellerBestSellingMenus,
  type BestSellingMenu,
} from '@/lib/seller-product-sales';

export function useSellerBestSellingMenus(enabled: boolean = true) {
  const [menus, setMenus] = useState<BestSellingMenu[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const list = await getSellerBestSellingMenus();
    setMenus(list);
    setHydrated(true);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    window.addEventListener(PRODUCTS_UPDATED_EVENT, refresh);
    window.addEventListener(ORDERS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(PRODUCTS_UPDATED_EVENT, refresh);
      window.removeEventListener(ORDERS_UPDATED_EVENT, refresh);
    };
  }, [refresh, enabled]);

  return { menus, hydrated, refresh };
}
