'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth, getValidAuthHeader } from '@/lib/auth-token';
import { avatarFileError } from '@/lib/admin-avatar';
export const PROFILE_UPDATED_EVENT = 'rebites-profile-updated';
export interface ProfileData {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
}
function getInitials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p.charAt(0).toUpperCase())
        .join('');
}
export function useProfile() {
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshIdx, setRefreshIdx] = useState(0);
    const refresh = useCallback(() => setRefreshIdx((v) => v + 1), []);
    useEffect(() => {
        let cancelled = false;
        const fetchProfile = async () => {
            setLoading(true);
            try {
                const { data: { session }, } = await supabase.auth.getSession();
                const user = session?.user;
                if (!user) {
                    if (!cancelled) {
                        setProfile(null);
                        setLoading(false);
                    }
                    return;
                }
                const metaName = (user.user_metadata as Record<string, unknown> | null)?.full_name as string | undefined;
                const metaAvatar = (user.user_metadata as Record<string, unknown> | null)?.avatar_url as string | undefined;
                const email = user.email ?? '';
                const fallbackName = metaName?.trim() || email.split('@')[0] || 'Pengguna ReBites';
                let avatarUrl: string | null = null;
                let fullNameFromDb: string | null = null;
                try {
                    let ok = false;
                    try {
                        const res = await fetchWithAuth('/api/profile');
                        if (res.ok) {
                            const json = (await res.json()) as {
                                profile?: {
                                    full_name: string | null;
                                    avatar_url: string | null;
                                };
                            };
                            avatarUrl = json.profile?.avatar_url ?? null;
                            fullNameFromDb = json.profile?.full_name ?? null;
                            ok = true;
                        }
                    }
                    catch {
                    }
                    if (!ok) {
                        const { data: row, error } = await supabase
                            .from('profiles')
                            .select('avatar_url, full_name')
                            .eq('id', user.id)
                            .maybeSingle();
                        if (!error && row) {
                            avatarUrl = (row as {
                                avatar_url: string | null;
                            }).avatar_url ?? null;
                            fullNameFromDb = (row as {
                                full_name: string | null;
                            }).full_name ?? null;
                        }
                    }
                }
                catch {
                }
                const finalAvatar = avatarUrl || metaAvatar || null;
                const finalName = fullNameFromDb?.trim() || fallbackName;
                if (!cancelled) {
                    setProfile({
                        id: user.id,
                        fullName: finalName,
                        email,
                        avatarUrl: finalAvatar,
                    });
                }
            }
            catch {
                if (!cancelled)
                    setProfile(null);
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        };
        fetchProfile();
        const { data: { subscription }, } = supabase.auth.onAuthStateChange(() => {
            fetchProfile();
        });
        const onProfileUpdated = () => fetchProfile();
        window.addEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
        return () => {
            cancelled = true;
            subscription.unsubscribe();
            window.removeEventListener(PROFILE_UPDATED_EVENT, onProfileUpdated);
        };
    }, [refreshIdx]);
    return {
        profile,
        userId: profile?.id ?? null,
        fullName: profile?.fullName ?? '',
        email: profile?.email ?? '',
        avatarUrl: profile?.avatarUrl ?? null,
        initials: profile?.fullName ? getInitials(profile.fullName) : '',
        loading,
        refresh,
    };
}
export async function uploadAvatar(file: File): Promise<{
    publicUrl: string | null;
    error: string | null;
}> {
    const { data: { session }, } = await supabase.auth.getSession();
    if (!session?.user.id) {
        return { publicUrl: null, error: 'Sesi tidak ditemukan, silakan login ulang.' };
    }
    let authHeader: string;
    try {
        authHeader = await getValidAuthHeader();
    }
    catch {
        return { publicUrl: null, error: 'Sesi tidak ditemukan, silakan login ulang.' };
    }
    const masalah = avatarFileError(file);
    if (masalah) {
        return { publicUrl: null, error: masalah };
    }
    try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetchWithAuth('/api/profile/avatar', {
            method: 'POST',
            headers: { Authorization: authHeader },
            body: form,
        });
        const json = (await res.json().catch(() => null)) as {
            publicUrl?: string | null;
            error?: string;
        } | null;
        if (!res.ok || !json?.publicUrl) {
            return { publicUrl: null, error: json?.error || 'Gagal upload foto.' };
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
        }
        return { publicUrl: json.publicUrl, error: null };
    }
    catch (e) {
        return {
            publicUrl: null,
            error: e instanceof Error ? e.message : 'Gagal upload foto.',
        };
    }
}
export async function updateProfileName(fullName: string): Promise<{
    error: string | null;
}> {
    const { error } = await updateProfileContact({ fullName });
    return { error };
}
export async function removeAvatar(): Promise<{
    error: string | null;
}> {
    let authHeader: string;
    try {
        authHeader = await getValidAuthHeader();
    }
    catch {
        return { error: 'Sesi tidak ditemukan, silakan login ulang.' };
    }
    try {
        const res = await fetchWithAuth('/api/profile/avatar', {
            method: 'DELETE',
            headers: { Authorization: authHeader },
        });
        if (!res.ok) {
            const json = (await res.json().catch(() => null)) as {
                error?: string;
            } | null;
            return { error: json?.error || 'Gagal menghapus foto.' };
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
        }
        return { error: null };
    }
    catch (e) {
        return { error: e instanceof Error ? e.message : 'Gagal menghapus foto.' };
    }
}
export async function updateProfileContact(input: {
    fullName?: string;
    phone?: string;
}): Promise<{
    error: string | null;
}> {
    let authHeader: string;
    try {
        authHeader = await getValidAuthHeader();
    }
    catch {
        return { error: 'Sesi tidak ditemukan, silakan login ulang.' };
    }
    const body: {
        fullName?: string;
        phone?: string;
    } = {};
    if (input.fullName !== undefined)
        body.fullName = input.fullName.trim();
    if (input.phone !== undefined)
        body.phone = input.phone.trim();
    try {
        const res = await fetchWithAuth('/api/profile', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: authHeader,
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const json = (await res.json().catch(() => null)) as {
                error?: string;
            } | null;
            return { error: json?.error || 'Gagal menyimpan profil.' };
        }
        if (body.fullName) {
            try {
                await supabase.auth.updateUser({ data: { full_name: body.fullName } });
            }
            catch {
            }
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
        }
        return { error: null };
    }
    catch (e) {
        return { error: e instanceof Error ? e.message : 'Gagal menyimpan profil.' };
    }
}
