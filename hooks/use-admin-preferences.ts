'use client';

import { useEffect, useState } from 'react';
import {
  ADMIN_PREFERENCES_EVENT,
  DEFAULT_ADMIN_PREFERENCES,
  readAdminPreferences,
  type AdminPreferences,
} from '@/lib/admin-preferences';

/**
 * Preferensi admin yang selalu sinkron dengan localStorage.
 * - Nilai awal = bawaan (aman untuk SSR), lalu diganti setelah mount.
 * - Tetap sinkron saat diubah dari halaman Pengaturan (event tab sama)
 *   maupun dari tab lain (event `storage`).
 */
export function useAdminPreferences(): AdminPreferences {
  const [preferences, setPreferences] = useState<AdminPreferences>(DEFAULT_ADMIN_PREFERENCES);

  useEffect(() => {
    const sync = () => setPreferences(readAdminPreferences());
    sync();
    window.addEventListener(ADMIN_PREFERENCES_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(ADMIN_PREFERENCES_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return preferences;
}
