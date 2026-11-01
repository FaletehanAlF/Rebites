'use client';

import { Check, ChevronRight, Package, Star, Store, Truck } from 'lucide-react';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { formatRupiah } from '@/lib/data';
<<<<<<< HEAD:app/components/order-history/order-card.tsx
=======
import { fetchProductDetail } from '@/app/components/buyer/detail-product/detail-data';
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34:app/components/buyer/order-history/order-card.tsx
import type { StoredOrder } from '@/lib/types';
import { formatOrderDate, getOrderSubStatus, SUB_STATUS_LABEL } from '@/lib/order-utils';
import { cn } from '@/lib/utils';

/**
 * Kartu satu pesanan pada daftar "Pesanan Saya".
 *
 * Aturan:
 * - Status ditampilkan dengan label teks + ikon, bukan warna saja.
 * - Tidak ada angka karangan: ongkir hanya muncul bila `deliveryFee > 0`.
 * - "Lacak Pesanan" hanya tampil untuk Diantar yang sudah mulai diantar;
 *   lokasi live-nya sendiri belum tersedia (lihat DeliveryStatusPanel).
 */

type StatusPresentation = {
  label: string;
  icon: typeof Truck;
  className: string;
  dotClassName: string;
};

function resolveStatus(order: StoredOrder): StatusPresentation {
  const sub = getOrderSubStatus(order);
  const os = order.orderStatus ?? '';
  const done = order.status === 'completed' || os === 'completed';
  const cancelled = os === 'cancelled' || os === 'refunded';

  if (cancelled) {
    return {
      label: sub === 'selesai' ? 'Selesai' : 'Dibatalkan',
      icon: Package,
      className: 'bg-cream-100 text-charcoal-700',
      dotClassName: 'bg-charcoal-500',
    };
  }
  if (done) {
    return {
      label: SUB_STATUS_LABEL.selesai,
      icon: Check,
      className: 'bg-green-50 text-green-600',
      dotClassName: 'bg-green-600',
    };
  }
  if (sub === 'diantar' || sub === 'siap-diambil') {
    return {
      label: SUB_STATUS_LABEL[sub],
      icon: order.fulfillment === 'delivery' ? Truck : Store,
      className: 'bg-primary/10 text-primary',
      dotClassName: 'bg-primary',
    };
  }
  return {
    label: SUB_STATUS_LABEL[sub],
    icon: Package,
    className: 'bg-caramel/15 text-caramel-700',
    dotClassName: 'bg-caramel',
  };
}

export function OrderCard({
  order,
  reviewed,
  onViewDetail,
  onTrack,
  highlighted = false,
}: {
  order: StoredOrder;
  reviewed: boolean;
  onViewDetail: (order: StoredOrder) => void;
  /** Hanya diberikan bila pesanan memang bisa dilacak (Diantar + sedang diantar). */
  onTrack?: (order: StoredOrder) => void;
  highlighted?: boolean;
}) {
  const status = resolveStatus(order);
  const StatusIcon = status.icon;
  const os = order.orderStatus ?? '';
  const isDelivered = order.status === 'completed' || os === 'completed';
  const canTrack = order.fulfillment === 'delivery' && os === 'out_for_delivery';
  const isPickup = order.fulfillment === 'pickup';

  return (
    <article
      className={cn(
<<<<<<< HEAD:app/components/order-history/order-card.tsx
        'flex flex-col overflow-hidden rounded-2xl border bg-white transition-colors',
        highlighted ? 'border-primary ring-2 ring-primary/15' : 'border-hairline hover:border-sage-500/40'
=======
        'group flex cursor-pointer flex-col rounded-2xl border bg-white p-4 transition-colors hover:border-primary/40 hover:bg-secondary/50 sm:p-5',
        highlighted ? 'border-primary ring-2 ring-primary/20 shadow-sm' : 'border-border'
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34:app/components/buyer/order-history/order-card.tsx
      )}
    >
      {/* Kepala kartu: kode pesanan + status. */}
      <div className="flex items-center justify-between gap-3 border-b border-hairline bg-cream-50/60 px-4 py-2.5">
        <p className="min-w-0 truncate text-xs font-semibold tracking-tight text-charcoal-700">
          {order.orderId}
        </p>
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
            status.className
          )}
        >
          <StatusIcon className="h-3 w-3" aria-hidden />
          {status.label}
        </span>
<<<<<<< HEAD:app/components/order-history/order-card.tsx
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-start">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-cream-100">
          <SmartImage src={order.image} alt={order.productName} sizes="64px" />
=======
        <span className="text-[11px] text-muted-foreground/60">|</span>
        <span className="text-[11px] text-muted-foreground">{dateStr}</span>
      </div>

      {}
      <div className="mt-3 flex items-start gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
          <SmartImage src={order.image} alt={order.productName} sizes="56px" />
          {}
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34:app/components/buyer/order-history/order-card.tsx
        </div>

        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-charcoal-900">
            {order.productName}
          </p>
<<<<<<< HEAD:app/components/order-history/order-card.tsx
          <p className="mt-0.5 text-xs text-charcoal-500">
            {order.vendorName}
            {order.quantity > 1 ? ` · ${order.quantity} item` : ''}
          </p>

          {/* Metode + ongkir: hanya nilai yang benar-benar tercatat pada pesanan. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-charcoal-500">
            <span className="inline-flex items-center gap-1 font-medium text-charcoal-700">
              {isPickup ? (
                <Store className="h-3.5 w-3.5 shrink-0" aria-hidden />
              ) : (
                <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden />
              )}
              {isPickup ? 'Ambil sendiri' : 'Diantar'}
            </span>
            {!isPickup && order.deliveryFee > 0 && (
              <span>Ongkir {formatRupiah(order.deliveryFee)}</span>
            )}
            <span>{formatOrderDate(order.createdAt)}</span>
          </div>

          {isDelivered && (
            <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold">
=======
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-foreground">
            {description}
            {}
            {order.quantity > 1 && (
              <span className="font-medium text-primary"> & {order.quantity} items</span>
            )}
          </p>
          <p className="mt-1 text-[13px] font-semibold text-foreground">Rp{order.total.toLocaleString('id-ID')}</p>
          {order.status === 'completed' && (
            <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold">
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34:app/components/buyer/order-history/order-card.tsx
              {reviewed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                  <Star className="h-3 w-3 fill-primary text-primary" aria-hidden /> Sudah dinilai
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-primary">
                  <Star className="h-3 w-3" aria-hidden /> Belum dinilai
                </span>
              )}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-end justify-between gap-3 sm:flex-col sm:items-end">
          <div className="sm:text-right">
            <p className="text-[11px] text-charcoal-500">Total</p>
            <p className="text-sm font-bold tabular-nums text-charcoal-900">
              {formatRupiah(order.total)}
            </p>
          </div>
        </div>
      </div>

      {/* Aksi: setiap tombol punya fungsi nyata. */}
      <div className="flex flex-col-reverse gap-2 border-t border-hairline px-4 py-3 sm:flex-row sm:justify-end">
        {canTrack && onTrack && (
          <button
            type="button"
            onClick={() => onTrack(order)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-hairline px-4 text-xs font-semibold text-charcoal-900 transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Truck className="h-3.5 w-3.5" aria-hidden />
            Lacak Pesanan
          </button>
        )}
        <button
          type="button"
          onClick={() => onViewDetail(order)}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-white transition-colors hover:bg-caramel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Lihat Detail
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </article>
  );
}
