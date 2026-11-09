'use client';
import { Check } from 'lucide-react';
import type { StoredOrder } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatOrderTime } from '@/lib/order-utils';
import { buildTimelineTimes } from '@/lib/order-status-history';
import { useOrderStatusHistory } from '@/hooks/use-order-status-history';
interface TrackStep {
    key: string;
    label: string;
    at: string | null;
    done: boolean;
    detail?: string;
}
function buildSteps(order: StoredOrder, times: Record<string, string | null>): TrackStep[] {
    const os = order.orderStatus ?? 'pending';
    const isDelivery = order.fulfillment === 'delivery';
    const isDone = order.status === 'completed';
    const isCancelled = os === 'cancelled' || os === 'refunded' || os === 'failed';
    const reached = (statuses: string[]) => statuses.includes(os) || isDone;
    const paid = reached(['paid', 'processing', 'preparing', 'ready', 'ready_for_pickup', 'out_for_delivery']);
    const prepared = reached(['processing', 'preparing', 'ready', 'ready_for_pickup', 'out_for_delivery']);
    const started = isDelivery ? reached(['out_for_delivery']) : reached(['ready_for_pickup', 'ready']);
    const arrived = isDone;
    const created = order.createdAt;
    const at = (key: string) => times[key] ?? null;
    const steps: TrackStep[] = [
        { key: 'created', label: 'Pesanan dibuat', at: created, done: true },
        { key: 'confirmed', label: 'Pembayaran dikonfirmasi', at: at('confirmed'), done: paid },
        {
            key: 'prepared',
            label: 'Pesanan disiapkan toko',
            at: at('prepared'),
            done: prepared,
        },
    ];
    if (isDelivery) {
        steps.push({ key: 'on-the-way', label: 'Kurir memulai pengantaran', at: at('on-the-way'), done: started });
        steps.push({ key: 'arrived', label: 'Pesanan sampai di tujuan', at: at('arrived'), done: arrived });
    }
    else {
        steps.push({ key: 'ready', label: 'Pesanan siap diambil', at: at('ready'), done: started });
        steps.push({ key: 'taken', label: 'Pesanan diambil', at: at('taken'), done: arrived });
    }
    steps.push({ key: 'completed', label: 'Pesanan selesai', at: at('completed'), done: isDone });
    if (isCancelled) {
        steps.push({ key: 'cancelled', label: 'Pesanan dibatalkan', at: null, done: true });
    }
    return steps;
}
export function OrderStatusTimeline({ order }: {
    order: StoredOrder;
}) {
    const { history } = useOrderStatusHistory(order.dbId);
    const times = buildTimelineTimes(order, history);
    const steps = buildSteps(order, times);
    return (<ol className="mt-2 rounded-xl px-3.5 py-3 ring-1 ring-hairline">

      {steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            const cancelledStep = step.key === 'cancelled';
            return (<li key={step.key} className="relative flex gap-3 pb-3 last:pb-0">

            

            {!isLast && (<span aria-hidden className={cn('absolute left-[7px] top-[18px] bottom-0 w-px', step.done ? 'bg-primary/30' : 'bg-hairline')}/>)}

            <span className={cn('relative z-10 mt-0.5 flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border', cancelledStep
                    ? 'border-destructive bg-destructive text-white'
                    : step.done
                        ? 'border-primary bg-primary text-white'
                        : 'border-hairline bg-white')}>

              {step.done && !cancelledStep && (<Check className="h-[9px] w-[9px]" strokeWidth={4} aria-hidden/>)}

            </span>



            <div className="min-w-0 flex-1">

              <p className={cn('text-[13px] leading-snug', step.done ? 'font-medium text-charcoal-900' : 'text-charcoal-500')}>

                {step.label}

              </p>

              <p className="text-[11px] text-charcoal-500">

                {step.at ? formatOrderTime(step.at) : step.done ? 'Tercatat' : 'Menunggu'}

              </p>

            </div>

          </li>);
        })}

    </ol>);
}
