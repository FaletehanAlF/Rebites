'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import { AdminPageHeader, ADMIN_PAGE_WRAPPER, } from './admin-page-header';
import { AdminEmptyState, AdminErrorState, AdminForbiddenState, AdminLoadingState, } from './admin-state';
import { AdminPagination, AdminSearchInput, AdminSelect, AdminToolbar, } from './admin-controls';
import { AdminTableCard, AdminTableHead, AdminTd, AdminTh, AdminTr, } from './admin-table';
import { formatTanggal, formatRupiah, prettifyKode } from './admin-format';
import { AdminSubscriptionsApiError, effectiveLabel, fetchAdminSubscriptions, rawStatusLabel, type AdminSubscription, type AdminSubscriptionRawStatus, } from '@/lib/admin-subscriptions';
import { redirectIfSessionExpired } from './admin-session';
const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 400;
const STATUS_OPTIONS: {
    value: string;
    label: string;
}[] = [
    { value: '', label: 'Semua status' },
    { value: 'active', label: 'Aktif (DB)' },
    { value: 'pending', label: 'Menunggu pembayaran' },
    { value: 'expired', label: 'Kedaluwarsa' },
    { value: 'cancelled', label: 'Dibatalkan' },
    { value: 'trial', label: 'Uji coba' },
];
const PLAN_OPTIONS: {
    value: string;
    label: string;
}[] = [
    { value: '', label: 'Semua paket' },
    { value: 'basic', label: 'Basic' },
    { value: 'standar', label: 'Standar' },
    { value: 'premium', label: 'Max' },
];
function billingLabel(billing: string | null | undefined): string {
    if (billing === 'yearly')
        return 'Tahunan';
    if (billing === 'monthly')
        return 'Bulanan';
    return billing?.trim() ? String(billing) : '-';
}
function effectiveBadgeVariant(effective: string | null | undefined): 'success' | 'warning' | 'secondary' {
    const e = (effective ?? '').trim().toLowerCase();
    if (e === 'active')
        return 'success';
    if (e === 'lapsed' || e === 'pending')
        return 'warning';
    return 'secondary';
}
export function SubscriptionsManagementView() {
    const router = useRouter();
    const [items, setItems] = useState<AdminSubscription[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'' | AdminSubscriptionRawStatus>('');
    const [planFilter, setPlanFilter] = useState('');
    const requestIdRef = useRef(0);
    const load = useCallback(async (nextOffset: number, nextSearch: string, nextStatus: '' | AdminSubscriptionRawStatus, nextPlan: string) => {
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        setStatus('loading');
        setErrorMsg('');
        try {
            const result = await fetchAdminSubscriptions(PAGE_LIMIT, nextOffset, nextSearch, nextStatus, nextPlan);
            if (requestId !== requestIdRef.current)
                return;
            setItems(result.items);
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
            if (err instanceof AdminSubscriptionsApiError && err.status === 403) {
                setStatus('forbidden');
                return;
            }
            setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat daftar langganan.');
            setStatus('error');
        }
    }, [router]);
    useEffect(() => {
        load(0, search, statusFilter, planFilter);
// eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, statusFilter, planFilter]);
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch((prev) => (prev === searchInput.trim() ? prev : searchInput.trim()));
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchInput]);
    const page = Math.floor(offset / PAGE_LIMIT) + 1;
    const hasActiveFilter = search !== '' || statusFilter !== '' || planFilter !== '';
    const resetFilters = () => {
        setSearchInput('');
        setSearch('');
        setStatusFilter('');
        setPlanFilter('');
    };
    return (<div className={ADMIN_PAGE_WRAPPER}>

      <AdminPageHeader title="Manajemen Langganan" description="Langganan UMKM (hanya-baca)." actions={<>

            <Badge variant="secondary" className="px-3 py-1 text-xs font-semibold">

              {total} langganan

            </Badge>

            <Button type="button" variant="outline" size="sm" onClick={() => load(offset, search, statusFilter, planFilter)} disabled={status === 'loading'}>

              <RefreshCw aria-hidden className="h-3.5 w-3.5"/>

              Muat ulang

            </Button>

          </>}/>



      <AdminToolbar>

        <AdminSearchInput value={searchInput} onChange={setSearchInput} label="Cari langganan" placeholder="Cari toko, slug, atau ID invoice…" className="sm:max-w-md"/>

        <AdminSelect value={statusFilter} onChange={(value) => setStatusFilter(value as '' | AdminSubscriptionRawStatus)} label="Status langganan" options={STATUS_OPTIONS}/>

        <AdminSelect value={planFilter} onChange={setPlanFilter} label="Paket" options={PLAN_OPTIONS}/>

        <Button type="button" variant="outline" size="sm" onClick={resetFilters} disabled={!hasActiveFilter} className="self-start sm:self-end">

          <RotateCcw aria-hidden className="h-3.5 w-3.5"/>

          Reset filter

        </Button>

      </AdminToolbar>



      {status === 'loading' && <AdminLoadingState label="Memuat daftar langganan"/>}



      {status === 'forbidden' && (<AdminForbiddenState message="Halaman ini hanya untuk admin. Akun kamu tidak memiliki hak memantau langganan."/>)}



      {status === 'error' && (<AdminErrorState title="Gagal memuat langganan" message={errorMsg} onRetry={() => load(offset, search, statusFilter, planFilter)}/>)}



      {status === 'ready' && items.length === 0 && (<AdminEmptyState icon={<CreditCard aria-hidden className="h-10 w-10 text-primary"/>} title={search || statusFilter || planFilter
                ? 'Langganan tidak ditemukan'
                : 'Belum ada langganan'} description={search || statusFilter || planFilter
                ? 'Tidak ada langganan yang cocok dengan filter saat ini.'
                : 'Langganan UMKM yang tercatat akan muncul di sini.'}/>)}



      {status === 'ready' && items.length > 0 && (<>

          <AdminTableCard label="Daftar langganan" minWidth={1080} className="hidden md:block">

            <AdminTableHead>

              <AdminTh>Toko</AdminTh>

              <AdminTh>Pemilik</AdminTh>

              <AdminTh>Paket</AdminTh>

              <AdminTh>Billing</AdminTh>

              <AdminTh>Status</AdminTh>

              <AdminTh className="text-right">Harga</AdminTh>

              <AdminTh>Periode berakhir</AdminTh>

              <AdminTh>Invoice</AdminTh>

              <AdminTh>Dibuat</AdminTh>

            </AdminTableHead>

            <tbody>

              {items.map((item) => (<AdminTr key={item.id}>

                  <AdminTd className="max-w-[200px]">

                    <span className="block truncate font-semibold text-charcoal-900" title={item.umkm?.business_name ?? undefined}>

                      {item.umkm?.business_name ?? '-'}

                    </span>

                    <span className="mt-0.5 block truncate text-xs text-sage-500" title={item.umkm?.slug ?? undefined}>

                      {item.umkm?.slug ?? '-'}

                    </span>

                  </AdminTd>

                  <AdminTd className="max-w-[200px]">

                    <span className="block truncate font-medium text-charcoal-900" title={item.owner?.full_name?.trim() || undefined}>

                      {item.owner?.full_name?.trim() || '-'}

                    </span>

                    <span className="mt-0.5 block truncate text-xs text-sage-500" title={item.owner?.email ?? undefined}>

                      {item.owner?.email ?? '-'}

                    </span>

                  </AdminTd>

                  <AdminTd className="whitespace-nowrap text-charcoal-900">

                    {item.plan?.name ?? '-'}

                  </AdminTd>

                  <AdminTd className="whitespace-nowrap text-charcoal-900">

                    {billingLabel(item.billing)}

                  </AdminTd>

                  <AdminTd className="min-w-[190px]">

                    <Badge variant={effectiveBadgeVariant(item.effective)}>

                      {effectiveLabel(item.effective)}

                    </Badge>

                    <span className="mt-1 block text-xs text-sage-500">

                      DB: {rawStatusLabel(item.status)}

                    </span>

                    {item.status === 'active' && item.effective === 'lapsed' && (<span className="mt-0.5 block text-xs font-medium text-sage-500">

                        Efektif: Periode habis

                      </span>)}

                    {item.status === 'active' && item.effective === 'active' && (<span className="mt-0.5 block text-xs font-medium text-sage-500">

                        Efektif: Aktif

                      </span>)}

                  </AdminTd>

                  <AdminTd className="whitespace-nowrap text-right font-semibold tabular-nums text-charcoal-900">

                    {formatRupiah(item.price_paid)}

                  </AdminTd>

                  <AdminTd className="whitespace-nowrap text-xs text-sage-500">

                    {formatTanggal(item.current_period_end)}

                  </AdminTd>

                  <AdminTd className="max-w-[200px]">

                    <span className="block truncate font-mono text-xs text-charcoal-900" title={item.xendit_invoice_id ?? undefined}>

                      {item.xendit_invoice_id ?? '-'}

                    </span>

                    {item.xendit_status && (<span className="mt-0.5 block text-xs text-sage-500">

                        {prettifyKode(item.xendit_status)}

                      </span>)}

                  </AdminTd>

                  <AdminTd className="whitespace-nowrap text-xs text-sage-500">

                    {formatTanggal(item.created_at)}

                  </AdminTd>

                </AdminTr>))}

            </tbody>

          </AdminTableCard>



          <div className="space-y-3 md:hidden">

            {items.map((item) => (<Card key={`langganan-card-${item.id}`}>

                <CardContent className="px-4 py-4">

                  <div className="flex flex-wrap items-center gap-2">

                    <Badge variant={effectiveBadgeVariant(item.effective)}>

                      {effectiveLabel(item.effective)}

                    </Badge>

                    <Badge variant="secondary">{item.plan?.name ?? '-'}</Badge>

                  </div>

                  <p className="mt-2 truncate text-sm font-semibold text-charcoal-900" title={item.umkm?.business_name ?? undefined}>

                    {item.umkm?.business_name ?? '-'}

                  </p>

                  <p className="mt-0.5 truncate text-xs text-sage-500" title={item.umkm?.slug ?? undefined}>

                    {item.umkm?.slug ?? '-'}

                  </p>

                  <p className="mt-1.5 truncate text-sm text-charcoal-700" title={item.owner?.full_name?.trim() || undefined}>

                    {item.owner?.full_name?.trim() || '-'}

                  </p>

                  <p className="mt-0.5 truncate text-xs text-sage-500">

                    {billingLabel(item.billing)} · {formatRupiah(item.price_paid)}

                  </p>

                  <p className="mt-1 text-xs text-sage-500">

                    Berakhir {formatTanggal(item.current_period_end)}

                  </p>

                </CardContent>

              </Card>))}

          </div>



          <AdminPagination total={total} page={page} pageSize={PAGE_LIMIT} noun="langganan" onPageChange={(next) => load((next - 1) * PAGE_LIMIT, search, statusFilter, planFilter)}/>

        </>)}

    </div>);
}
