'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';

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

export function isSafeRedirectPath(path: string | null | undefined): path is string {
  if (!path) return false;
  return path.startsWith('/') && !path.startsWith('//');
}

export async function fetchCurrentUserRole(
  userId?: string | null
): Promise<UserRole | null> {
  try {
    let uid = userId ?? null;
    if (!uid) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      uid = session?.user?.id ?? null;
    }
    if (!uid) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', uid)
      .maybeSingle();
    if (error || !data) return null;
    const role = (data as { role?: unknown }).role;
    if (role === 'admin' || role === 'umkm' || role === 'buyer') return role;
    return null;
  } catch {
    return null;
  }
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
