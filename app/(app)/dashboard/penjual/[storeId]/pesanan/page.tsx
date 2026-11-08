'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { CheckCheck, ClipboardList, Clock, MapPin, Package, PackageOpen, ShoppingBag, Store, Truck, } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRupiah } from '@/lib/data';
import type { StoredOrder } from '@/lib/types';
import { ORDERS_UPDATED_EVENT, getSellerOrders, } from '@/lib/order-storage';
import { getSellerUmkm } from '@/lib/product-storage';
import { getSellerStoreSettings } from '@/lib/store-settings-storage';
import { formatOrderDateTime, getOrderSubStatus, } from '@/lib/order-utils';
import { getSellerAction, needsSellerAction, resolveOrderPhase, } from '@/lib/order-status-source';
import { transitionOrderStatus, getStatusLabel, } from '@/lib/order-state-machine';
import { SellerShell } from '@/app/components/seller/dashboard-penjual/SellerShell';
import { Card } from '@/app/components/seller/dashboard-penjual/Card';
import { Skeleton } from '@/app/components/ui/skeleton';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { CourierPositionPanel } from '@/app/components/buyer/order-history/courier-position-panel';
import { buildMapPlan } from '@/lib/delivery-map-plan';
import { useCourierLocation } from '@/hooks/use-courier-location';
import { formatPrepRemaining } from '@/lib/prep-deadline';
const DeliveryMap = dynamic(() => import('@/app/components/buyer/order-history/delivery-map'), {
    ssr: false,
    loading: () => <Skeleton className="h-[260px] rounded-2xl"/>,
});
type OrderTab = 'berlangsung' | 'butuh-aksi' | 'selesai' | 'semua';
const SWEEP_INTERVAL_MS = 5000;
function useVendorOrders() {
    const [orders, setOrders] = useState<StoredOrder[]>([]);
    const [hydrated, setHydrated] = useState(false);
    const [storeHasPoint, setStoreHasPoint] = useState(false);
    const refresh = useCallback(async () => {
        const list = await getSellerOrders();
        setOrders(list);
        setHydrated(true);
    }, []);
    useEffect(() => {
        let cancelled = false;
        getSellerStoreSettings()
            .then((settings) => {
            if (cancelled)
                return;
            const lat = settings?.latitude;
            const lng = settings?.longitude;
            setStoreHasPoint(typeof lat === 'number' &&
                typeof lng === 'number' &&
                Number.isFinite(lat) &&
                Number.isFinite(lng) &&
                !(lat === 0 && lng === 0));
        })
            .catch(() => {
            if (!cancelled)
                setStoreHasPoint(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    useEffect(() => {
        refresh();
        const onUpdate = () => refresh();
        window.addEventListener(ORDERS_UPDATED_EVENT, onUpdate);
        const intervalId = window.setInterval(onUpdate, SWEEP_INTERVAL_MS * 6);
        return () => {
            window.removeEventListener(ORDERS_UPDATED_EVENT, onUpdate);
            window.clearInterval(intervalId);
        };
    }, [refresh]);
    const ongoing = useMemo(() => orders
        .filter((order) => order.status === 'ongoing')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [orders]);
    const completed = useMemo(() => orders
        .filter((order) => order.status === 'completed')
        .sort((a, b) => (b.completedAt ?? b.createdAt).localeCompare(a.completedAt ?? a.createdAt)), [orders]);
    return { orders: [...ongoing, ...completed], ongoing, completed, hydrated, storeHasPoint };
}
function StatusChip({ order }: {
    order: StoredOrder;
}) {
    const subStatus = getOrderSubStatus(order);
    const isDone = subStatus === 'selesai';
    const orderStatus = order.orderStatus ?? 'processing';
    return (<span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]', isDone
            ? 'bg-muted text-muted-foreground'
            : 'bg-primary/10 text-primary')}>
      <span className={cn('h-1.5 w-1.5 rounded-full', isDone ? 'bg-muted-foreground' : 'bg-primary')}/>
      {getStatusLabel(orderStatus)}
    </span>);
}
function OrderRow({ order, storeHasPoint, highlightWaiting = false, onStatusChange, }: {
    order: StoredOrder;
    storeHasPoint: boolean;
    highlightWaiting?: boolean;
    onStatusChange?: (orderId: string) => void;
}) {
    const [processing, setProcessing] = useState(false);
    const isOngoing = order.status === 'ongoing';
    const phase = resolveOrderPhase(order);
    const canAutoDispatch = storeHasPoint && phase === 'processing' && order.fulfillment === 'delivery';
    const action = isOngoing
        ? getSellerAction(phase, order.fulfillment, canAutoDispatch ? { autoAdvanceTo: 'out_for_delivery' } : undefined)
        : null;
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!isOngoing)
            return;
        const id = window.setInterval(() => setNow(Date.now()), 30000);
        return () => window.clearInterval(id);
    }, [isOngoing]);
    const prep = isOngoing && phase !== 'pending'
        ? formatPrepRemaining(order.estimatedCompletionAt, now)
        : null;
    const handleAction = async (targetStatus: string) => {
        if (processing)
            return;
        setProcessing(true);
        try {
            const result = await transitionOrderStatus(order.orderId, targetStatus);
            if (result.success) {
                onStatusChange?.(order.orderId);
                window.dispatchEvent(new Event(ORDERS_UPDATED_EVENT));
            }
            else {
                console.error('[pesanan] transition failed:', result.error);
                alert(result.error ?? 'Gagal mengubah status');
            }
        }
        catch (err) {
            console.error('[pesanan] transition error:', err);
        }
        finally {
            setProcessing(false);
        }
    };
    const waitingForSeller = isOngoing && needsSellerAction(phase);
    const courierToolsActive = order.fulfillment === 'delivery' && phase === 'out_for_delivery';
    const { location: courierLocation, freshness: courierFreshness } = useCourierLocation(order.dbId, courierToolsActive);
    const mapPlan = useMemo(() => buildMapPlan({
        hasOrder: true,
        originLatitude: order.shippingSnapshot?.origin?.latitude,
        originLongitude: order.shippingSnapshot?.origin?.longitude,
        destinationLatitude: order.addressSnapshot?.latitude,
        destinationLongitude: order.addressSnapshot?.longitude,
    }), [order.shippingSnapshot, order.addressSnapshot]);
    return (<li className={cn('flex flex-col gap-3 rounded-2xl border bg-white p-3 sm:p-4', waitingForSeller ? 'border-destructive/40' : 'border-border')}>
      
      <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
            <SmartImage src={order.image} alt={`Foto ${order.productName}`} sizes="56px"/>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-foreground">
                {order.productName}
                {order.quantity > 1 && (<span className="font-medium text-muted-foreground"> × {order.quantity}</span>)}
              </p>
              <StatusChip order={order}/>
              {waitingForSeller && (<span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white"/>
                  Butuh aksi
                </span>)}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
              <span className="whitespace-nowrap font-medium text-charcoal-500">{order.orderId}</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 font-medium text-charcoal-700">
                {order.fulfillment === 'delivery' ? (<Truck className="h-3 w-3 shrink-0" aria-hidden/>) : (<Store className="h-3 w-3 shrink-0" aria-hidden/>)}
                {order.fulfillment === 'delivery' ? 'Diantar' : 'Ambil sendiri'}
              </span>
              <span aria-hidden>·</span>
              <span>{formatOrderDateTime(order.createdAt)}</span>
            </p>
            {prep && (<p className={cn('mt-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', prep.overdue
                ? 'bg-destructive/10 text-destructive'
                : 'bg-primary/10 text-primary')}>
                <Clock className="h-3 w-3 shrink-0" aria-hidden/>
                {prep.text}
              </p>)}
            {order.fulfillment === 'delivery' && order.deliveryFee > 0 && (<p className="mt-1 text-xs text-sage-500">
                Ongkir {formatRupiah(order.deliveryFee)}
              </p>)}
            {order.fulfillment === 'delivery' && order.addressSnapshot && (<p className="mt-1 flex items-start gap-1 text-xs leading-relaxed text-muted-foreground">
                <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden/>
                
                <span className="line-clamp-2 min-w-0 break-words">
                  {order.addressSnapshot.fullAddress}
                </span>
              </p>)}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3 sm:flex-col sm:items-end sm:justify-center sm:gap-2 sm:border-0 sm:pt-0">
          <p className="shrink-0 whitespace-nowrap text-sm font-bold tabular-nums text-primary">
            {formatRupiah(order.total)}
          </p>
          {action ? (<button type="button" disabled={processing} onClick={() => handleAction(action.targetStatus)} title={action.description} className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50', action.tone === 'primary'
                ? 'bg-primary shadow-primary/25 hover:bg-primary-dark'
                : action.tone === 'emerald'
                    ? 'bg-emerald-600 shadow-emerald-600/25 hover:bg-emerald-700'
                    : 'bg-purple-600 shadow-purple-600/25 hover:bg-purple-700')}>
              {action.targetStatus === 'processing' && <Package className="h-3.5 w-3.5"/>}
              {action.targetStatus === 'ready_for_pickup' && <CheckCheck className="h-3.5 w-3.5"/>}
              {action.targetStatus === 'out_for_delivery' && <Truck className="h-3.5 w-3.5"/>}
              {action.targetStatus === 'completed' && <CheckCheck className="h-3.5 w-3.5"/>}
              {processing ? 'Memproses...' : action.label}
            </button>) : (<span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5"/>
              {phase === 'pending'
                ? 'Menunggu pembayaran'
                : order.status === 'completed'
                    ? 'Selesai diproses'
                    : 'Menunggu aksi'}
            </span>)}
        </div>
      </div>
      
      {courierToolsActive && (<div className="w-full space-y-2 border-t border-dashed border-border/70 pt-3 sm:mt-1">
          <DeliveryMap plan={mapPlan} animateRoute courierPosition={courierFreshness === 'tidak_tersedia' || !courierLocation
                ? null
                : {
                    latitude: courierLocation.latitude,
                    longitude: courierLocation.longitude,
                }}/>
          <CourierPositionPanel location={courierLocation} freshness={courierFreshness}/>
        </div>)}
    </li>);
}
function EmptyState({ hasAnyOrders }: {
    hasAnyOrders: boolean;
}) {
    return (<Card className="flex flex-col items-center justify-center gap-4 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-primary">
        {hasAnyOrders ? (<PackageOpen className="h-6 w-6"/>) : (<ShoppingBag className="h-6 w-6"/>)}
      </span>
      <div className="max-w-sm">
        <p className="text-sm font-bold text-foreground">
          {hasAnyOrders ? 'Tidak ada pesanan pada tab ini' : 'Belum ada pesanan masuk'}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {hasAnyOrders
            ? 'Coba buka tab lain untuk melihat pesanan berlangsung atau selesai.'
            : 'Pesanan dari pembeli akan muncul di sini. Untuk demo, buat pesanan lewat halaman toko sebagai pembeli, datanya langsung tersinkron.'}
        </p>
      </div>
    </Card>);
}
export default function PesananMasukPage() {
    const { orders, ongoing, completed, hydrated, storeHasPoint } = useVendorOrders();
    const [tab, setTab] = useState<OrderTab>('berlangsung');
    const [storeName, setStoreName] = useState('');
    const waitingOrders = useMemo(() => ongoing.filter((order) => needsSellerAction(resolveOrderPhase(order))), [ongoing]);
    useEffect(() => {
        let cancelled = false;
        getSellerUmkm().then((umkm) => {
            if (!cancelled && umkm)
                setStoreName(umkm.businessName);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    const tabs = [
        {
            value: 'berlangsung' as const,
            label: `Berlangsung (${ongoing.length})`,
            badge: 0,
        },
        {
            value: 'butuh-aksi' as const,
            label: `Butuh Aksi (${waitingOrders.length})`,
            badge: waitingOrders.length,
        },
        { value: 'selesai' as const, label: `Selesai (${completed.length})`, badge: 0 },
        { value: 'semua' as const, label: `Semua (${orders.length})`, badge: 0 },
    ];
    const visibleOrders = tab === 'berlangsung'
        ? ongoing
        : tab === 'butuh-aksi'
            ? waitingOrders
            : tab === 'selesai'
                ? completed
                : orders;
    return (<SellerShell>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
        <h1 className="mt-1 font-display text-[clamp(1.8rem,4vw,2.6rem)] font-medium leading-tight tracking-[-0.02em] text-primary">
          Pesanan Masuk
        </h1>
      </motion.div>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Filter status pesanan">
        {tabs.map((item) => (<button key={item.value} type="button" role="tab" aria-selected={tab === item.value} onClick={() => setTab(item.value)} className={cn('inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors', tab === item.value
                ? 'bg-primary text-white shadow-sm shadow-primary/25'
                : 'border border-border bg-white text-muted-foreground hover:text-foreground')}>
            {item.label}
            
            {item.badge > 0 && tab !== item.value && (<span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white">
                {item.badge > 99 ? '99+' : item.badge}
              </span>)}
          </button>))}
      </div>

      <div className="mt-5">
        {!hydrated ? (<div role="status" aria-label="Memuat pesanan" className="space-y-3">
            {[0, 1, 2].map((i) => (<div key={i} className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
                <Skeleton className="h-14 w-14 shrink-0 rounded-xl"/>
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-48 rounded-full"/>
                  <Skeleton className="h-3 w-32 rounded-full"/>
                  <Skeleton className="h-3 w-24 rounded-full"/>
                </div>
                <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                  <Skeleton className="h-5 w-20 rounded-full"/>
                  <Skeleton className="h-8 w-24 rounded-full"/>
                </div>
              </div>))}
          </div>) : visibleOrders.length === 0 ? (<EmptyState hasAnyOrders={orders.length > 0}/>) : (<ul className="space-y-3">
            {visibleOrders.map((order) => (<OrderRow key={order.orderId} order={order} storeHasPoint={storeHasPoint} onStatusChange={() => { }}/>))}
          </ul>)}
      </div>
    </SellerShell>);
}
