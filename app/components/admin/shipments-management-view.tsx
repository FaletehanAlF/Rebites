'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RefreshCw, Truck } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import { AdminShipmentsApiError, fetchAdminShipments, type AdminShipmentItem, } from '@/lib/admin-shipments';
import { shipmentNeedsAttention, staleToShipAgeLabel, type ShipmentState } from '@/lib/shipment-state';
import { ShipmentStateBadge } from './shipment-state-badge';
import { AdminPageHeader, ADMIN_PAGE_WRAPPER, } from './admin-page-header';
import { AdminEmptyState, AdminErrorState, AdminForbiddenState, AdminLoadingState, } from './admin-state';
import { AdminPagination, AdminSearchInput, AdminSelect, AdminToolbar, } from './admin-controls';
import { AdminTableCard, AdminTableHead, AdminTd, AdminTdActions, AdminTh, AdminTr, } from './admin-table';
import { formatRupiah, formatTanggalWaktu } from './admin-format';
import { redirectIfSessionExpired } from './admin-session';
import { markShipmentsSeen } from '@/lib/admin-preferences';
import { cn } from '@/lib/utils';
const PAGE_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 400;
const STATE_OPTIONS: {
    value: string;
    label: string;
}[] = [
    { value: '', label: 'Semua kiriman aktif' },
    { value: 'to_ship', label: 'Menunggu dikirim' },
    { value: 'in_transit', label: 'Dalam perjalanan' },
    { value: 'late', label: 'Terlambat' },
    { value: 'done', label: 'Selesai' },
];
const STATE_VALUES: readonly string[] = STATE_OPTIONS.map((option) => option.value).filter((value) => value !== '');
function StaleToShipBadge({ createdAt, state, }: {
    createdAt: string | null;
    state: ShipmentState;
}) {
    const label = staleToShipAgeLabel(createdAt, state);
    if (!label)
        return null;
    return <Badge variant="destructive">{label}</Badge>;
}
function RingkasanCard({ label, value, tone, }: {
    label: string;
    value: number;
    tone: 'warning' | 'default' | 'destructive' | 'success';
}) {
    return (<Card className={tone === 'destructive' && value > 0 ? 'border-destructive/40' : undefined}>
      <CardContent className="px-4 py-4">
        <p className="text-xs font-medium text-sage-500">{label}</p>
        <p className={cn('mt-1 text-2xl font-semibold tabular-nums tracking-tight', tone === 'destructive' && value > 0 ? 'text-destructive' : 'text-charcoal-900')}>
          {value.toLocaleString('id-ID')}
        </p>
      </CardContent>
    </Card>);
}
export function ShipmentsManagementView() {
    const router = useRouter();
    const [items, setItems] = useState<AdminShipmentItem[]>([]);
    const [summary, setSummary] = useState({
        toShip: 0,
        inTransit: 0,
        late: 0,
        done: 0,
        stale: 0,
    });
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [state, setState] = useState('');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const requestIdRef = useRef(0);
    useEffect(() => {
        try {
            const value = new URLSearchParams(window.location.search).get('state') ?? '';
            if (STATE_VALUES.includes(value))
                setState(value);
        }
        catch {
        }
    }, []);
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [search]);
    const load = useCallback(async (nextOffset: number) => {
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        setStatus('loading');
        setErrorMsg('');
        try {
            const result = await fetchAdminShipments({
                limit: PAGE_LIMIT,
                offset: nextOffset,
                search: debouncedSearch,
                state: (state || '') as '' | ShipmentState,
            });
            if (requestId !== requestIdRef.current)
                return;
            setItems(result.items);
            setTotal(result.total);
            setOffset(result.offset);
            setSummary(result.summary);
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
            if (err instanceof AdminShipmentsApiError && err.status === 403) {
                setStatus('forbidden');
                return;
            }
            setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat daftar pengiriman.');
            setStatus('error');
        }
    }, [router, state, debouncedSearch]);
    useEffect(() => {
        load(0);
    }, [load]);
    useEffect(() => {
        if (status === 'ready')
            markShipmentsSeen();
    }, [status]);
    return (<div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader title="Pengiriman" actions={<Button type="button" variant="outline" size="sm" onClick={() => load(offset)} disabled={status === 'loading'}>
            <RefreshCw aria-hidden className="mr-1.5 h-3.5 w-3.5"/>
            Muat ulang
          </Button>}/>

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <RingkasanCard label="Menunggu dikirim" value={summary.toShip} tone="warning"/>
        <RingkasanCard label="Menunggu > 24 jam" value={summary.stale} tone="destructive"/>
        <RingkasanCard label="Dalam perjalanan" value={summary.inTransit} tone="default"/>
        <RingkasanCard label="Terlambat" value={summary.late} tone="destructive"/>
        <RingkasanCard label="Selesai" value={summary.done} tone="success"/>
      </div>

      <AdminToolbar>
        <AdminSearchInput value={search} onChange={setSearch} label="Cari pengiriman" placeholder="Cari kode pesanan, toko, produk, atau nomor resi…" labelVisible/>
        <AdminSelect value={state} onChange={setState} label="Status kiriman" options={STATE_OPTIONS}/>
      </AdminToolbar>

      {status === 'loading' && <AdminLoadingState label="Memuat daftar pengiriman"/>}

      {status === 'forbidden' && (<AdminForbiddenState message="Halaman ini hanya untuk admin."/>)}

      {status === 'error' && (<AdminErrorState title="Gagal memuat daftar pengiriman" message={errorMsg} onRetry={() => load(offset)}/>)}

      {status === 'ready' && items.length === 0 && (<AdminEmptyState icon={<Truck aria-hidden className="h-10 w-10 text-primary"/>} title="Tidak ada kiriman" description="Tidak ada kiriman yang cocok dengan filter saat ini."/>)}

      {status === 'ready' && items.length > 0 && (<>
          <AdminTableCard label="Daftar pengiriman" minWidth={960} className="hidden sm:block">
            <AdminTableHead>
              <AdminTh>Pesanan</AdminTh>
              <AdminTh>Toko &amp; pembeli</AdminTh>
              <AdminTh>Kurir &amp; resi</AdminTh>
              <AdminTh>Status</AdminTh>
              <AdminTh>Estimasi tiba</AdminTh>
              <AdminTh className="text-right">Aksi</AdminTh>
            </AdminTableHead>
            <tbody>
              {items.map((item) => (<AdminTr key={item.id}>
                  <AdminTd className="max-w-[240px]">
                    <p className="break-words font-mono text-xs font-semibold text-charcoal-900">
                      {item.orderCode ?? '-'}
                    </p>
                    <p className="mt-0.5 break-words text-[11px] leading-snug text-sage-500" title={item.productName ?? undefined}>
                      {item.productName ?? 'Produk tidak diketahui'}
                      {item.quantity != null ? ` · ${item.quantity} item` : ''}
                    </p>
                    <p className="mt-0.5 text-[11px] text-sage-500">
                      {formatTanggalWaktu(item.createdAt)}
                    </p>
                  </AdminTd>
                  <AdminTd className="max-w-[220px]">
                    <p className="break-words text-[13px] font-semibold text-charcoal-900">
                      {item.storeName ?? 'Toko tidak diketahui'}
                    </p>
                    <p className="mt-0.5 break-words text-[11px] text-sage-500">
                      {item.buyerName ? `Pembeli: ${item.buyerName}` : 'Pembeli tidak diketahui'}
                    </p>
                  </AdminTd>
                  <AdminTd className="max-w-[200px]">
                    {item.courierService || item.courierCode ? (<p className="break-words text-[13px] text-charcoal-900">
                        {item.courierService ?? item.courierCode}
                      </p>) : (<p className="text-[13px] text-sage-500">Belum dipilih</p>)}
                    <p className="mt-0.5 break-words text-[11px] font-mono text-sage-500">
                      {item.waybillId ?? (item.shipmentStatus ? `Status: ${item.shipmentStatus}` : 'Resi belum terbit')}
                    </p>
                    {item.shippingRate != null && (<p className="mt-0.5 text-[11px] text-sage-500">
                        Ongkir {formatRupiah(item.shippingRate)}
                      </p>)}
                  </AdminTd>
                  <AdminTd>
                    <div className="flex flex-wrap items-center gap-1">
                      <ShipmentStateBadge state={item.state}/>
                      <StaleToShipBadge createdAt={item.createdAt} state={item.state}/>
                      {shipmentNeedsAttention(item.state) && (<Badge variant="outline">Perlu perhatian</Badge>)}
                    </div>
                    {item.shipmentError && (<p className="mt-1 line-clamp-2 break-words text-[11px] text-destructive" title={item.shipmentError}>
                        {item.shipmentError}
                      </p>)}
                  </AdminTd>
                  <AdminTd className="whitespace-nowrap text-xs text-sage-500">
                    {formatTanggalWaktu(item.estimatedArrivalAt)}
                  </AdminTd>
                  <AdminTdActions>
                    <Button type="button" size="sm" variant="outline" asChild>
                      <Link href={`/dashboard/admin/pengiriman/${item.id}`}>Pantau</Link>
                    </Button>
                  </AdminTdActions>
                </AdminTr>))}
            </tbody>
          </AdminTableCard>

          <div className="space-y-3 sm:hidden">
            {items.map((item) => (<Card key={item.id}>
                <CardContent className="px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words font-mono text-xs font-semibold text-charcoal-900">
                        {item.orderCode ?? '-'}
                      </p>
                      <p className="mt-0.5 break-words text-sm font-semibold text-charcoal-900">
                        {item.storeName ?? 'Toko tidak diketahui'}
                      </p>
                    </div>
                    <ShipmentStateBadge state={item.state}/>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sage-500">
                    <span>{item.courierService ?? item.courierCode ?? 'Kurir belum dipilih'}</span>
                    <span>{item.waybillId ?? 'Resi belum terbit'}</span>
                    <span>Estimasi {formatTanggalWaktu(item.estimatedArrivalAt)}</span>
                  </div>
                  <div className="mt-2 empty:hidden">
                    <StaleToShipBadge createdAt={item.createdAt} state={item.state}/>
                  </div>
                  <Button type="button" size="sm" variant="outline" className="mt-3" asChild>
                    <Link href={`/dashboard/admin/pengiriman/${item.id}`}>Pantau kiriman</Link>
                  </Button>
                </CardContent>
              </Card>))}
          </div>

          <AdminPagination total={total} page={Math.floor(offset / PAGE_LIMIT) + 1} pageSize={PAGE_LIMIT} noun="kiriman" onPageChange={(next) => load((next - 1) * PAGE_LIMIT)}/>
        </>)}
    </div>);
}
