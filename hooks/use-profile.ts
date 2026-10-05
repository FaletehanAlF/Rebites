'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchWithAuth, getValidAuthHeader } from '@/lib/auth-token';

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
        const {
          data: { session },
        } = await supabase.auth.getSession();
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

        // Try fetch via backend API (GET /api/profile) - fallback langsung ke tabel
        let avatarUrl: string | null = null;
        let fullNameFromDb: string | null = null;
        try {
          let ok = false;
          try {
            // Token fresh + retry 1x bila 401 (tanpa logout paksa).
            const res = await fetchWithAuth('/api/profile');
            if (res.ok) {
              const json = (await res.json()) as {
                profile?: { full_name: string | null; avatar_url: string | null };
              };
              avatarUrl = json.profile?.avatar_url ?? null;
              fullNameFromDb = json.profile?.full_name ?? null;
              ok = true;
            }
          } catch {
            // AuthError (tidak ada session) -> lanjut ke fallback RLS di bawah.
          }
          if (!ok) {
            // Fallback: baca langsung dari tabel profiles via RLS
            const { data: row, error } = await supabase
              .from('profiles')
              .select('avatar_url, full_name')
              .eq('id', user.id)
              .maybeSingle();
            if (!error && row) {
              avatarUrl = (row as { avatar_url: string | null }).avatar_url ?? null;
              fullNameFromDb = (row as { full_name: string | null }).full_name ?? null;
            }
          }
        } catch {
          
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
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
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

export async function uploadAvatar(file: File): Promise<{ publicUrl: string | null; error: string | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user.id) {
    return { publicUrl: null, error: 'Sesi tidak ditemukan, silakan login ulang.' };
  }
  let authHeader: string;
  try {
    authHeader = await getValidAuthHeader();
  } catch {
    return { publicUrl: null, error: 'Sesi tidak ditemukan, silakan login ulang.' };
  }

  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return { publicUrl: null, error: 'Format file harus JPG, JPEG, PNG, atau WebP.' };
  }
  const maxBytes = 2 * 1024 * 1024; 
  if (file.size > maxBytes) {
    return { publicUrl: null, error: 'Ukuran file maksimal 2MB.' };
  }

  // Upload via backend API (POST /api/profile/avatar) - server yang
  // menyimpan ke bucket `avatars` dan update profiles.avatar_url.
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

    // Broadcast
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
    }

    return { publicUrl: json.publicUrl, error: null };
  } catch (e) {
    return {
      publicUrl: null,
      error: e instanceof Error ? e.message : 'Gagal upload foto.',
    };
  }
}

/** Simpan nama profil via backend API (PATCH /api/profile). */
export async function updateProfileName(fullName: string): Promise<{ error: string | null }> {
  let authHeader: string;
  try {
    authHeader = await getValidAuthHeader();
  } catch {
    return { error: 'Sesi tidak ditemukan, silakan login ulang.' };
  }

  try {
    const res = await fetchWithAuth('/api/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({ fullName }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      return { error: json?.error || 'Gagal menyimpan nama.' };
    }

    // Sinkronkan juga metadata sesi client agar navbar langsung ikut ter-update
    try {
      await supabase.auth.updateUser({ data: { full_name: fullName.trim() } });
    } catch {
      // ignore - profiles (server) tetap sumber kebenaran
    }

    // Broadcast
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
    }

    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gagal menyimpan nama.' };
  }
}
