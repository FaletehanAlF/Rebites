'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RefreshCw, Truck } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent } from '@/app/components/ui/card';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { AdminPageHeader, ADMIN_PAGE_WRAPPER, } from './admin-page-header';
import { AdminEmptyState, AdminErrorState, AdminForbiddenState, AdminInlineError, AdminInlineLoading, AdminLoadingState, } from './admin-state';
import { AdminDetailField, AdminDetailGrid, AdminDetailSection } from './admin-detail';
import { ShipmentStateBadge } from './shipment-state-badge';
import { formatRupiah, formatTanggalWaktu } from './admin-format';
import { redirectIfSessionExpired } from './admin-session';
import { AdminShipmentsApiError, fetchAdminShipmentDetail, type AdminShipmentDetail, } from '@/lib/admin-shipments';
import { fetchAdminOrderStatusHistory, orderStatusLabel, paymentStatusLabel, type AdminOrderStatusHistoryItem, } from '@/lib/admin-orders';
import { markShipmentsSeen } from '@/lib/admin-preferences';
import { paymentMethodName } from '@/lib/order-utils';
import { formatPositionAge, type LocationFreshness } from '@/lib/courier-location';
import { buildMapPlan } from '@/lib/delivery-map-plan';
import { useCourierLocation } from '@/hooks/use-courier-location';
const DeliveryMap = dynamic(() => import('@/app/components/order-history/delivery-map'), {
    ssr: false,
    loading: () => (<div className="h-[260px] animate-pulse rounded-[var(--radius)] bg-sage-100/60 sm:h-[320px] lg:h-[380px]"/>),
});
export function formatJarak(km: number | null): string {
    if (km == null)
        return '—';
    return `${km.toLocaleString('id-ID', { maximumFractionDigits: 1 })} km`;
}
function CostRow({ label, value }: {
    label: string;
    value: string;
}) {
    return (<div className="flex items-center justify-between gap-4">
      <dt className="text-charcoal-500">{label}</dt>
      <dd className="shrink-0 font-medium tabular-nums text-charcoal-900">{value}</dd>
    </div>);
}
export interface ShipmentDetailContentProps {
    detail: AdminShipmentDetail;
    history: AdminOrderStatusHistoryItem[];
    historyStatus: 'loading' | 'ready' | 'error';
    historyError: string;
    courierPosition: {
        latitude: number;
        longitude: number;
    } | null;
    courierFreshness: LocationFreshness;
    courierLoading: boolean;
    courierAge: string | null;
    refreshing: boolean;
    onReload: () => void;
}
export function ShipmentDetailContent({ detail, history, historyStatus, historyError, courierPosition, courierFreshness, courierLoading, courierAge, refreshing, onReload, }: ShipmentDetailContentProps) {
    const isDelivering = detail.state === 'in_transit' || detail.state === 'late';
    const isDone = detail.state === 'done';
    const plan = useMemo(() => buildMapPlan({
        hasOrder: true,
        originLatitude: detail.originLatitude,
        originLongitude: detail.originLongitude,
        destinationLatitude: detail.destinationLatitude,
        destinationLongitude: detail.destinationLongitude,
    }), [detail]);
    const liveMessage = !isDelivering
        ? isDone
            ? 'Pengantaran selesai. Peta menampilkan titik perjalanan terakhir.'
            : 'Pelacakan posisi aktif setelah pesanan mulai diantar.'
        : courierLoading && !courierPosition
            ? 'Memuat posisi kurir…'
            : courierFreshness === 'aktif'
                ? `Posisi kurir mengikuti GPS perangkat kurir${courierAge ? ` (${courierAge})` : ''}.`
                : courierFreshness === 'terlambat'
                    ? `Posisi kurir terakhir diterima ${courierAge ?? 'beberapa waktu lalu'}; mungkin sudah tidak akurat.`
                    : 'Kurir belum mengirim posisi untuk pesanan ini.';
    return (<div className={ADMIN_PAGE_WRAPPER}>
      <AdminPageHeader title="Pantau pengiriman" description={`Pesanan ${detail.orderCode ?? '—'} · ${detail.storeName ?? 'Toko tidak diketahui'}. Pantau posisi kurir, produk yang dikirim, rincian pembayaran, dan riwayat statusnya.`} actions={<Button type="button" variant="outline" size="sm" onClick={onReload} disabled={refreshing}>
            <RefreshCw aria-hidden className="mr-1.5 h-3.5 w-3.5"/>
            Muat ulang
          </Button>}/>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ShipmentStateBadge state={detail.state}/>
        <Badge variant="outline">{orderStatusLabel(detail.orderStatus)}</Badge>
        <Badge variant="secondary">{paymentStatusLabel(detail.paymentStatus)}</Badge>
        {detail.orderCode && (<Link href={`/dashboard/admin/pesanan?kode=${encodeURIComponent(detail.orderCode)}`} className="text-xs font-semibold text-primary underline underline-offset-2">
            Buka di halaman Pesanan
          </Link>)}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] lg:items-start">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <h2 className="font-display text-[15px] font-semibold text-charcoal-900">
                    Lacak pengantaran
                  </h2>
                  <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-sage-500">
                    {liveMessage}
                  </p>
                </div>
                {isDelivering && courierFreshness === 'aktif' && (<Badge variant="success">GPS aktif</Badge>)}
                {isDelivering && courierFreshness === 'terlambat' && (<Badge variant="warning">Posisi basi</Badge>)}
              </div>

              <div className="mt-4">
                <DeliveryMap plan={plan} courierPosition={courierPosition} animateRoute={isDelivering} completed={isDone}/>
              </div>

              <AdminDetailGrid columns={3} className="mt-4">
                <AdminDetailField label="Kurir">
                  {detail.courierName ??
            detail.courierService ??
            detail.courierCode ??
            'Belum ditugaskan'}
                </AdminDetailField>
                <AdminDetailField label="Jarak">{formatJarak(detail.distanceKm)}</AdminDetailField>
                <AdminDetailField label="Estimasi tiba">
                  {formatTanggalWaktu(detail.estimatedArrivalAt)}
                </AdminDetailField>
              </AdminDetailGrid>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <AdminDetailSection title={`Riwayat status (${history.length})`} description="Perubahan status yang tercatat sistem, terbaru di bawah.">
                {historyStatus === 'loading' && (<AdminInlineLoading label="Memuat riwayat status"/>)}
                {historyStatus === 'error' && <AdminInlineError message={historyError}/>}
                {historyStatus === 'ready' && history.length === 0 && (<p className="text-sm text-sage-500">Belum ada riwayat status tercatat.</p>)}
                {historyStatus === 'ready' && history.length > 0 && (<ol className="space-y-2">
                    {history.map((entry) => (<li key={entry.id} className="rounded-[var(--radius)] bg-sage-100/40 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Badge variant="secondary">{orderStatusLabel(entry.status)}</Badge>
                          <span className="text-xs tabular-nums text-sage-500">
                            {formatTanggalWaktu(entry.createdAt)}
                          </span>
                        </div>
                        {entry.note && (<p className="mt-1 break-words text-xs text-charcoal-700">
                            {entry.note}
                          </p>)}
                      </li>))}
                  </ol>)}
              </AdminDetailSection>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <h2 className="font-display text-[15px] font-semibold text-charcoal-900">
                Produk yang dipesan
              </h2>
              <div className="mt-3 flex items-center gap-4.5">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[var(--radius)] bg-sage-100/60">
                  <SmartImage src={detail.productImageUrl ?? ''} alt={detail.productName ?? 'Foto produk'} sizes="64px"/>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold text-charcoal-900">
                    {detail.productName ?? 'Produk tidak diketahui'}
                  </p>
                  <p className="mt-0.5 break-words text-xs text-sage-500">
                    {detail.storeName ?? 'Toko tidak diketahui'}
                  </p>
                  <p className="mt-0.5 text-xs text-sage-500">
                    {detail.quantity != null ? `${detail.quantity} item` : 'Jumlah tidak tercatat'}
                    {detail.unitPrice != null
            ? ` · ${formatRupiah(detail.unitPrice)} / item`
            : ''}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-charcoal-900">
                  {formatRupiah(detail.subtotal)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h2 className="font-display text-[15px] font-semibold text-charcoal-900">
                Pembayaran
              </h2>
              <dl className="mt-3 space-y-2.5 text-sm">
                <CostRow label="Subtotal produk" value={formatRupiah(detail.subtotal)}/>
                {detail.discount != null && detail.discount > 0 && (<CostRow label="Diskon" value={`−${formatRupiah(detail.discount)}`}/>)}
                <CostRow label="Biaya layanan" value={formatRupiah(detail.serviceFee)}/>
                <CostRow label="Ongkir" value={formatRupiah(detail.shippingRate)}/>
                <div className="flex items-center justify-between gap-4 border-t border-border/70 pt-3">
                  <dt className="text-sm font-semibold text-charcoal-900">Total dibayar</dt>
                  <dd className="font-display text-lg font-semibold tabular-nums text-primary">
                    {formatRupiah(detail.totalPrice)}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-xs leading-relaxed text-sage-500">
                Metode pembayaran:{' '}
                <span className="font-medium text-charcoal-700">
                  {paymentMethodName(detail.paymentMethodId ?? undefined)}
                </span>{' '}
                · {paymentStatusLabel(detail.paymentStatus)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h2 className="font-display text-[15px] font-semibold text-charcoal-900">
                Pengiriman &amp; alamat
              </h2>
              <AdminDetailGrid className="mt-3">
                <AdminDetailField label="Layanan kurir">
                  {detail.courierService ?? detail.courierCode ?? 'Belum dipilih'}
                </AdminDetailField>
                <AdminDetailField label="Kurir ditugaskan">
                  {detail.courierName ?? 'Belum ditugaskan'}
                  {detail.courierVehicle ? ` · ${detail.courierVehicle}` : ''}
                </AdminDetailField>
                <AdminDetailField label="Nomor resi" mono>
                  {detail.waybillId ?? 'Belum terbit'}
                </AdminDetailField>
                <AdminDetailField label="Status kiriman">
                  {detail.shipmentStatus ?? '—'}
                </AdminDetailField>
                <AdminDetailField label="Mulai diantar">
                  {formatTanggalWaktu(detail.deliveryStartedAt)}
                </AdminDetailField>
                <AdminDetailField label="Selesai">
                  {formatTanggalWaktu(detail.completedAt)}
                </AdminDetailField>
              </AdminDetailGrid>
              {detail.deliveryAddress && (<p className="mt-3 rounded-[var(--radius)] bg-sage-100/40 px-3 py-2 text-sm leading-relaxed text-charcoal-700">
                  Alamat tujuan: {detail.deliveryAddress}
                </p>)}
              {detail.shipmentError && (<div className="mt-3">
                  <AdminInlineError message={`Galat kurir: ${detail.shipmentError}`}/>
                </div>)}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>);
}
const AGE_TICK_MS = 15000;
export function ShipmentDetailView({ id }: {
    id: string;
}) {
    const router = useRouter();
    const [detail, setDetail] = useState<AdminShipmentDetail | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'forbidden' | 'not-found'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [history, setHistory] = useState<AdminOrderStatusHistoryItem[]>([]);
    const [historyStatus, setHistoryStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [historyError, setHistoryError] = useState('');
    const [now, setNow] = useState(() => Date.now());
    const hasDataRef = useRef(false);
    const [reloading, setReloading] = useState(false);
    const [historyToken, setHistoryToken] = useState(0);
    const load = useCallback(async () => {
        const initial = !hasDataRef.current;
        if (initial)
            setStatus('loading');
        else
            setReloading(true);
        setErrorMsg('');
        try {
            const result = await fetchAdminShipmentDetail(id);
            setDetail(result);
            hasDataRef.current = true;
            setStatus('ready');
        }
        catch (err) {
            if (await redirectIfSessionExpired((err as {
                status?: number;
            })?.status ?? 0, router, () => {
                setErrorMsg('Tidak dapat menghubungi server data. Coba lagi.');
                setStatus('error');
            }))
                return;
            if (err instanceof AdminShipmentsApiError && err.status === 403) {
                setStatus('forbidden');
                return;
            }
            if (err instanceof AdminShipmentsApiError && err.status === 404) {
                setStatus('not-found');
                return;
            }
            setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat detail pengiriman.');
            setStatus('error');
        }
        finally {
            setReloading(false);
        }
    }, [id, router]);
    useEffect(() => {
        void load();
    }, [load]);
    useEffect(() => {
        if (!id)
            return;
        let cancelled = false;
        setHistoryStatus('loading');
        setHistoryError('');
        fetchAdminOrderStatusHistory(id)
            .then((result) => {
            if (cancelled)
                return;
            setHistory(result);
            setHistoryStatus('ready');
        })
            .catch((err) => {
            if (cancelled)
                return;
            setHistoryError(err instanceof Error ? err.message : 'Gagal memuat riwayat status.');
            setHistoryStatus('error');
        });
        return () => {
            cancelled = true;
        };
    }, [id, historyToken]);
    useEffect(() => {
        if (status === 'ready')
            markShipmentsSeen();
    }, [status]);
    const isDelivering = detail?.state === 'in_transit' || detail?.state === 'late';
    useEffect(() => {
        if (!isDelivering)
            return;
        const interval = window.setInterval(() => setNow(Date.now()), AGE_TICK_MS);
        return () => window.clearInterval(interval);
    }, [isDelivering]);
    const { location: courierLocation, freshness, loading: courierLoading } = useCourierLocation(detail?.id ?? null, isDelivering);
    if (status === 'loading') {
        return (<div className={ADMIN_PAGE_WRAPPER}>
        <AdminLoadingState label="Memuat detail pengiriman"/>
      </div>);
    }
    if (status === 'forbidden') {
        return (<div className={ADMIN_PAGE_WRAPPER}>
        <AdminForbiddenState message="Halaman ini hanya untuk admin."/>
      </div>);
    }
    if (status === 'not-found') {
        return (<div className={ADMIN_PAGE_WRAPPER}>
        <AdminEmptyState icon={<Truck aria-hidden className="h-10 w-10 text-primary"/>} title="Kiriman tidak ditemukan" description="ID pesanan tidak cocok dengan kiriman mana pun, atau pesanan ini bukan pesanan kirim." action={<Link href="/dashboard/admin/pengiriman">
              <Button type="button" variant="outline" size="sm">
                Kembali ke daftar pengiriman
              </Button>
            </Link>}/>
      </div>);
    }
    if (status === 'error' || !detail) {
        return (<div className={ADMIN_PAGE_WRAPPER}>
        <AdminErrorState title="Gagal memuat detail pengiriman" message={errorMsg} onRetry={() => void load()}/>
      </div>);
    }
    return (<ShipmentDetailContent detail={detail} history={history} historyStatus={historyStatus} historyError={historyError} courierPosition={courierLocation
            ? { latitude: courierLocation.latitude, longitude: courierLocation.longitude }
            : null} courierFreshness={freshness} courierLoading={courierLoading} courierAge={formatPositionAge(courierLocation?.recordedAt, now)} refreshing={reloading} onReload={() => {
            void load();
            setHistoryToken((token) => token + 1);
        }}/>);
}
