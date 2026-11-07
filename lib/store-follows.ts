'use client';
import { supabase } from './supabase';
export const STORE_FOLLOW_UPDATED_EVENT = 'rebites:store-follow-updated';
function dispatchFollowUpdated() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(STORE_FOLLOW_UPDATED_EVENT));
    }
}
export interface FollowedStore {
    umkmId: string;
    slug: string | null;
    name: string;
    logoUrl: string | null;
    category: string | null;
    rating: number;
}
async function getSessionUserId(): Promise<string | null> {
    const { data: { session }, } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
}
async function resolveUmkmId(key: string): Promise<string | null> {
    const trimmed = key.trim();
    if (!trimmed)
        return null;
    const { data } = await supabase
        .from('umkm_profiles')
        .select('id')
        .or(`slug.eq.${trimmed},id.eq.${trimmed}`)
        .maybeSingle();
    return data?.id ?? null;
}
export async function isFollowingStore(key: string): Promise<boolean> {
    try {
        const userId = await getSessionUserId();
        if (!userId) {
            if (typeof window !== 'undefined') {
                try {
                    const raw = localStorage.getItem('rebites_followed_stores');
                    const arr: string[] = raw ? JSON.parse(raw) : [];
                    return arr.includes(key);
                }
                catch { }
            }
            return false;
        }
        const umkmId = await resolveUmkmId(key);
        if (!umkmId) {
            if (typeof window !== 'undefined') {
                try {
                    const raw = localStorage.getItem('rebites_followed_stores');
                    const arr: string[] = raw ? JSON.parse(raw) : [];
                    return arr.includes(key);
                }
                catch { }
            }
            return false;
        }
        const { data, error } = await supabase
            .from('store_follows')
            .select('id')
            .eq('user_id', userId)
            .eq('umkm_id', umkmId)
            .maybeSingle();
        if (error && error.code !== 'PGRST116') {
            if (typeof window !== 'undefined') {
                try {
                    const raw = localStorage.getItem('rebites_followed_stores');
                    const arr: string[] = raw ? JSON.parse(raw) : [];
                    return arr.includes(key);
                }
                catch { }
            }
        }
        return Boolean(data);
    }
    catch {
        if (typeof window !== 'undefined') {
            try {
                const raw = localStorage.getItem('rebites_followed_stores');
                const arr: string[] = raw ? JSON.parse(raw) : [];
                return arr.includes(key);
            }
            catch { }
        }
        return false;
    }
}
function getLocalFollowedKeys(): string[] {
    if (typeof window === 'undefined')
        return [];
    try {
        const raw = localStorage.getItem('rebites_followed_stores');
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    }
    catch {
        return [];
    }
}
function setLocalFollowedKeys(keys: string[]) {
    if (typeof window === 'undefined')
        return;
    try {
        localStorage.setItem('rebites_followed_stores', JSON.stringify(keys));
    }
    catch { }
}
function addLocalFollow(key: string) {
    const arr = getLocalFollowedKeys();
    if (!arr.includes(key)) {
        arr.push(key);
        setLocalFollowedKeys(arr);
    }
}
function removeLocalFollow(key: string) {
    const arr = getLocalFollowedKeys();
    const next = arr.filter((k) => k !== key);
    setLocalFollowedKeys(next);
}
export async function setFollowingStore(key: string, follow: boolean): Promise<boolean> {
    const userId = await getSessionUserId();
    if (!userId) {
        if (follow)
            addLocalFollow(key);
        else
            removeLocalFollow(key);
        dispatchFollowUpdated();
        if (typeof window !== 'undefined')
            window.location.href = '/auth/login';
        return false;
    }
    const umkmId = await resolveUmkmId(key);
    const effectiveKey = umkmId || key;
    if (follow) {
        try {
            const { data: existing } = await supabase
                .from('store_follows')
                .select('id')
                .eq('user_id', userId)
                .eq('umkm_id', umkmId || key)
                .maybeSingle();
            if (existing) {
                addLocalFollow(key);
                dispatchFollowUpdated();
                return true;
            }
        }
        catch { }
        try {
            const { error } = await supabase
                .from('store_follows')
                .insert({ user_id: userId, umkm_id: umkmId || key });
            if (error)
                throw error;
            addLocalFollow(key);
            dispatchFollowUpdated();
            return true;
        }
        catch (e: any) {
            console.error('[store-follows] gagal mengikuti toko, fallback lokal:', e?.message || e);
            addLocalFollow(key);
            dispatchFollowUpdated();
            return true;
        }
    }
    try {
        const { error } = await supabase
            .from('store_follows')
            .delete()
            .eq('user_id', userId)
            .eq('umkm_id', umkmId || key);
        if (error)
            throw error;
        removeLocalFollow(key);
        dispatchFollowUpdated();
        return true;
    }
    catch (e: any) {
        console.error('[store-follows] gagal berhenti mengikuti, fallback lokal:', e?.message || e);
        removeLocalFollow(key);
        dispatchFollowUpdated();
        return true;
    }
}
type FollowRow = Record<string, any>;
async function fetchLocalFollowedStores(): Promise<FollowedStore[]> {
    const keys = getLocalFollowedKeys();
    if (keys.length === 0)
        return [];
    const results: FollowedStore[] = [];
    for (const key of keys) {
        try {
            const umkmId = await resolveUmkmId(key);
            if (umkmId) {
                const { data } = await supabase.from('umkm_profiles').select('id, slug, business_name, logo_url, category, rating').eq('id', umkmId).maybeSingle();
                if (data) {
                    results.push({
                        umkmId: data.id,
                        slug: data.slug ?? key,
                        name: data.business_name ?? key,
                        logoUrl: data.logo_url ?? null,
                        category: data.category ?? null,
                        rating: Number(data.rating ?? 5),
                    });
                    continue;
                }
            }
            const prettyName = key
                .replace(/-/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase());
            results.push({
                umkmId: key,
                slug: key,
                name: prettyName,
                logoUrl: null,
                category: null,
                rating: 5,
            });
        }
        catch {
            const prettyName = key
                .replace(/-/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase());
            results.push({
                umkmId: key,
                slug: key,
                name: prettyName,
                logoUrl: null,
                category: null,
                rating: 5,
            });
        }
    }
    return results;
}
export async function getFollowedStores(): Promise<FollowedStore[]> {
    try {
        const userId = await getSessionUserId();
        if (!userId) {
            return await fetchLocalFollowedStores();
        }
        const { data, error } = await supabase
            .from('store_follows')
            .select('umkm_id, created_at, umkm_profiles(id, slug, business_name, logo_url, category, rating)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error || !data) {
            const local = await fetchLocalFollowedStores();
            if (local.length > 0)
                return local;
            return [];
        }
        const remote = data
            .map((row: FollowRow) => {
            const umkm = row.umkm_profiles as {
                id: string;
                slug: string | null;
                business_name: string | null;
                logo_url: string | null;
                category: string | null;
                rating: number | null;
            } | null;
            const umkmId = umkm?.id ?? String(row.umkm_id ?? '');
            if (!umkmId)
                return null;
            return {
                umkmId,
                slug: umkm?.slug ?? null,
                name: umkm?.business_name ?? umkm?.slug ?? umkmId,
                logoUrl: umkm?.logo_url ?? null,
                category: umkm?.category ?? null,
                rating: Number(umkm?.rating ?? 5),
            };
        })
            .filter(Boolean) as FollowedStore[];
        const localKeys = getLocalFollowedKeys();
        const remoteIds = new Set(remote.map((r) => r.umkmId).concat(remote.map((r) => r.slug).filter(Boolean) as string[]));
        const missingLocal = localKeys.filter((k) => !remoteIds.has(k));
        if (missingLocal.length > 0) {
            const extra = await Promise.all(missingLocal.map(async (key) => {
                const umkmId = await resolveUmkmId(key);
                if (umkmId) {
                    const { data } = await supabase.from('umkm_profiles').select('id, slug, business_name, logo_url, category, rating').eq('id', umkmId).maybeSingle();
                    if (data) {
                        const prettyFromKey = key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                        return { umkmId: data.id, slug: data.slug ?? key, name: data.business_name ?? prettyFromKey, logoUrl: data.logo_url ?? null, category: data.category ?? null, rating: Number(data.rating ?? 5) } as FollowedStore;
                    }
                }
                const prettyName = key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                return { umkmId: key, slug: key, name: prettyName, logoUrl: null, category: null, rating: 5 } as FollowedStore;
            }));
            return [...remote, ...extra];
        }
        return remote;
    }
    catch {
        return await fetchLocalFollowedStores();
    }
}
