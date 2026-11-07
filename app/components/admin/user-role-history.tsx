'use client';
import { useCallback, useEffect, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { AdminPagination } from './admin-controls';
import { AdminInlineError, AdminInlineLoading, AdminInlineMessage, } from './admin-state';
import { formatTanggalWaktu, labelPeran, varianPeran, } from './admin-format';
import { AdminUsersApiError, fetchAdminRoleHistory, type AdminRoleHistoryItem, } from '@/lib/admin-users';
const PAGE_LIMIT = 20;
export function UserRoleHistory({ userId, refreshKey, }: {
    userId: string | null;
    refreshKey: number;
}) {
    const [logs, setLogs] = useState<AdminRoleHistoryItem[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const load = useCallback(async (nextOffset: number) => {
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
        }
        catch (err) {
            if (err instanceof AdminUsersApiError && err.status === 401) {
                setErrorMsg('Sesi habis, silakan login ulang.');
            }
            else {
                setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat riwayat peran.');
            }
            setStatus('error');
        }
    }, [userId]);
    useEffect(() => {
        load(0);
// eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, refreshKey]);
    const page = Math.floor(offset / PAGE_LIMIT) + 1;
    return (<Card className="mt-5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History aria-hidden className="h-4 w-4 text-primary"/>
          Riwayat perubahan peran
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status === 'loading' && <AdminInlineLoading label="Memuat riwayat"/>}

        {status === 'error' && (<div className="flex flex-col items-center gap-4 py-2">
            <AdminInlineError message={errorMsg}/>
            <Button type="button" size="sm" variant="outline" onClick={() => {
                void load(offset);
            }}>
              <RefreshCw aria-hidden className="h-3.5 w-3.5"/>
              Coba Lagi
            </Button>
          </div>)}

        {status === 'ready' && logs.length === 0 && (<div className="py-6 text-center">
            <AdminInlineMessage>
              Belum ada perubahan peran yang tercatat untuk pengguna ini.
            </AdminInlineMessage>
          </div>)}

        {status === 'ready' && logs.length > 0 && (<>
            <ul className="grid gap-4">
              {logs.map((log) => (<li key={log.id ?? `${log.created_at}-${log.new_role}`} className="rounded-[var(--radius)] bg-cream-50 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant={varianPeran(log.old_role)}>{labelPeran(log.old_role)}</Badge>
                    <span aria-hidden="true" className="text-sage-500">
                      →
                    </span>
                    <Badge variant={varianPeran(log.new_role)}>{labelPeran(log.new_role)}</Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-sage-500">
                    {formatTanggalWaktu(log.created_at)} · oleh{' '}
                    {log.actor?.full_name?.trim() ||
                    log.actor?.email ||
                    'admin tidak diketahui'}
                  </p>
                </li>))}
            </ul>
            {total > PAGE_LIMIT && (<AdminPagination total={total} page={page} pageSize={PAGE_LIMIT} noun="perubahan peran" onPageChange={(next) => {
                    void load((next - 1) * PAGE_LIMIT);
                }}/>)}
          </>)}
      </CardContent>
    </Card>);
}
