'use client';
import { useCallback, useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { CoinAdjustmentPanel } from './coin-adjustment-panel';
import { AdminPageHeader, ADMIN_PAGE_WRAPPER } from './admin-page-header';
import { AdminSearchInput } from './admin-controls';
import { AdminErrorState, AdminLoadingState } from './admin-state';
import { fetchAdminUsers, type AdminUserItem } from '@/lib/admin-users';
export function CoinsView() {
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [users, setUsers] = useState<AdminUserItem[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
        return () => clearTimeout(timer);
    }, [search]);
    const load = useCallback(async () => {
        setStatus('loading');
        setErrorMsg('');
        try {
            const result = await fetchAdminUsers({ limit: 20, offset: 0, search: debouncedSearch });
            setUsers(result.users);
            setStatus('ready');
        }
        catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat pengguna.');
            setStatus('error');
        }
    }, [debouncedSearch]);
    useEffect(() => {
        void load();
    }, [load]);
    const selected = users.find((u) => u.id === selectedId) ?? null;
    return (<div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader title="ReBites Coin"/>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins aria-hidden className="h-4 w-4 text-primary"/>
              Pilih pengguna
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <AdminSearchInput value={search} onChange={setSearch} label="Cari pengguna" labelVisible placeholder="Cari nama atau email…"/>
            {status === 'loading' && <AdminLoadingState label="Memuat pengguna"/>}
            {status === 'error' && (<AdminErrorState title="Gagal memuat pengguna" message={errorMsg} onRetry={() => void load()}/>)}
            {status === 'ready' && users.length === 0 && (<p className="rounded-[var(--radius)] bg-cream-50 px-4 py-3 text-sm text-sage-500">
                Tidak ada pengguna yang cocok.
              </p>)}
            {status === 'ready' && users.length > 0 && (<ul className="grid gap-2">
                {users.map((u) => {
                const active = u.id === selectedId;
                return (<li key={u.id}>
                      <button type="button" onClick={() => setSelectedId(u.id)} aria-pressed={active} className={active
                        ? 'flex w-full items-center justify-between gap-3 rounded-[var(--radius)] border border-primary/40 bg-primary/[0.05] px-4 py-3 text-left'
                        : 'flex w-full items-center justify-between gap-3 rounded-[var(--radius)] border border-border bg-white px-4 py-3 text-left transition-colors hover:border-primary/30'}>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-charcoal-900">
                            {u.full_name?.trim() || u.email || 'Pengguna'}
                          </span>
                          <span className="block truncate text-xs text-sage-500">{u.email ?? '-'}</span>
                        </span>
                        <span className="shrink-0 text-xs font-bold tabular-nums text-primary">
                          {(u.coin_balance ?? 0).toLocaleString('id-ID')} Coin
                        </span>
                      </button>
                    </li>);
            })}
              </ul>)}
          </CardContent>
        </Card>

        <div className="min-w-0">
          {selectedId ? (<CoinAdjustmentPanel key={selectedId} userId={selectedId}/>) : (<Card>
              <CardContent className="px-5 py-10 text-center">
                <Coins aria-hidden className="mx-auto h-8 w-8 text-primary"/>
                <p className="mt-3 text-sm font-semibold text-charcoal-900">Pilih pengguna dulu</p>
                <p className="mt-1 text-xs leading-relaxed text-sage-500">
                  Cari di daftar kiri, lalu saldo, riwayat, dan tombol beri/tarik akan muncul di sini.
                </p>
              </CardContent>
            </Card>)}
        </div>
      </div>
    </div>);
}
