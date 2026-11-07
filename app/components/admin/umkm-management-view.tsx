'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Check, Eye, Loader2, RefreshCw, RotateCcw, SearchX, Store, } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { AdminPageHeader, ADMIN_PAGE_WRAPPER } from './admin-page-header';
import { AdminEmptyState, AdminErrorState, AdminForbiddenState, AdminLoadingState, } from './admin-state';
import { AdminPagination, AdminSearchInput, AdminSelect, AdminToolbar, } from './admin-controls';
import { AdminTableCard, AdminTableHead, AdminTd, AdminTdActions, AdminTh, AdminTr, } from './admin-table';
import { formatTanggal } from './admin-format';
import { AdminUmkmApiError, fetchAdminUmkm, type AdminUmkmDeletedFilter, type AdminUmkmItem, type AdminUmkmVerificationFilter, } from '@/lib/admin-umkm';
import { refreshAdminSessionSafe } from '@/lib/admin-auth';
import { useAdminExport } from '@/hooks/use-admin-export';
import { AdminExportButton, AdminExportNotice } from './admin-export-controls';
const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 400;
const REFRESH_NOTE_MS = 4000;
const VERIFICATION_OPTIONS: {
    value: string;
    label: string;
}[] = [
    { value: '', label: 'Semua status verifikasi' },
    { value: 'unverified', label: 'Belum terverifikasi' },
    { value: 'verified', label: 'Terverifikasi' },
];
const DELETED_FILTER_OPTIONS: {
    value: string;
    label: string;
}[] = [
    { value: 'exclude', label: 'Sembunyikan yang dihapus' },
    { value: 'include', label: 'Tampilkan yang dihapus' },
];
function kota(item: AdminUmkmItem): string {
    return item.city?.trim() || '';
}
function pemilik(item: AdminUmkmItem): string {
    return (item.owner?.full_name?.trim() || item.owner?.email?.trim() || 'Pemilik tidak diketahui');
}
export function UmkmManagementView() {
    const router = useRouter();
    const [items, setItems] = useState<AdminUmkmItem[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [verification, setVerification] = useState<'' | AdminUmkmVerificationFilter>('');
    const [deletedFilter, setDeletedFilter] = useState<AdminUmkmDeletedFilter>('exclude');
    const [refreshing, setRefreshing] = useState(false);
    const [refreshNote, setRefreshNote] = useState<string | null>(null);
    const sudahPernahMemuat = useRef(false);
    type LoadOutcome = 'ok' | 'error' | 'forbidden' | 'unauthorized';
    const load = useCallback(async (nextOffset: number, nextSearch: string, nextVerification: '' | AdminUmkmVerificationFilter, nextDeleted: AdminUmkmDeletedFilter): Promise<LoadOutcome> => {
        setErrorMsg('');
        if (sudahPernahMemuat.current)
            setRefreshing(true);
        else
            setStatus('loading');
        const terapkan = (result: Awaited<ReturnType<typeof fetchAdminUmkm>>) => {
            setItems(result.umkm);
            setTotal(result.total);
            setOffset(result.offset);
            sudahPernahMemuat.current = true;
            setStatus('ready');
        };
        const gagal = (message: string): LoadOutcome => {
            setErrorMsg(message);
            if (sudahPernahMemuat.current)
                setStatus('ready');
            else
                setStatus('error');
            return 'error';
        };
        const ambil = () => fetchAdminUmkm(PAGE_LIMIT, nextOffset, nextSearch, nextVerification, nextDeleted);
        try {
            try {
                terapkan(await ambil());
                return 'ok';
            }
            catch (err) {
                if (!(err instanceof AdminUmkmApiError && err.status === 401))
                    throw err;
                const refreshed = await refreshAdminSessionSafe();
                if (!refreshed) {
                    router.replace('/auth/login');
                    return 'unauthorized';
                }
                terapkan(await ambil());
                return 'ok';
            }
        }
        catch (err) {
            const errStatus = (err as {
                status?: number;
            })?.status ?? 0;
            if (errStatus === 503) {
                return gagal('Tidak dapat menghubungi server data. Periksa koneksi lalu coba lagi.');
            }
            if (err instanceof AdminUmkmApiError && err.status === 403) {
                setStatus('forbidden');
                return 'forbidden';
            }
            if (err instanceof AdminUmkmApiError && err.status === 401) {
                router.replace('/auth/login');
                return 'unauthorized';
            }
            return gagal(err instanceof Error ? err.message : 'Gagal memuat daftar UMKM.');
        }
        finally {
            setRefreshing(false);
        }
    }, [router]);
    useEffect(() => {
        void load(0, search, verification, deletedFilter);
// eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, verification, deletedFilter]);
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch((prev) => (prev === searchInput.trim() ? prev : searchInput.trim()));
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchInput]);
    useEffect(() => {
        if (!refreshNote)
            return;
        const timer = setTimeout(() => setRefreshNote(null), REFRESH_NOTE_MS);
        return () => clearTimeout(timer);
    }, [refreshNote]);
    const hasFilter = search !== '' || verification !== '' || deletedFilter !== 'exclude';
    const resetFilters = () => {
        setSearchInput('');
        setSearch('');
        setVerification('');
        setDeletedFilter('exclude');
    };
    const handleReload = async () => {
        setRefreshNote(null);
        const outcome = await load(offset, search, verification, deletedFilter);
        if (outcome === 'ok')
            setRefreshNote('Daftar UMKM diperbarui.');
    };
    const page = Math.floor(offset / PAGE_LIMIT) + 1;
    const exportParams = new URLSearchParams();
    if (search.trim())
        exportParams.set('search', search.trim());
    if (verification)
        exportParams.set('verification', verification);
    if (deletedFilter === 'include')
        exportParams.set('deleted', 'include');
    const { exporting, feedback, startExport } = useAdminExport({
        url: `/api/admin/umkm/export?${exportParams.toString()}`,
        noun: 'UMKM',
    });
    return (<div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader title="Manajemen UMKM" description="Daftar toko UMKM beserta status verifikasi dan langganannya." actions={<>
            <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">
              {total} UMKM
            </Badge>
            <AdminExportButton onClick={startExport} busy={exporting} disabled={status === 'loading' || status === 'forbidden' || refreshing} noun="UMKM"/>
            <Button type="button" variant="outline" size="sm" onClick={() => void handleReload()} disabled={status === 'loading' || refreshing}>
              <RefreshCw aria-hidden className="h-3.5 w-3.5"/>
              Muat ulang
            </Button>
          </>}/>

      {feedback && <AdminExportNotice feedback={feedback}/>}

      <AdminToolbar>
        <AdminSearchInput value={searchInput} onChange={setSearchInput} label="Cari UMKM" labelVisible placeholder="Cari nama toko atau kota…"/>
        <AdminSelect value={verification} onChange={(value) => setVerification(value as '' | AdminUmkmVerificationFilter)} label="Status verifikasi" options={VERIFICATION_OPTIONS}/>
        <AdminSelect value={deletedFilter} onChange={(value) => setDeletedFilter(value as AdminUmkmDeletedFilter)} label="Toko dihapus" options={DELETED_FILTER_OPTIONS}/>
        {hasFilter && (<Button type="button" variant="outline" onClick={resetFilters} className="self-start sm:self-end">
            <RotateCcw aria-hidden className="h-4 w-4"/>
            Atur ulang filter
          </Button>)}
      </AdminToolbar>

      {refreshNote && (<p role="status" className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-success">
          <Check aria-hidden className="h-4 w-4 shrink-0"/>
          {refreshNote}
        </p>)}

      {status === 'loading' && <AdminLoadingState label="Memuat daftar UMKM"/>}

      {status === 'forbidden' && (<AdminForbiddenState message="Akun kamu tidak memiliki hak mengelola UMKM."/>)}

      {status === 'error' && (<AdminErrorState title="Gagal memuat UMKM" message={errorMsg} onRetry={() => void load(offset, search, verification, deletedFilter)}/>)}

      {status === 'ready' && items.length === 0 && (<AdminEmptyState icon={hasFilter ? (<SearchX aria-hidden className="h-10 w-10 text-primary"/>) : (<Store aria-hidden className="h-10 w-10 text-primary"/>)} title={hasFilter ? 'UMKM tidak ditemukan' : 'Belum ada UMKM'} description={hasFilter
                ? 'Tidak ada toko yang cocok dengan pencarian atau status verifikasi yang dipilih.'
                : 'Toko UMKM yang terdaftar akan muncul di sini.'} action={hasFilter ? (<Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                <RotateCcw aria-hidden className="h-4 w-4"/>
                Atur ulang filter
              </Button>) : undefined}/>)}

      {status === 'ready' && items.length > 0 && (<>
          {errorMsg && (<div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-destructive/25 bg-destructive/[0.06] px-3 py-2 text-sm text-charcoal-900">
              <span className="min-w-0">{errorMsg}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void load(offset, search, verification, deletedFilter)}>
                Coba lagi
              </Button>
            </div>)}

          {refreshing && (<p role="status" className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-sage-500">
              <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"/>
              Memperbarui daftar…
            </p>)}

          <div aria-busy={refreshing} className={cn('transition-opacity', refreshing && 'pointer-events-none opacity-60')}>
            <AdminTableCard label="Daftar UMKM" minWidth={860} className="hidden md:block">
              <AdminTableHead>
                <AdminTh>Toko</AdminTh>
                <AdminTh>Pemilik</AdminTh>
                <AdminTh>Paket</AdminTh>
                <AdminTh className="text-right">Produk</AdminTh>
                <AdminTh>Status</AdminTh>
                <AdminTh>Bergabung</AdminTh>
                <AdminTh className="text-right">Aksi</AdminTh>
              </AdminTableHead>
              <tbody>
                {items.map((item) => (<AdminTr key={item.id}>
                    <AdminTd className="max-w-[260px]">
                      <div className="flex items-start gap-4">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[var(--radius)] border border-border bg-sage-100/60">
                          <SmartImage src={item.logo_url ?? ''} alt="" sizes="40px"/>
                        </div>
                        <div className="min-w-0">
                          <Link href={`/dashboard/admin/umkm/${item.id}`} className="block break-words text-[13px] font-semibold leading-snug text-charcoal-900 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">
                            {item.business_name}
                          </Link>
                          {kota(item) && (<p className="mt-0.5 break-words text-[11px] leading-snug text-sage-500">
                              {kota(item)}
                              {item.category ? ` · ${item.category}` : ''}
                            </p>)}
                        </div>
                      </div>
                    </AdminTd>

                    <AdminTd className="max-w-[190px]">
                      
                      <span className="block truncate text-[13px] leading-snug text-charcoal-900" title={pemilik(item)}>
                        {pemilik(item)}
                      </span>
                      
                      {item.owner?.email && item.owner.email !== pemilik(item) && (<span className="mt-0.5 block truncate text-[11px] leading-snug text-sage-500" title={item.owner.email}>
                          {item.owner.email}
                        </span>)}
                    </AdminTd>

                    <AdminTd className="max-w-[150px]">
                      {item.subscription?.plan?.name ? (<span className="block break-words text-[13px] leading-snug text-charcoal-900">
                          {item.subscription.plan.name}
                        </span>) : (<span className="text-[13px] text-sage-500">Belum ada paket</span>)}
                      {item.subscription?.status && (<span className="mt-0.5 block text-[11px] leading-snug text-sage-500">
                          {item.subscription.status}
                        </span>)}
                    </AdminTd>

                    <AdminTd className="whitespace-nowrap text-right text-[13px] font-medium tabular-nums text-charcoal-900">
                      {item.product_count}
                    </AdminTd>

                    <AdminTd>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant={item.is_verified ? 'success' : 'warning'}>
                          {item.is_verified ? (<BadgeCheck aria-hidden className="h-3 w-3"/>) : null}
                          {item.is_verified ? 'Terverifikasi' : 'Belum verifikasi'}
                        </Badge>
                        {!item.is_active && <Badge variant="destructive">Nonaktif</Badge>}
                        {item.deleted_at && <Badge variant="destructive">Dihapus</Badge>}
                        {item.is_open !== null && (<Badge variant="secondary">{item.is_open ? 'Buka' : 'Tutup'}</Badge>)}
                      </div>
                    </AdminTd>

                    <AdminTd className="whitespace-nowrap text-xs text-sage-500">
                      {formatTanggal(item.created_at)}
                    </AdminTd>

                    <AdminTdActions>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/admin/umkm/${item.id}`}>
                          <Eye aria-hidden className="h-3.5 w-3.5"/>
                          Detail
                        </Link>
                      </Button>
                    </AdminTdActions>
                  </AdminTr>))}
              </tbody>
            </AdminTableCard>

            
            <div className="space-y-3 md:hidden">
              {items.map((item) => (<Card key={`umkm-card-${item.id}`}>
                  <CardContent className="px-4 py-4">
                    <div className="flex items-start gap-4">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radius)] border border-border bg-sage-100/60">
                        <SmartImage src={item.logo_url ?? ''} alt="" sizes="56px"/>
                      </div>
                      <div className="min-w-0 flex-1">
                        
                        <p className="break-words text-sm font-semibold leading-snug text-charcoal-900">
                          {item.business_name}
                        </p>
                        <p className="mt-0.5 break-words text-xs text-sage-500">
                          {[kota(item), item.category].filter(Boolean).join(' · ') ||
                    'Kota belum tersedia'}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge variant={item.is_verified ? 'success' : 'warning'}>
                            {item.is_verified ? 'Terverifikasi' : 'Belum verifikasi'}
                          </Badge>
                          {!item.is_active && <Badge variant="destructive">Nonaktif</Badge>}
                          {item.deleted_at && <Badge variant="destructive">Dihapus</Badge>}
                          {item.is_open !== null && (<Badge variant="secondary">
                              {item.is_open ? 'Buka' : 'Tutup'}
                            </Badge>)}
                        </div>
                      </div>
                    </div>

                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border/70 pt-2.5 text-xs">
                      <div className="min-w-0">
                        <dt className="text-sage-500">Pemilik</dt>
                        <dd className="truncate font-medium text-charcoal-900" title={pemilik(item)}>
                          {pemilik(item)}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-sage-500">Paket</dt>
                        <dd className="truncate font-medium text-charcoal-900">
                          {item.subscription?.plan?.name ?? 'Belum ada'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sage-500">Produk</dt>
                        <dd className="font-medium tabular-nums text-charcoal-900">
                          {item.product_count}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sage-500">Bergabung</dt>
                        <dd className="font-medium text-charcoal-900">
                          {formatTanggal(item.created_at)}
                        </dd>
                      </div>
                    </dl>

                    <Button asChild variant="outline" size="sm" className="mt-3 w-full">
                      <Link href={`/dashboard/admin/umkm/${item.id}`}>
                        <Eye aria-hidden className="h-3.5 w-3.5"/>
                        Lihat detail toko
                      </Link>
                    </Button>
                  </CardContent>
                </Card>))}
            </div>
          </div>

          <AdminPagination total={total} page={page} pageSize={PAGE_LIMIT} noun="UMKM" busy={refreshing} onPageChange={(next) => void load((next - 1) * PAGE_LIMIT, search, verification, deletedFilter)}/>
        </>)}
    </div>);
}
