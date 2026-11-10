'use client';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { isSafeInternalPath } from './safe-path';
import { DELETED_ACCOUNT_MESSAGE, isAccountDeleted } from './account-deletion';
import { blockMessageFor, classifyAccountBlock } from './account-block';
import { sellerStorePath } from './seller-store-path';
export const DEMO_USER_ID = 'demo-user';
export type UserRole = 'admin' | 'umkm' | 'buyer';
const ROLE_HOME_PATH: Record<UserRole, string> = {
    admin: '/dashboard/admin',
    umkm: '/dashboard/penjual',
    buyer: '/home',
};
export function getHomePathForRole(role: UserRole | null | undefined): string {
    if (role && ROLE_HOME_PATH[role])
        return ROLE_HOME_PATH[role];
    return '/home';
}
export function sellerHomePath(storeId?: string | null): string {
    return sellerStorePath(storeId);
}
export function isSafeRedirectPath(path: string | null | undefined): path is string {
    return isSafeInternalPath(path);
}
export type CurrentUserRoleErrorCode = 'no-session' | 'query-error' | 'account-deleted' | 'account-suspended' | 'account-banned';
export class CurrentUserRoleError extends Error {
    code: CurrentUserRoleErrorCode;
    constructor(code: CurrentUserRoleErrorCode, message: string) {
        super(message);
        this.name = 'CurrentUserRoleError';
        this.code = code;
    }
}
export async function fetchCurrentUserRole(userId?: string | null): Promise<UserRole | null> {
    let uid = userId ?? null;
    if (!uid) {
        let sessionUser: string | null = null;
        for (let attempt = 0; attempt < 6 && !sessionUser; attempt += 1) {
            if (attempt > 0) {
                await new Promise((resolve) => setTimeout(resolve, 200));
            }
            const { data: { session }, } = await supabase.auth.getSession();
            sessionUser = session?.user?.id ?? null;
        }
        uid = sessionUser;
    }
    if (!uid) {
        throw new CurrentUserRoleError('no-session', 'Sesi login tidak ditemukan. Silakan coba lagi.');
    }
    const { data, error } = await supabase
        .from('profiles')
        .select('role, deleted_at, account_status')
        .eq('id', uid)
        .maybeSingle();
    if (error) {
        console.warn('[current-user] gagal membaca peran akun:', error.message);
        throw new CurrentUserRoleError('query-error', 'Gagal membaca peran akun. Silakan coba lagi.');
    }
    if (!data)
        return null;
    if (isAccountDeleted(data)) {
        throw new CurrentUserRoleError('account-deleted', DELETED_ACCOUNT_MESSAGE);
    }
    const blockKind = classifyAccountBlock(data);
    if (blockKind) {
        throw new CurrentUserRoleError(blockKind === 'banned' ? 'account-banned' : 'account-suspended', blockMessageFor(blockKind));
    }
    const role = (data as {
        role?: unknown;
    }).role;
    if (role === 'admin' || role === 'umkm' || role === 'buyer')
        return role;
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
        fullName: (raw.user_metadata?.full_name as string | undefined)?.trim() ||
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
            if (!mounted)
                return;
            setUser(result);
            setLoading(false);
        });
        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!mounted)
                return;
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
