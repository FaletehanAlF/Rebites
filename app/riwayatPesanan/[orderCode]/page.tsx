'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, CheckCheck, Coins, Copy, MapPin, RefreshCw, Star, Store, Truck, } from 'lucide-react';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { Skeleton } from '@/app/components/ui/skeleton';
import { formatRupiah } from '@/lib/data';
import type { StoredOrder } from '@/lib/types';
import { getOrderById } from '@/lib/order-storage';
import { formatOrderDate, formatOrderTime, mapsUrl, paymentMethodName, SUB_STATUS_LABEL, getOrderSubStatus, } from '@/lib/order-utils';
import { transitionOrderStatus } from '@/lib/order-state-machine';
import { getReviewFor, saveReview } from '@/lib/review-storage';
import { useCurrentUser } from '@/lib/current-user';
import { useOrders } from '@/hooks/buyer/use-orders';
import { useCourierLocation } from '@/hooks/use-courier-location';
import { toast } from '@/hooks/use-toast';
import { DeliveryStatusPanel } from '@/app/components/buyer/order-history/delivery-status-panel';
import { OrderStatusTimeline } from '@/app/components/buyer/order-history/order-status-timeline';
import { CourierChat } from '@/app/components/buyer/order-history/courier-chat';
import { DemoCourierPanel } from '@/app/components/buyer/order-history/demo-courier-panel';
import dynamic from 'next/dynamic';
import { buildMapPlan } from '@/lib/delivery-map-plan';
const DeliveryMap = dynamic(() => import('@/app/components/buyer/order-history/delivery-map'), {
    ssr: false,
    loading: () => (<div className="h-[260px] animate-pulse rounded-2xl border border-hairline bg-cream-100 sm:h-[320px] lg:h-[380px]"/>),
});
import { RiwayatSidebarShell } from '@/app/components/buyer/order-history/riwayat-sidebar-shell';
import { RequireAuth } from '@/app/components/auth/require-auth';
export default function OrderDetailPage() {
    return (<RequireAuth>
      <OrderDetailContent />
    </RequireAuth>);
}
function OrderDetailContent() {
    const params = useParams<{
        orderCode: string;
    }>();
    const orderCode = decodeURIComponent(String(params?.orderCode ?? ''));
    const router = useRouter();
    const { userId } = useCurrentUser();
    const { orders } = useOrders();
    const [order, setOrder] = useState<StoredOrder | null>(null);
    const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'forbidden'>('loading');
    const [copied, setCopied] = useState(false);
    const [confirmingReceipt, setConfirmingReceipt] = useState(false);
    const [cancellingOrder, setCancellingOrder] = useState(false);
    const [review, setReview] = useState<{
        rating: number;
        comment: string;
    } | null>(null);
    const load = useCallback(async () => {
        if (!orderCode)
            return;
        setState('loading');
        const found = await getOrderById(orderCode);
        setOrder(found ?? null);
        setState(found ? 'ready' : 'notfound');
    }, [orderCode]);
    useEffect(() => {
        load();
    }, [load]);
    useEffect(() => {
        if (!order)
            return;
        const fresh = orders.find((o) => o.orderId === order.orderId);
        if (fresh && fresh.orderStatus !== order.orderStatus)
            setOrder(fresh);
    }, [orders, order]);
    useEffect(() => {
        if (!order || !userId)
            return;
        getReviewFor(order.orderId, userId).then((r) => {
            if (r)
                setReview({ rating: r.rating, comment: r.comment });
        });
    }, [order, userId]);
    const orderStatus = order?.orderStatus ?? 'processing';
    const isDone = order
        ? order.status === 'completed' || order.orderStatus === 'completed'
        : false;
    const isDelivering = !isDone && orderStatus === 'out_for_delivery';
    const { location: courierLocation, freshness: courierFreshness } = useCourierLocation(order?.dbId, isDelivering);
    const canConfirmReceipt = order?.status === 'ongoing' &&
        (orderStatus === 'ready_for_pickup' || orderStatus === 'out_for_delivery');
    const canCancelOrder = order?.status === 'ongoing' && orderStatus === 'pending';
    const handleCopy = async () => {
        if (!order)
            return;
        try {
            await navigator.clipboard.writeText(order.orderId);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
        }
        catch {
            toast({ title: 'Gagal menyalin', description: `Salin manual: #${order.orderId}` });
        }
    };
    const handleConfirmReceipt = async () => {
        if (!order || confirmingReceipt)
            return;
        setConfirmingReceipt(true);
        try {
            const result = await transitionOrderStatus(order.orderId, 'completed', 'Pesanan dikonfirmasi diterima oleh pembeli');
            if (result.success) {
                toast({ title: 'Pesanan dikonfirmasi diterima', description: 'Terima kasih!' });
                await load();
            }
            else {
                toast({ title: 'Gagal', description: result.error ?? 'Terjadi kesalahan' });
            }
        }
        finally {
            setConfirmingReceipt(false);
        }
    };
    const handleCancelOrder = async () => {
        if (!order || cancellingOrder)
            return;
        if (!window.confirm('Batalkan pesanan ini? Pesanan yang dibatalkan tidak dapat dilanjutkan.')) {
            return;
        }
        setCancellingOrder(true);
        try {
            const result = await transitionOrderStatus(order.orderId, 'cancelled', 'Dibatalkan oleh pembeli sebelum pembayaran');
            if (result.success) {
                toast({
                    title: 'Pesanan dibatalkan',
                    description: 'Stok produk sudah dilepas kembali untuk pembeli lain.',
                });
                await load();
            }
            else {
                toast({ title: 'Gagal membatalkan', description: result.error ?? 'Terjadi kesalahan' });
            }
        }
        finally {
            setCancellingOrder(false);
        }
    };
    const saveRating = (rating: number) => {
        if (!order || !userId)
            return;
        setReview({ rating, comment: '' });
        saveReview({
            orderId: order.orderId,
            userId,
            rating,
            comment: '',
            createdAt: new Date().toISOString(),
        })
            .then(() => toast({ title: 'Terima kasih atas penilaianmu' }))
            .catch(() => toast({ title: 'Gagal menyimpan penilaian' }));
    };
    const subStatus = order ? getOrderSubStatus(order) : 'diproses';
    const metrics = useMemo(() => {
        if (!order)
            return null;
        return {
            subtotal: order.subtotal,
            discount: order.discount,
            serviceFee: order.serviceFee,
            deliveryFee: order.deliveryFee,
            coinUsed: order.coinUsed ?? 0,
            total: order.total,
        };
    }, [order]);
    if (state === 'loading') {
        return (<RiwayatSidebarShell title="Detail Pesanan" description="Status pengantaran, posisi kurir, rincian biaya, dan tindakan yang bisa kamu lakukan untuk pesanan ini.">
        <div role="status" aria-label="Memuat detail pesanan" className="space-y-4">
          <Skeleton className="h-24 rounded-2xl"/>
          <Skeleton className="h-64 rounded-2xl"/>
        </div>
      </RiwayatSidebarShell>);
    }
    if (state === 'notfound' || !order) {
        return (<RiwayatSidebarShell title="Detail Pesanan" description="Status pengantaran, posisi kurir, rincian biaya, dan tindakan yang bisa kamu lakukan untuk pesanan ini.">
        <div className="mx-auto max-w-md rounded-2xl border border-dashed border-hairline bg-white px-6 py-12 text-center">
          <h1 className="font-display text-lg font-semibold text-charcoal-900">
            Pesanan tidak ditemukan
          </h1>
          <p className="mt-1 text-sm text-charcoal-500">
            Pesanan <span className="font-medium text-charcoal-900">#{orderCode}</span> tidak
            tersedia, atau bukan milik akunmu.
          </p>
          <Link href="/riwayatPesanan" className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white hover:bg-caramel">
            <ArrowLeft className="h-4 w-4" aria-hidden/>
            Kembali ke Pesanan Saya
          </Link>
        </div>
      </RiwayatSidebarShell>);
    }
    const isDelivery = order.fulfillment === 'delivery';
    const dest = order.addressSnapshot;
    const mapPlan = buildMapPlan({
        hasOrder: true,
        originLatitude: order.shippingSnapshot?.origin?.latitude,
        originLongitude: order.shippingSnapshot?.origin?.longitude,
        destinationLatitude: dest?.latitude,
        destinationLongitude: dest?.longitude,
    });
    return (<RiwayatSidebarShell title="Detail Pesanan" description="Status pengantaran, posisi kurir, rincian biaya, dan tindakan yang bisa kamu lakukan untuk pesanan ini.">
      <div className="space-y-5">
        
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={() => router.push('/riwayatPesanan')} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline bg-white px-4 text-xs font-semibold text-charcoal-900 transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden/>
            Pesanan Saya
          </button>
          <button type="button" onClick={() => load()} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hairline bg-white px-4 text-xs font-semibold text-charcoal-900 transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden/>
            Muat ulang
          </button>
        </div>

        
        <header className="rounded-2xl border border-hairline bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sage-500">
                Kode Pesanan
              </p>
              <div className="mt-1 flex items-center gap-2">
                <h1 className="truncate font-display text-xl font-semibold tabular-nums text-charcoal-900 sm:text-2xl">
                  #{order.orderId}
                </h1>
                <button type="button" onClick={handleCopy} aria-label="Salin kode pesanan" className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-hairline text-charcoal-700 transition-colors hover:border-primary hover:text-primary">
                  {copied ? (<Check className="h-3.5 w-3.5 text-primary" aria-hidden/>) : (<Copy className="h-3.5 w-3.5" aria-hidden/>)}
                </button>
              </div>
              <p className="mt-1 text-xs text-charcoal-500">
                Dibuat {formatOrderDate(order.createdAt)} · {formatOrderTime(order.createdAt)}
              </p>
            </div>

            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <span className={isDone
            ? 'inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600'
            : 'inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary'}>
                {isDone ? (<Check className="h-3.5 w-3.5" aria-hidden/>) : isDelivery ? (<Truck className="h-3.5 w-3.5" aria-hidden/>) : (<Store className="h-3.5 w-3.5" aria-hidden/>)}
                {isDone ? SUB_STATUS_LABEL.selesai : SUB_STATUS_LABEL[subStatus]}
              </span>
              <span className="text-xs text-charcoal-500">
                {isDelivery ? 'Diantar' : 'Ambil sendiri'}
              </span>
            </div>
          </div>
        </header>

        
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)] lg:items-start">
          <div className="space-y-5">
            
            <section aria-labelledby="timeline-heading" className="rounded-2xl border border-hairline bg-white p-5">
              <h2 id="timeline-heading" className="font-display text-base font-semibold text-charcoal-900">
                Perjalanan Pesanan
              </h2>
              <OrderStatusTimeline order={order}/>
            </section>

            
            <section aria-labelledby="produk-heading" className="rounded-2xl border border-hairline bg-white p-5">
              <h2 id="produk-heading" className="font-display text-base font-semibold text-charcoal-900">
                Produk
              </h2>
              <div className="mt-3 flex items-center gap-3.5">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-cream-100">
                  <SmartImage src={order.image} alt={order.productName} sizes="64px"/>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-charcoal-900">{order.productName}</p>
                  <p className="text-xs text-charcoal-500">{order.vendorName}</p>
                  <p className="mt-0.5 text-xs text-charcoal-500">
                    {order.quantity} porsi
                    {typeof order.unitPrice === 'number'
            ? ` · ${formatRupiah(order.unitPrice)} / porsi`
            : ''}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-charcoal-900">
                  {formatRupiah(order.subtotal)}
                </p>
              </div>
            </section>

            
            {metrics && (<section aria-labelledby="biaya-heading" className="rounded-2xl border border-hairline bg-white p-5">
                <h2 id="biaya-heading" className="font-display text-base font-semibold text-charcoal-900">
                  Rincian Pembayaran
                </h2>
                <dl className="mt-3 space-y-2.5 text-sm">
                  <CostRow label="Subtotal produk" value={formatRupiah(metrics.subtotal)}/>
                  {metrics.discount > 0 && (<CostRow label={`Diskon${order.promoCode ? ` (${order.promoCode})` : ''}`} value={`−${formatRupiah(metrics.discount)}`} accent/>)}
                  <CostRow label="Biaya admin" value={formatRupiah(metrics.serviceFee)}/>
                  {isDelivery && metrics.deliveryFee > 0 && (<CostRow label="Ongkir (estimasi lokal)" value={formatRupiah(metrics.deliveryFee)}/>)}
                  {!isDelivery && <CostRow label="Ongkir" value="Gratis"/>}
                  {metrics.coinUsed > 0 && (<CostRow label="ReBites Coin digunakan" value={`−${metrics.coinUsed.toLocaleString('id-ID')} Coin`} accent/>)}
                  <div className="flex items-center justify-between border-t border-hairline pt-3">
                    <dt className="font-display font-semibold text-charcoal-900">Total dibayar</dt>
                    <dd className="font-display text-lg font-semibold tabular-nums text-primary">
                      {formatRupiah(metrics.total)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-charcoal-500">
                  Metode pembayaran: {paymentMethodName(order.paymentMethodId)}
                </p>
              </section>)}

            
            <section aria-labelledby="aksi-heading" className="rounded-2xl border border-hairline bg-white p-5">
              <h2 id="aksi-heading" className="font-display text-base font-semibold text-charcoal-900">
                Tindakan
              </h2>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {canCancelOrder && (<button type="button" disabled={cancellingOrder} onClick={handleCancelOrder} className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-hairline px-5 text-sm font-semibold text-charcoal-900 transition-colors hover:bg-cream-100 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                    {cancellingOrder ? 'Membatalkan…' : 'Batalkan Pesanan'}
                  </button>)}

                {canConfirmReceipt && (<button type="button" disabled={confirmingReceipt} onClick={handleConfirmReceipt} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-green-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">
                    <CheckCheck className="h-4 w-4" aria-hidden/>
                    {confirmingReceipt ? 'Memproses…' : 'Pesanan Sudah Saya Terima'}
                  </button>)}

                {isDone && !review && (<div className="flex items-center gap-1 rounded-full border border-hairline px-3 py-2">
                    <span className="mr-1 text-xs font-semibold text-charcoal-700">Beri nilai:</span>
                    {[1, 2, 3, 4, 5].map((n) => (<button key={n} type="button" aria-label={`Beri ${n} bintang`} onClick={() => saveRating(n)} className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        <Star className="h-4 w-4 text-caramel" aria-hidden/>
                      </button>))}
                  </div>)}
                {isDone && review && (<p className="inline-flex items-center gap-1.5 text-xs font-semibold text-sage-600">
                    <Star className="h-3.5 w-3.5 fill-caramel text-caramel" aria-hidden/>
                    Kamu memberi {review.rating} bintang
                  </p>)}

                {!canConfirmReceipt && !isDone && (<p className="text-xs leading-relaxed text-charcoal-500">
                    Belum ada tindakan yang perlu kamu lakukan. Status akan diperbarui otomatis.
                  </p>)}
              </div>
            </section>

            
            {isDelivery && (<>
                <section aria-labelledby="chat-heading" className="rounded-2xl border border-hairline bg-white p-5">
                  <h2 id="chat-heading" className="font-display text-base font-semibold text-charcoal-900">
                    Chat kurir
                  </h2>
                  <div className="mt-3">
                    <DemoCourierPanel orderDbId={order.dbId} orderStatus={orderStatus} onAdvanced={load}/>
                  </div>
                  <div className="mt-3">
                    <CourierChat orderDbId={order.dbId}/>
                  </div>
                </section>

                {dest && (<section aria-labelledby="tujuan-heading" className="rounded-2xl border border-hairline bg-white p-5">
                    <h2 id="tujuan-heading" className="font-display text-base font-semibold text-charcoal-900">
                      Alamat tujuan
                    </h2>
                    <p className="mt-2 text-sm font-semibold text-charcoal-900">
                      {dest.receiverName} · {dest.phone}
                    </p>
                    <p className="mt-1 break-words text-xs leading-relaxed text-charcoal-500">
                      {dest.fullAddress}, {dest.district}, {dest.city}, {dest.province}
                      {dest.postalCode ? ` ${dest.postalCode}` : ''}
                    </p>
                    {dest.note && (<p className="mt-1 text-xs italic text-charcoal-500">Catatan: {dest.note}</p>)}
                  </section>)}
              </>)}
          </div>

          
          <aside className="space-y-5 lg:sticky lg:top-6">
            {isDelivery ? (<section id="pengantaran" aria-labelledby="kirim-heading" className="space-y-3">
                <h2 id="kirim-heading" className="font-display text-base font-semibold text-charcoal-900">
                  Pengantaran
                </h2>
                <DeliveryStatusPanel order={order} variant="full"/>
                <DeliveryMap plan={mapPlan} completed={isDone} animateRoute={!isDone && orderStatus === 'out_for_delivery'} courierPosition={courierFreshness === 'tidak_tersedia'
                ? null
                : courierLocation
                    ? {
                        latitude: courierLocation.latitude,
                        longitude: courierLocation.longitude,
                    }
                    : null}/>
                <p className="text-[11px] leading-relaxed text-charcoal-500">
                  {courierFreshness === 'aktif' || courierFreshness === 'terlambat'
                ? 'Ikon motor menunjukkan posisi kurir sebenarnya, diperbarui otomatis dari perangkatnya.'
                : 'Kurir belum mengirim posisi, jadi ikon motor masih berupa ilustrasi perjalanan.'}
                </p>
              </section>) : (<section aria-labelledby="ambil-heading" className="rounded-2xl border border-hairline bg-white p-5">
                <h2 id="ambil-heading" className="font-display text-base font-semibold text-charcoal-900">
                  Pengambilan
                </h2>
                <p className="mt-2 text-sm font-semibold text-charcoal-900">{order.vendorName}</p>
                {order.vendorAddress && (<p className="mt-0.5 text-xs leading-relaxed text-charcoal-500">
                    {order.vendorAddress}
                  </p>)}
                {order.vendorOpenHours && (<p className="mt-1 text-xs text-charcoal-500">
                    Jam operasional {order.vendorOpenHours}
                  </p>)}
                {order.vendorAddress && (<a href={mapsUrl(order.vendorAddress)} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                    <MapPin className="h-3 w-3" aria-hidden/> Lihat lokasi toko
                  </a>)}
                <p className="mt-3 rounded-xl bg-cream-50 px-3 py-2 text-xs leading-relaxed text-charcoal-500">
                  Metode ini tidak menggunakan kurir, jadi tidak ada biaya maupun pelacakan
                  pengantaran.
                </p>
              </section>)}

            {(order.coinEarned ?? 0) > 0 && (<div className="flex items-center gap-3 rounded-2xl bg-caramel/15 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-caramel text-white">
                  <Coins className="h-4 w-4" aria-hidden/>
                </span>
                <div>
                  <p className="font-display text-sm font-bold tabular-nums text-caramel-700">
                    +{order.coinEarned.toLocaleString('id-ID')} Coin
                  </p>
                  <p className="text-xs text-charcoal-500">Reward pembelian masuk ke saldo Coin kamu</p>
                </div>
              </div>)}
          </aside>
        </div>
      </div>
    </RiwayatSidebarShell>);
}
function CostRow({ label, value, accent, }: {
    label: string;
    value: string;
    accent?: boolean;
}) {
    return (<div className="flex items-center justify-between gap-4">
      <dt className="text-charcoal-500">{label}</dt>
      <dd className={accent
            ? 'font-semibold tabular-nums text-primary'
            : 'font-medium tabular-nums text-charcoal-900'}>
        {value}
      </dd>
    </div>);
}
