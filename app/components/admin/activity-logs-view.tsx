'use client';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, ChevronDown, RefreshCw } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import { cn } from '@/lib/utils';
import { ActivityLogsApiError, fetchActivityLogs, type ActivityLogItem, } from '@/lib/admin-activity-logs';
import { formatMetadataSafe } from '@/lib/admin-metadata';
import { markActivitySeen } from '@/lib/admin-preferences';
import { useAdminRealtimeActivity } from '@/hooks/use-admin-realtime-activity';
import { useAdminPreferences } from '@/hooks/use-admin-preferences';
import { ProductDetailDrawer } from './product-detail-drawer';
import { AdminPageHeader, ADMIN_PAGE_WRAPPER, } from './admin-page-header';
import { AdminEmptyState, AdminErrorState, AdminForbiddenState, AdminLoadingState, } from './admin-state';
import { AdminDateRange, AdminPagination, AdminSearchInput, AdminSelect, AdminToolbar, } from './admin-controls';
import { AdminTableCard, AdminTableHead, AdminTd, AdminTh, AdminTr, AdminTrDetail, } from './admin-table';
import { formatTanggalWaktu, labelAktivitas, labelPeran, labelTarget, waktuLalu, } from './admin-format';
import { ADMIN_DETAIL_LABEL } from './admin-detail';
import { redirectIfSessionExpired } from './admin-session';
const PAGE_LIMIT = 20;
const AKTIVITAS_OPTIONS: {
    value: string;
    label: string;
}[] = [
    { value: '', label: 'Semua jenis aktivitas' },
    { value: 'login', label: 'Masuk' },
    { value: 'register', label: 'Pendaftaran' },
    { value: 'product_created', label: 'Produk dibuat' },
    { value: 'product_updated', label: 'Produk diubah' },
    { value: 'product_deleted', label: 'Produk dihapus' },
    { value: 'order_created', label: 'Pesanan dibuat' },
    { value: 'order_cancelled', label: 'Pesanan dibatalkan' },
    { value: 'store_updated', label: 'Toko diubah' },
    { value: 'subscription_changed', label: 'Langganan berubah' },
    { value: 'report_received', label: 'Laporan masuk' },
    { value: 'warning_received', label: 'Peringatan diterima' },
    { value: 'store_deactivated', label: 'Toko dinonaktifkan' },
    { value: 'store_activated', label: 'Toko diaktifkan' },
    { value: 'store_activation_requested', label: 'Permintaan aktivasi toko' },
];
const TARGET_OPTIONS: {
    value: string;
    label: string;
}[] = [
    { value: '', label: 'Semua jenis target' },
    { value: 'order', label: 'Pesanan' },
    { value: 'product', label: 'Produk' },
    { value: 'store', label: 'Toko' },
];
function activityBadgeVariant(activityType: string): 'default' | 'secondary' | 'success' | 'warning' | 'destructive' {
    const type = activityType.toLowerCase();
    if (type.includes('login') || type.includes('register'))
        return 'success';
    if (type.includes('logout'))
        return 'secondary';
    if (type.includes('delete') || type.includes('ban') || type.includes('report'))
        return 'destructive';
    if (type.includes('cancel'))
        return 'destructive';
    if (type.includes('deactivat'))
        return 'destructive';
    if (type.includes('activation'))
        return 'warning';
    if (type.includes('update') || type.includes('edit') || type.includes('create'))
        return 'warning';
    return 'default';
}
function orderHrefFor(item: ActivityLogItem): string | null {
    const code = typeof item.metadata.order_code === 'string' ? item.metadata.order_code.trim() : '';
    return code ? `/dashboard/admin/pesanan?kode=${encodeURIComponent(code)}` : '/dashboard/admin/pesanan';
}
function userHrefFor(item: ActivityLogItem): string | null {
    return item.userId ? `/dashboard/admin/pengguna/${encodeURIComponent(item.userId)}` : null;
}
export function ActivityLogsView() {
    const router = useRouter();
    const [items, setItems] = useState<ActivityLogItem[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [activityType, setActivityType] = useState('');
    const [targetType, setTargetType] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [userQuery, setUserQuery] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const requestIdRef = useRef(0);
    const { realtimeActivity } = useAdminPreferences();
    const { newCount, reset: resetRealtime, connection: realtimeConnection, } = useAdminRealtimeActivity(realtimeActivity && status === 'ready');
    const load = useCallback(async (nextOffset: number) => {
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        setStatus('loading');
        setErrorMsg('');
        try {
            const result = await fetchActivityLogs(PAGE_LIMIT, nextOffset, {
                activityType: activityType || undefined,
                targetType: targetType || undefined,
                from: from || undefined,
                to: to || undefined,
            });
            if (requestId !== requestIdRef.current)
                return;
            setItems(result.logs);
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
            if (err instanceof ActivityLogsApiError && err.status === 403) {
                setStatus('forbidden');
                return;
            }
            setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat log aktivitas.');
            setStatus('error');
        }
    }, [router, activityType, targetType, from, to]);
    useEffect(() => {
        load(0);
    }, [load]);
    useEffect(() => {
        markActivitySeen();
    }, []);
    const toggleExpanded = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };
    const onRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement | HTMLButtonElement>, id: string) => {
        if (event.target !== event.currentTarget)
            return;
        if (event.key !== 'Enter' && event.key !== ' ')
            return;
        event.preventDefault();
        toggleExpanded(id);
    };
    const visible = userQuery.trim()
        ? items.filter((item) => {
            const needle = userQuery.toLowerCase();
            return (item.userName.toLowerCase().includes(needle) ||
                (item.userEmail ?? '').toLowerCase().includes(needle));
        })
        : items;
    const hasServerFilter = activityType !== '' || targetType !== '' || from !== '' || to !== '';
    return (<div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader title="Monitoring Aktivitas" description="Pantau aktivitas terbaru pengguna dan UMKM di platform." actions={<>
            <Badge variant="secondary" className="px-3 py-1.5 text-xs font-bold">
              {total} aktivitas
            </Badge>
            {realtimeActivity && realtimeConnection === 'connecting' && (<Badge variant="secondary" className="px-3 py-1.5 text-xs font-bold">
                Menghubungkan…
              </Badge>)}
            {realtimeActivity && realtimeConnection === 'error' && (<Badge variant="warning" className="px-3 py-1.5 text-xs font-bold">
                Realtime terputus
              </Badge>)}
            <Button type="button" variant="outline" size="sm" onClick={() => {
                resetRealtime();
                load(offset);
            }} disabled={status === 'loading'}>
              <RefreshCw aria-hidden className="mr-1.5 h-3.5 w-3.5"/>
              Muat ulang
            </Button>
          </>}/>

      {newCount > 0 && status === 'ready' && (<button type="button" onClick={() => {
                resetRealtime();
                load(0);
            }} className="mb-4 inline-flex items-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          {newCount} aktivitas baru — muat untuk melihat
        </button>)}

      
      <AdminToolbar>
        <AdminSearchInput value={userQuery} onChange={setUserQuery} label="Cari pengguna" placeholder="Cari pengguna (nama/email pada halaman ini)…" labelVisible className="sm:max-w-sm lg:w-52 lg:min-w-[7rem] lg:shrink"/>
        <AdminSelect value={activityType} onChange={(value) => setActivityType(value)} label="Jenis aktivitas" options={AKTIVITAS_OPTIONS}/>
        <AdminSelect value={targetType} onChange={setTargetType} label="Jenis target" options={TARGET_OPTIONS}/>
        <AdminDateRange from={from} to={to} onFromChange={setFrom} onToChange={setTo}/>
      </AdminToolbar>

      {status === 'loading' && <AdminLoadingState label="Memuat log aktivitas"/>}

      {status === 'forbidden' && (<AdminForbiddenState message="Halaman ini hanya untuk admin. Akun kamu tidak memiliki hak melihat log aktivitas."/>)}

      {status === 'error' && (<AdminErrorState title="Gagal memuat aktivitas" message={errorMsg} onRetry={() => load(offset)}/>)}

      {status === 'ready' && items.length === 0 && (<AdminEmptyState icon={<Activity aria-hidden className="h-10 w-10 text-primary"/>} title={hasServerFilter ? 'Tidak ada aktivitas yang cocok' : 'Belum ada aktivitas'} description={hasServerFilter
                ? 'Tidak ada aktivitas yang cocok dengan filter saat ini. Ubah atau atur ulang filter.'
                : 'Aktivitas pengguna dan UMKM akan muncul di sini.'} action={hasServerFilter ? (<Button type="button" variant="outline" size="sm" onClick={() => {
                    setActivityType('');
                    setTargetType('');
                    setFrom('');
                    setTo('');
                }}>
                Atur ulang filter
              </Button>) : undefined}/>)}

      {status === 'ready' && items.length > 0 && visible.length === 0 && (<AdminEmptyState icon={<Activity aria-hidden className="h-10 w-10 text-primary"/>} title="Tidak ada aktivitas yang cocok di halaman ini" description="Pencarian pengguna hanya menyaring baris pada halaman yang sedang ditampilkan. Atur ulang pencarian atau pindah halaman." action={<Button type="button" variant="outline" size="sm" onClick={() => setUserQuery('')}>
              Atur ulang pencarian
            </Button>}/>)}

      {status === 'ready' && visible.length > 0 && (<>
          <AdminTableCard label="Log aktivitas" minWidth={820} className="hidden sm:block">
            <AdminTableHead>
              <AdminTh>Pengguna</AdminTh>
              <AdminTh>Aktivitas</AdminTh>
              <AdminTh>Deskripsi</AdminTh>
              <AdminTh>Target</AdminTh>
              <AdminTh>Waktu</AdminTh>
              <AdminTh className="w-12 text-right">
                <span className="sr-only">Detail</span>
              </AdminTh>
            </AdminTableHead>
            <tbody>
              {visible.map((item) => (<Fragment key={item.id}>
                  <AdminTr className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40" onClick={() => toggleExpanded(item.id)} tabIndex={0} aria-expanded={expandedId === item.id} aria-controls={expandedId === item.id ? `activity-detail-${item.id}` : undefined} onKeyDown={(event) => onRowKeyDown(event, item.id)}>
                    <AdminTd className="max-w-[200px]">
                      <p className="truncate font-semibold text-charcoal-900" title={item.userName}>
                        {item.userName}
                      </p>
                      {item.userEmail && (<p className="truncate text-xs text-sage-500" title={item.userEmail}>
                          {item.userEmail}
                        </p>)}
                      {item.userRole ? (<span className="mt-0.5 inline-flex rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-sage-500">
                          {labelPeran(item.userRole)}
                        </span>) : (<span className="mt-0.5 inline-flex rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-sage-500">
                          Sistem / Backend
                        </span>)}
                      {userHrefFor(item) && (<Link href={userHrefFor(item) as string} className="mt-1 block text-xs font-bold text-primary underline underline-offset-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                          Buka akun
                        </Link>)}
                    </AdminTd>
                    <AdminTd className="whitespace-nowrap">
                      <Badge variant={activityBadgeVariant(item.activityType)}>
                        {labelAktivitas(item.activityType)}
                      </Badge>
                    </AdminTd>
                    <AdminTd className="max-w-[320px]">
                      <p className="line-clamp-2 break-words" title={item.description || undefined}>
                        {item.description || '-'}
                      </p>
                    </AdminTd>
                    <AdminTd className="max-w-[180px]">
                      {item.targetType ? (<span>
                          <span className="font-semibold">{labelTarget(item.targetType)}</span>
                          {item.targetId && (<span className="block truncate text-xs text-sage-500" title={item.targetId}>
                              {item.targetId}
                            </span>)}
                          {item.targetType === 'product' && item.targetId && (<button type="button" onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProductId(item.targetId);
                        }} className="mt-1 text-xs font-bold text-primary underline underline-offset-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                              Buka detail
                            </button>)}
                          {(item.targetType === 'order' || item.targetType === 'orders') && (<Link href={orderHrefFor(item) as string} onClick={(e) => e.stopPropagation()} className="mt-1 block text-xs font-bold text-primary underline underline-offset-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                              Buka pesanan
                            </Link>)}
                          {(item.targetType === 'store' ||
                        item.targetType === 'stores' ||
                        item.targetType === 'umkm') &&
                        item.targetId && (<Link href={`/dashboard/admin/umkm/${encodeURIComponent(item.targetId)}`} onClick={(e) => e.stopPropagation()} className="mt-1 block text-xs font-bold text-primary underline underline-offset-2 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                                Buka toko
                              </Link>)}
                        </span>) : ('-')}
                    </AdminTd>
                    <AdminTd className="whitespace-nowrap text-xs text-sage-500">
                      {formatTanggalWaktu(item.createdAt)}
                      <span className="mt-0.5 block text-xs text-sage-500">
                        {waktuLalu(item.createdAt)}
                      </span>
                    </AdminTd>
                    <AdminTd className="text-right" aria-hidden>
                      <ChevronDown className={cn('ml-auto h-4 w-4 text-sage-500 transition-transform', expandedId === item.id && 'rotate-180')}/>
                    </AdminTd>
                  </AdminTr>
                  {expandedId === item.id && (<AdminTrDetail colSpan={6} id={`activity-detail-${item.id}`}>
                      <pre className="max-h-64 overflow-auto rounded-[var(--radius)] bg-sage-100/40 p-3 text-xs text-charcoal-700">
                        {formatMetadataSafe(item.metadata)}
                      </pre>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.targetType === 'product' && item.targetId && (<Button type="button" size="sm" variant="outline" onClick={() => setSelectedProductId(item.targetId)}>
                            Buka detail produk
                          </Button>)}
                        {(item.targetType === 'order' || item.targetType === 'orders') && (<Button type="button" size="sm" variant="outline" asChild>
                            <Link href={orderHrefFor(item) as string}>Buka detail pesanan</Link>
                          </Button>)}
                        {userHrefFor(item) && (<Button type="button" size="sm" variant="outline" asChild>
                            <Link href={userHrefFor(item) as string}>Buka akun pelaku</Link>
                          </Button>)}
                      </div>
                    </AdminTrDetail>)}
                </Fragment>))}
            </tbody>
          </AdminTableCard>

          <div className="space-y-3 sm:hidden">
            {visible.map((item) => (<Card key={item.id}>
                <CardContent className="px-4 py-4">
                  <button type="button" onClick={() => toggleExpanded(item.id)} aria-label={`Buka detail aktivitas ${item.userName} — ${labelAktivitas(item.activityType)}`} aria-expanded={expandedId === item.id} aria-controls={expandedId === item.id
                    ? `activity-mobile-detail-${item.id}`
                    : undefined} className="block w-full rounded-[var(--radius)] text-left transition-colors hover:bg-sage-100/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate font-semibold text-charcoal-900" title={item.userName}>
                        {item.userName}
                      </p>
                      <Badge variant={activityBadgeVariant(item.activityType)} className="shrink-0">
                        {labelAktivitas(item.activityType)}
                      </Badge>
                    </div>
                    {item.userEmail && (<p className="truncate text-xs text-sage-500" title={item.userEmail}>
                        {item.userEmail}
                      </p>)}
                    <span className="mt-0.5 inline-flex rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-sage-500">
                      {item.userRole ? labelPeran(item.userRole) : 'Sistem / Backend'}
                    </span>
                    <p className="mt-1 line-clamp-3 break-words text-sm text-charcoal-700" title={item.description || undefined}>
                      {item.description || '-'}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-sage-500">
                      <span className="min-w-0 flex-1 truncate" title={item.targetType
                    ? `${labelTarget(item.targetType)}${item.targetId ? ` · ${item.targetId}` : ''}`
                    : '-'}>
                        {item.targetType
                    ? `${labelTarget(item.targetType)}${item.targetId ? ` · ${item.targetId}` : ''}`
                    : '-'}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span>
                          {formatTanggalWaktu(item.createdAt)}
                          <span className="block text-xs text-sage-500">
                            {waktuLalu(item.createdAt)}
                          </span>
                        </span>
                        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expandedId === item.id && 'rotate-180')}/>
                      </span>
                    </div>
                  </button>
                  {expandedId === item.id && (<div id={`activity-mobile-detail-${item.id}`} className="mt-3 border-t border-border/60 pt-3">
                      <p className={ADMIN_DETAIL_LABEL}>Metadata (aman)</p>
                      <pre className="mt-1.5 max-h-52 overflow-auto rounded-[var(--radius)] bg-sage-100/40 p-3 text-xs text-charcoal-700">
                        {formatMetadataSafe(item.metadata)}
                      </pre>
                    </div>)}
                  {item.targetType === 'product' && item.targetId && (<Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setSelectedProductId(item.targetId)}>
                      Buka detail produk
                    </Button>)}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(item.targetType === 'order' || item.targetType === 'orders') && (<Button type="button" size="sm" variant="outline" asChild>
                        <Link href={orderHrefFor(item) as string}>Buka pesanan</Link>
                      </Button>)}
                    {userHrefFor(item) && (<Button type="button" size="sm" variant="outline" asChild>
                        <Link href={userHrefFor(item) as string}>Buka akun</Link>
                      </Button>)}
                  </div>
                </CardContent>
              </Card>))}
          </div>
        </>)}

      {status === 'ready' && items.length > 0 && (<AdminPagination total={total} page={Math.floor(offset / PAGE_LIMIT) + 1} pageSize={PAGE_LIMIT} noun="aktivitas" onPageChange={(next) => load((next - 1) * PAGE_LIMIT)}/>)}

      <ProductDetailDrawer productId={selectedProductId} onClose={() => setSelectedProductId(null)} onChanged={() => load(offset)}/>
    </div>);
}
