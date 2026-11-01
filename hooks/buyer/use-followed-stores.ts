'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { STORE_FOLLOW_UPDATED_EVENT, getFollowedStores, type FollowedStore } from '@/lib/store-follows';

export function useFollowedStores() {
  const [stores, setStores] = useState<FollowedStore[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const refresh = useCallback(async () => {
    const list = await getFollowedStores();
    setStores(list);
    setHydrated(true);
  }, []);

  useEffect(() => {
    refresh();
    const onFollow = () => refresh();
    const onVis = () => {
      if (typeof document !== 'undefined' && !document.hidden) refresh();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(STORE_FOLLOW_UPDATED_EVENT, onFollow);
      document.addEventListener('visibilitychange', onVis);
    }
    const { data } = supabase.auth.onAuthStateChange(() => refresh());
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(STORE_FOLLOW_UPDATED_EVENT, onFollow);
        document.removeEventListener('visibilitychange', onVis);
      }
      data.subscription.unsubscribe();
    };
  }, [refresh]);

  return { stores, hydrated, refresh, count: stores.length };
}
