'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  AdminUsersApiError,
  fetchAdminRoleHistory,
  type AdminRoleHistoryItem,
} from '@/lib/admin-users';

const PAGE_LIMIT = 20;

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function UserRoleHistory({
  userId,
  refreshKey,
}: {
  userId: string | null;
  refreshKey: number;
}) {
  const [logs, setLogs] = useState<AdminRoleHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const load = useCallback(
    async (nextOffset: number) => {
      if (!userId) {
        setStatus('ready');
        return;
      }
      setStatus('loading');
      setErrorMsg('');
      try {
        const result = await fetchAdminRoleHistory(userId, PAGE_LIMIT, nextOffset);
        setLogs(result.logs);
        setTotal(result.total);
        setOffset(result.offset);
        setStatus('ready');
      } catch (err) {
        if (err instanceof AdminUsersApiError && err.status === 401) {
          setErrorMsg('Sesi habis, silakan login ulang.');
        } else {
          setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat riwayat role.');
        }
        setStatus('error');
      }
    },
    [userId]
  );

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, refreshKey]);

  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE_LIMIT, total);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-primary" />
          Riwayat Perubahan Role
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status === 'loading' && (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center py-6 text-center">
            <p className="text-sm text-sage-500">{errorMsg}</p>
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => load(offset)}>
              Coba lagi
            </Button>
          </div>
        )}

        {status === 'ready' && logs.length === 0 && (
          <p className="py-6 text-center text-sm text-sage-500">
            Belum ada perubahan role yang tercatat untuk pengguna ini.
          </p>
        )}

        {status === 'ready' && logs.length > 0 && (
          <>
            <ul className="grid gap-3">
              {logs.map((log) => (
                <li
                  key={log.id ?? `${log.created_at}-${log.new_role}`}
                  className="rounded-xl bg-cream-50 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="secondary">{log.old_role ?? '-'}</Badge>
                    <span aria-hidden="true" className="text-sage-500">→</span>
                    <Badge variant="default">{log.new_role ?? '-'}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-sage-500">
                    {formatDateTime(log.created_at)} · oleh{' '}
                    {log.actor?.full_name?.trim() ||
                      log.actor?.email ||
                      'admin tidak diketahui'}
                  </p>
                </li>
              ))}
            </ul>
            {total > PAGE_LIMIT && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-sage-500">
                  {showingFrom}–{showingTo} dari {total}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={offset <= 0}
                    onClick={() => load(Math.max(0, offset - PAGE_LIMIT))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={offset + PAGE_LIMIT >= total}
                    onClick={() => load(offset + PAGE_LIMIT)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
