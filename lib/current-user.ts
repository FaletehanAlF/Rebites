'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { isSafeInternalPath } from './safe-path';

export const DEMO_USER_ID = 'demo-user';

export type UserRole = 'admin' | 'umkm' | 'buyer';

const ROLE_HOME_PATH: Record<UserRole, string> = {
  admin: '/dashboard/admin',
  umkm: '/dashboard/penjual',
  buyer: '/home',
};

export function getHomePathForRole(role: UserRole | null | undefined): string {
  if (role && ROLE_HOME_PATH[role]) return ROLE_HOME_PATH[role];
  return '/home';
}

/**
 * Validasi path redirect internal.
 * Implementasi tunggal ada di lib/safe-path.ts (menolak '//', backslash,
 * karakter kontrol, dan varian terenkodenya) — wrapper ini dipertahankan
 * agar import lama tidak pecah.
 */
export function isSafeRedirectPath(path: string | null | undefined): path is string {
  return isSafeInternalPath(path);
}

export class CurrentUserRoleError extends Error {
  code: 'no-session' | 'query-error';

  constructor(code: 'no-session' | 'query-error', message: string) {
    super(message);
    this.name = 'CurrentUserRoleError';
    this.code = code;
  }
}

export async function fetchCurrentUserRole(
  userId?: string | null
): Promise<UserRole | null> {
  let uid = userId ?? null;

  // Sesi mungkin belum tersedia segera setelah signInWithPassword di beberapa
  // browser; coba sekali lagi dengan jeda singkat sebelum menyatakan gagal.
  if (!uid) {
    let sessionUser: string | null = null;
    for (let attempt = 0; attempt < 3 && !sessionUser; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      sessionUser = session?.user?.id ?? null;
    }
    uid = sessionUser;
  }

  if (!uid) {
    // Kegagalan membaca sesi TIDAK boleh dianggap role "buyer" (terutama
    // untuk akun admin). Lempar error agar caller menanganinya dengan
    // pesan yang sesuai, bukan diam-diam fallback ke pembeli.
    throw new CurrentUserRoleError(
      'no-session',
      'Sesi login tidak ditemukan. Silakan coba lagi.'
    );
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', uid)
    .maybeSingle();

  if (error) {
    throw new CurrentUserRoleError(
      'query-error',
      error.message || 'Gagal membaca peran akun.'
    );
  }
  if (!data) return null;

  const role = (data as { role?: unknown }).role;
  if (role === 'admin' || role === 'umkm' || role === 'buyer') return role;
  return null;
}

export interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
}

export function mapSupabaseUser(raw: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): CurrentUser {
  return {
    id: raw.id,
    fullName:
      (raw.user_metadata?.full_name as string | undefined)?.trim() ||
      raw.email?.split('@')[0] ||
      'Pengguna ReBites',
    email: raw.email ?? '',
  };
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const { data } = await supabase.auth.getSession();
  const raw = data.session?.user;
  return raw ? mapSupabaseUser(raw) : null;
}

export async function getCurrentUserId(): Promise<string | null> {
  const user = await fetchCurrentUser();
  return user?.id ?? null;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    fetchCurrentUser().then((result) => {
      if (!mounted) return;
      setUser(result);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const raw = session?.user;
      setUser(raw ? mapSupabaseUser(raw) : null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return { user, userId: user?.id ?? null, loading };
}
