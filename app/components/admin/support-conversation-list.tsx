'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, MessageSquare, RefreshCw, Search } from 'lucide-react';
import { AdminAvatar } from './admin-avatar';
import { AdminSupportApiError, fetchAdminSupportThreads, type AdminSupportThread, } from '@/lib/admin-support';
import { appealStatusMeta } from '@/lib/support';
import { labelPeran, labelStatusAkun, waktuLalu } from './admin-format';
import { redirectIfSessionExpired } from './admin-session';
import { SUPPORT_UPDATED_EVENT } from '@/hooks/use-support-badge';
import { subscribeSupportRealtime } from '@/lib/support-realtime';
import { cn } from '@/lib/utils';
const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 400;
const FILTERS: {
    value: '' | 'unread' | 'open' | 'closed';
    label: string;
}[] = [
    { value: '', label: 'Semua' },
    { value: 'unread', label: 'Baru' },
    { value: 'open', label: 'Terbuka' },
    { value: 'closed', label: 'Ditutup' },
];
export function SupportConversationList({ activeThreadId = null, className, }: {
    activeThreadId?: string | null;
    className?: string;
}) {
    const router = useRouter();
    const [threads, setThreads] = useState<AdminSupportThread[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filter, setFilter] = useState<'' | 'unread' | 'open' | 'closed'>('');
    const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const requestIdRef = useRef(0);
    const loadMoreRef = useRef(false);
    const realtimeReloadRef = useRef<() => void>(() => { });
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [search]);
    const load = useCallback(async (nextOffset: number, append = false, silent = false) => {
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        loadMoreRef.current = append;
        if (!append && !silent)
            setStatus('loading');
        if (!silent)
            setErrorMsg('');
        try {
            const result = await fetchAdminSupportThreads({
                limit: PAGE_LIMIT,
                offset: nextOffset,
                search: debouncedSearch,
                status: filter,
            });
            if (requestId !== requestIdRef.current)
                return;
            setThreads((current) => append ? [...current, ...result.threads] : result.threads);
            setTotal(result.total);
            setOffset(result.offset);
            setStatus('ready');
        }
        catch (err) {
            if (requestId !== requestIdRef.current)
                return;
            if (await redirectIfSessionExpired((err as {
                status?: number;
            })?.status ?? 0, router, () => {
                setErrorMsg('Tidak dapat menghubungi server data. Coba lagi.');
                setStatus('error');
            }))
                return;
            if (requestId !== requestIdRef.current)
                return;
            if (err instanceof AdminSupportApiError && err.status === 403) {
                setStatus('forbidden');
                return;
            }
            if (silent)
                return;
            setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat daftar percakapan.');
            setStatus('error');
        }
        finally {
            loadMoreRef.current = false;
        }
    }, [router, filter, debouncedSearch]);
    useEffect(() => {
        void load(0);
    }, [load]);
    useEffect(() => {
        const onUpdated = () => void load(0);
        window.addEventListener(SUPPORT_UPDATED_EVENT, onUpdated);
        return () => window.removeEventListener(SUPPORT_UPDATED_EVENT, onUpdated);
    }, [load]);
    useEffect(() => {
        realtimeReloadRef.current = () => void load(0, false, true);
    }, [load]);
    useEffect(() => subscribeSupportRealtime({
        label: 'admin-list',
        onChange: () => realtimeReloadRef.current(),
    }), []);
    const tampil = offset + threads.length;
    const adaLagi = threads.length > 0 && tampil < total;
    return (<section aria-label="Daftar percakapan" className={cn('flex min-h-0 flex-col overflow-hidden rounded-xl border border-admin-line bg-admin-panel shadow-admin-card', className)}>
      <div className="shrink-0 space-y-3 border-b border-admin-line px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-bold tracking-tight text-charcoal-900">
            Chat
          </h2>
          <button type="button" onClick={() => void load(0)} disabled={status === 'loading'} aria-label="Muat ulang daftar percakapan" className="flex h-8 w-8 items-center justify-center rounded-full text-sage-500 transition-colors hover:bg-admin-surface hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50">
            {status === 'loading' ? (<Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none"/>) : (<RefreshCw aria-hidden className="h-4 w-4"/>)}
          </button>
        </div>

        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sage-500"/>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau email…" aria-label="Cari percakapan" className="h-10 w-full rounded-full border border-admin-line bg-admin-surface pl-9 pr-3 text-sm text-charcoal-900 outline-none transition-colors placeholder:text-sage-500 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"/>
        </div>

        
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((option) => {
            const aktif = filter === option.value;
            return (<button key={option.value || 'semua'} type="button" onClick={() => setFilter(option.value)} aria-pressed={aktif} className={cn('rounded-full px-3 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', aktif
                    ? 'bg-primary text-white'
                    : 'bg-admin-surface text-charcoal-700 hover:bg-admin-surface-hover')}>
                {option.label}
              </button>);
        })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {status === 'forbidden' && (<p className="px-4 py-6 text-sm text-sage-500">
            Halaman ini hanya untuk admin.
          </p>)}

        {status === 'error' && (<div className="px-4 py-6 text-center">
            <p className="text-sm font-semibold text-charcoal-900">
              Gagal memuat percakapan
            </p>
            <p className="mt-1 break-words text-xs text-sage-500">{errorMsg}</p>
            <button type="button" onClick={() => void load(0)} className="mt-3 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              Coba lagi
            </button>
          </div>)}

        {status !== 'forbidden' && status !== 'error' && threads.length === 0 && (<div className="flex flex-col items-center px-6 py-10 text-center">
            {status === 'loading' ? (<Loader2 aria-hidden className="h-6 w-6 animate-spin text-primary motion-reduce:animate-none"/>) : (<MessageSquare aria-hidden className="h-8 w-8 text-sage-500"/>)}
            <p className="mt-3 text-sm font-semibold text-charcoal-900">
              {status === 'loading' ? 'Memuat percakapan…' : 'Belum ada percakapan'}
            </p>
            {status === 'ready' && (<p className="mt-1 text-xs leading-relaxed text-sage-500">
                Pesan dari pembeli, UMKM, atau banding akun akan muncul di sini.
              </p>)}
          </div>)}

        {threads.length > 0 && (<ul className="divide-y divide-admin-line">
            {threads.map((thread) => {
                const aktif = thread.id === activeThreadId;
                const statusAkun = labelStatusAkun(thread.userAccountStatus);
                const appeal = thread.latestAppealStatus
                    ? appealStatusMeta(thread.latestAppealStatus)
                    : null;
                const nama = thread.userName?.trim() || thread.email || 'Tanpa nama';
                return (<li key={thread.id}>
                  <Link href={`/dashboard/admin/chat/${thread.id}`} aria-current={aktif ? 'page' : undefined} className={cn('flex gap-4 px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40', aktif ? 'bg-primary/[0.07]' : 'hover:bg-admin-surface')}>
                    <AdminAvatar src={thread.userAvatarUrl ?? null} name={nama} email={thread.email} size="md" className="mt-0.5 shrink-0"/>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className={cn('truncate text-[13px]', thread.adminUnreadCount > 0
                        ? 'font-bold text-charcoal-900'
                        : 'font-semibold text-charcoal-900')}>
                          {nama}
                        </p>
                        <span className="shrink-0 text-[11px] text-sage-500">
                          {waktuLalu(thread.lastMessageAt)}
                        </span>
                      </div>
                      {thread.userName?.trim() ? (<p className="truncate text-[11px] text-sage-500">
                          {thread.email}
                        </p>) : null}
                      <p className="mt-0.5 line-clamp-2 break-words text-xs leading-relaxed text-charcoal-700">
                        {thread.lastMessagePreview?.trim() || 'Belum ada isi pesan.'}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {statusAkun && (<span className="rounded-full bg-destructive/[0.15] px-2 py-0.5 text-[10px] font-semibold text-destructive">
                            {statusAkun}
                          </span>)}
                        {appeal && (<span className="rounded-full bg-admin-surface px-2 py-0.5 text-[10px] font-semibold text-charcoal-700">
                            {appeal.label}
                          </span>)}
                        {thread.userRole && (<span className="rounded-full bg-admin-surface px-2 py-0.5 text-[10px] font-semibold text-charcoal-700">
                            {labelPeran(thread.userRole)}
                          </span>)}
                        {thread.adminUnreadCount > 0 && (<span className="ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-white tabular-nums" aria-label={`${thread.adminUnreadCount} pesan belum dibaca`}>
                            {thread.adminUnreadCount > 99 ? '99+' : thread.adminUnreadCount}
                          </span>)}
                      </div>
                    </div>
                  </Link>
                </li>);
            })}
          </ul>)}

        {adaLagi && (<div className="px-4 py-3">
            <button type="button" onClick={() => void load(offset + PAGE_LIMIT, true)} disabled={loadMoreRef.current} className="w-full rounded-full border border-admin-line px-4 py-2 text-xs font-semibold text-charcoal-700 transition-colors hover:bg-admin-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50">
              Muat {Math.min(PAGE_LIMIT, total - tampil)} percakapan lagi
            </button>
          </div>)}
      </div>

      <p className="shrink-0 border-t border-admin-line px-4 py-2 text-[11px] text-sage-500">
        {total} percakapan · menampilkan {threads.length}
      </p>
    </section>);
}
