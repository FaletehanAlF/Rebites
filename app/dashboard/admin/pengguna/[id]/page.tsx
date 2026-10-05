'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { useRequireAdmin } from '@/hooks/use-require-admin';
import { UserDetailView } from '@/app/components/admin/user-detail-view';
import { UserRoleHistory } from '@/app/components/admin/user-role-history';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  AdminUsersApiError,
  fetchAdminUserDetail,
  type AdminUserDetail,
} from '@/lib/admin-users';

export default function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const { loading: adminLoading, isAdmin } = useRequireAdmin();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden' | 'not-found'>(
    'loading'
  );
  const [errorMsg, setErrorMsg] = useState('');

  const load = useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const result = await fetchAdminUserDetail(params.id);
      setUser(result);
      setStatus('ready');
    } catch (err) {
      if (err instanceof AdminUsersApiError && err.status === 401) {
        setStatus('error');
        setErrorMsg('Sesi habis, silakan login ulang.');
        return;
      }
      if (err instanceof AdminUsersApiError && err.status === 403) {
        setStatus('forbidden');
        return;
      }
      if (err instanceof AdminUsersApiError && err.status === 404) {
        setStatus('not-found');
        return;
      }
      setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat detail pengguna.');
      setStatus('error');
    }
  }, [params.id]);

  useEffect(() => {
    if (!adminLoading && isAdmin) {
      load();
    }
  }, [adminLoading, isAdmin, load]);

  if (adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAdmin) {
    // Redirect ditangani hook (ke /auth/login atau /).
    return null;
  }

  return (
    <div className="min-h-screen bg-cream-50 font-sans text-charcoal-900">
      {(status === 'loading' || (status === 'ready' && !user)) && (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {status === 'forbidden' && (
        <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
          <Card className="mt-8">
            <CardContent className="flex flex-col items-center px-6 py-14 text-center">
              <ShieldAlert className="h-10 w-10 text-caramel" />
              <h2 className="mt-4 font-display text-xl font-semibold text-primary">Akses ditolak</h2>
              <p className="mt-1 max-w-sm text-sm text-sage-500">
                Halaman ini hanya untuk admin.
              </p>
              <Link href="/" className="mt-5">
                <Button type="button" variant="outline" size="sm">
                  Kembali ke Beranda
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {status === 'not-found' && (
        <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
          <Card className="mt-8">
            <CardContent className="flex flex-col items-center px-6 py-14 text-center">
              <ShieldAlert className="h-10 w-10 text-caramel" />
              <h2 className="mt-4 font-display text-xl font-semibold text-primary">
                Pengguna tidak ditemukan
              </h2>
              <p className="mt-1 max-w-sm text-sm text-sage-500">
                ID pengguna tidak cocok dengan data terdaftar.
              </p>
              <Link href="/dashboard/admin/pengguna" className="mt-5">
                <Button type="button" variant="outline" size="sm">
                  Kembali ke Daftar
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {status === 'error' && (
        <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 sm:px-6 lg:px-8">
          <Card className="mt-8">
            <CardContent className="flex flex-col items-center px-6 py-14 text-center">
              <ShieldAlert className="h-10 w-10 text-caramel" />
              <h2 className="mt-4 font-display text-xl font-semibold text-primary">
                Gagal memuat pengguna
              </h2>
              <p className="mt-1 max-w-sm text-sm text-sage-500">{errorMsg}</p>
              <Button type="button" size="sm" className="mt-5" onClick={() => load()}>
                Coba lagi
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {status === 'ready' && user && (
        <>
          <UserDetailView
            user={user}
            onRoleChanged={() => {
              load();
              setHistoryKey((k) => k + 1);
            }}
          />
          <div className="mx-auto -mt-14 w-full max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
            <UserRoleHistory userId={user.id} refreshKey={historyKey} />
          </div>
        </>
      )}
    </div>
  );
}
