'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/current-user';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  AdminPageHeader,
  ADMIN_PAGE_WRAPPER,
} from '@/app/components/admin/admin-page-header';
import { labelPeran, varianPeran } from '@/app/components/admin/admin-format';

function statusAkunLabel(status: string | null): string {
  if (status === 'active') return 'Aktif';
  if (status === 'suspended') return 'Ditangguhkan';
  if (status === 'banned') return 'Diblokir';
  return 'Tidak diketahui';
}

function statusAkunVariant(
  status: string | null
): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status === 'active') return 'success';
  if (status === 'suspended') return 'warning';
  if (status === 'banned') return 'destructive';
  return 'secondary';
}

export default function AdminProfilePage() {
  const router = useRouter();
  const { user, userId, loading } = useCurrentUser();
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [profileState, setProfileState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let mounted = true;
    if (loading) return;
    if (!userId) {
      setProfileState('error');
      return;
    }
    setProfileState('loading');
    supabase
      .from('profiles')
      .select('account_status, role')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error || !data) {
          setProfileState('error');
          return;
        }
        const profile = data as { account_status?: string | null; role?: string | null };
        setAccountStatus(profile.account_status ?? 'active');
        setProfileRole(profile.role ?? null);
        setProfileState('ready');
      });
    return () => {
      mounted = false;
    };
  }, [userId, loading]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  const inisial = (user?.fullName || user?.email || 'A').trim().charAt(0).toUpperCase();
  const accountStatusLabel =
    profileState === 'loading'
      ? 'Memuat…'
      : profileState === 'error'
        ? 'Tidak diketahui'
        : statusAkunLabel(accountStatus);
  const peranLabel =
    profileState === 'loading'
      ? 'Memuat…'
      : profileState === 'error'
        ? 'Tidak diketahui'
        : labelPeran(profileRole);
  const statusBadgeVariant =
    profileState === 'ready' ? statusAkunVariant(accountStatus) : 'secondary';

  return (
    <div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader
        eyebrow="Admin"
        title="Profil Saya"
        description="Informasi akun admin Anda."
      />

      <Card className="max-w-2xl">
        <CardContent className="px-5 py-5">
          <div className="flex items-center gap-4">
            <span
              aria-hidden
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary"
            >
              {inisial}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold text-charcoal-900">
                {loading ? 'Memuat…' : user?.fullName || 'Admin'}
              </p>
              <p className="truncate text-sm text-sage-500">{user?.email || '-'}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge
                  variant={profileState === 'ready' ? varianPeran(profileRole) : 'secondary'}
                >
                  {peranLabel}
                </Badge>
                <Badge variant={statusBadgeVariant}>{accountStatusLabel}</Badge>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <h2 className="font-display text-sm font-semibold text-charcoal-900">
              Informasi akun
            </h2>
            <dl className="mt-3 space-y-2.5 text-sm">
              {[
                { label: 'Nama', value: user?.fullName || '-' },
                { label: 'Email', value: user?.email || '-' },
                { label: 'Peran', value: peranLabel },
                { label: 'Status akun', value: accountStatusLabel },
              ].map((row) => (
                <div key={row.label} className="flex justify-between gap-4">
                  <dt className="shrink-0 text-sage-500">{row.label}</dt>
                  <dd className="truncate font-medium text-charcoal-900">{row.value}</dd>
                </div>
              ))}
            </dl>
            {profileState === 'error' && (
              <p
                role="status"
                className="mt-4 rounded-[var(--radius)] border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-charcoal-700"
              >
                Status akun dan peran belum dapat diverifikasi dari profil. Coba muat ulang
                halaman ini.
              </p>
            )}
            <p className="mt-4 text-sm text-sage-500">
              Pengelolaan kata sandi dilakukan melalui halaman login dan pemulihan kata sandi.
            </p>
            <Button type="button" variant="outline" className="mt-5" onClick={handleLogout}>
              <LogOut aria-hidden className="h-4 w-4" />
              Keluar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}