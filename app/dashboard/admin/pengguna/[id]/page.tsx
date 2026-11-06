'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { UserRoundX } from 'lucide-react';
import { UserDetailView } from '@/app/components/admin/user-detail-view';
import { UserRoleHistory } from '@/app/components/admin/user-role-history';
import { ModerationHistory } from '@/app/components/admin/moderation-history';
import { Button } from '@/app/components/ui/button';
import { ADMIN_PAGE_WRAPPER } from '@/app/components/admin/admin-page-header';
import {
  AdminEmptyState,
  AdminErrorState,
  AdminForbiddenState,
  AdminLoadingState,
} from '@/app/components/admin/admin-state';
import {
  AdminUsersApiError,
  fetchAdminUserDetail,
  type AdminUserDetail,
} from '@/lib/admin-users';

export default function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [status, setStatus] = useState<
    'loading' | 'ready' | 'error' | 'forbidden' | 'not-found'
  >('loading');
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
    load();
  }, [load]);

  if (status === 'loading' || (status === 'ready' && !user)) {
    return (
      <div className={ADMIN_PAGE_WRAPPER}>
        <AdminLoadingState label="Memuat detail pengguna" />
      </div>
    );
  }

  if (status === 'forbidden') {
    return (
      <div className={ADMIN_PAGE_WRAPPER}>
        <AdminForbiddenState />
      </div>
    );
  }

  if (status === 'not-found') {
    return (
      <div className={ADMIN_PAGE_WRAPPER}>
        <AdminEmptyState
          icon={<UserRoundX aria-hidden className="h-10 w-10 text-primary" />}
          title="Pengguna tidak ditemukan"
          description="ID pengguna tidak cocok dengan data terdaftar."
          action={
            <Link href="/dashboard/admin/pengguna">
              <Button type="button" variant="outline" size="sm">
                Kembali ke daftar pengguna
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={ADMIN_PAGE_WRAPPER}>
        <AdminErrorState
          title="Gagal memuat pengguna"
          message={errorMsg}
          onRetry={() => void load()}
        />
      </div>
    );
  }

  return (
    <div className={ADMIN_PAGE_WRAPPER}>
      <UserDetailView
        user={user!}
        onRoleChanged={() => {
          void load();
          setHistoryKey((k) => k + 1);
        }}
      />
      <ModerationHistory userId={user!.id} />
      <UserRoleHistory userId={user!.id} refreshKey={historyKey} />
    </div>
  );
}