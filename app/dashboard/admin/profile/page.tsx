'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/current-user';
import { useProfile, updateProfileContact } from '@/hooks/use-profile';
import { useAdminMe } from '@/hooks/use-admin-me';
import { AdminProfileView } from '@/app/components/admin/admin-profile-view';
export default function AdminProfilePage() {
    const router = useRouter();
    const { user, userId, loading } = useCurrentUser();
    const { avatarUrl, refresh: refreshProfile } = useProfile();
    const adminMe = useAdminMe();
    const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [accountStatus, setAccountStatus] = useState<string | null>(null);
    const [phone, setPhone] = useState<string | null>(null);
    const [joinedAt, setJoinedAt] = useState<string | null>(null);
    const [reloadIdx, setReloadIdx] = useState(0);
    useEffect(() => {
        let mounted = true;
        if (loading)
            return;
        if (!userId) {
            setState('error');
            setErrorMessage('Sesi login tidak ditemukan.');
            return;
        }
        setState('loading');
        supabase
            .from('profiles')
            .select('role, account_status, phone, created_at')
            .eq('id', userId)
            .maybeSingle()
            .then(({ data, error }) => {
            if (!mounted)
                return;
            if (error || !data) {
                setErrorMessage('Profil belum dapat dimuat dari server.');
                setState('error');
                return;
            }
            const row = data as {
                role?: string | null;
                account_status?: string | null;
                phone?: string | null;
                created_at?: string | null;
            };
            setRole(row.role ?? null);
            setAccountStatus(row.account_status ?? null);
            setPhone(row.phone ?? null);
            setJoinedAt(row.created_at ?? null);
            setState('ready');
        });
        return () => {
            mounted = false;
        };
    }, [userId, loading, reloadIdx]);
    const handleSaveProfile = useCallback(async (input: {
        fullName: string;
        phone: string;
    }) => {
        const { error } = await updateProfileContact(input);
        if (error)
            return { error };
        setReloadIdx((v) => v + 1);
        refreshProfile();
        return { error: null };
    }, [refreshProfile]);
    const handleLogout = useCallback(async () => {
        await supabase.auth.signOut();
        router.push('/auth/login');
    }, [router]);
    return (<AdminProfileView state={state} errorMessage={errorMessage} fullName={user?.fullName ?? ''} email={user?.email ?? ''} avatarUrl={avatarUrl} phone={phone} role={role} accountStatus={accountStatus} joinedAt={joinedAt} isSuperAdmin={adminMe.me?.isSuperAdmin === true} superAdminConfigured={adminMe.me?.superAdminConfigured === true} accessState={adminMe.status} onAvatarChanged={refreshProfile} onLogout={handleLogout} onSaveProfile={handleSaveProfile}/>);
}
