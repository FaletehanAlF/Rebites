'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, Coins, Star } from 'lucide-react';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { formatRupiah } from '@/lib/data';
import { fetchProductDetail } from '@/app/components/buyer/detail-product/detail-data';
import type { StoredOrder } from '@/lib/types';
import { formatOrderDate, getOrderSubStatus, SUB_STATUS_LABEL } from '@/lib/order-utils';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function OrderCard({
  order,
  reviewed,
  onViewDetail,
  highlighted = false,
}: {
  order: StoredOrder;
  reviewed: boolean;
  onViewDetail: (order: StoredOrder) => void;
  highlighted?: boolean;
}) {
  const router = useRouter();
  const [reordering] = useState(false);
  const isOngoing = order.status === 'ongoing';
  const subStatus = getOrderSubStatus(order);
  const isDelivered = order.status === 'completed' || order.orderStatus === 'completed';

  const badge = isDelivered
    ? { label: SUB_STATUS_LABEL[subStatus], dot: 'bg-success', bg: 'bg-success/10 text-success', ring: 'ring-success/30' }
    : subStatus === 'diantar' || subStatus === 'siap-diambil'
      ? { label: SUB_STATUS_LABEL[subStatus], dot: 'bg-primary', bg: 'bg-primary/10 text-primary', ring: 'ring-primary/30' }
      : { label: SUB_STATUS_LABEL[subStatus], dot: 'bg-warning', bg: 'bg-warning/10 text-warning', ring: 'ring-warning/30' };

  const dateStr = formatOrderDate(order.createdAt);

  const moreText = order.quantity > 1 ? ` & ${order.quantity} items` : '';
  
  const description = `${order.productName} | ${order.vendorName}${moreText}`;

  return (
    <article
      onClick={() => onViewDetail(order)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewDetail(order);
        }
      }}
      className={cn(
        'group flex cursor-pointer flex-col rounded-2xl border bg-white p-4 transition-colors hover:border-primary/40 hover:bg-secondary/50 sm:p-5',
        highlighted ? 'border-primary ring-2 ring-primary/20 shadow-sm' : 'border-border'
      )}
    >
      {}
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${badge.bg} ${badge.ring}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
          {badge.label}
        </span>
        <span className="text-[11px] text-muted-foreground/60">|</span>
        <span className="text-[11px] text-muted-foreground">{dateStr}</span>
      </div>

      {}
      <div className="mt-3 flex items-start gap-3">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
          <SmartImage src={order.image} alt={order.productName} sizes="56px" />
          {}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-primary">
            Order ID: {order.orderId}
          </p>
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
              {reviewed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                  <Star className="h-3 w-3 fill-primary text-primary" /> Sudah dinilai
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-primary">
                  <Star className="h-3 w-3" /> Belum dinilai · Beri ulasan
                </span>
              )}
            </p>
          )}
        </div>

        <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
      </div>
    </article>
  );
}
