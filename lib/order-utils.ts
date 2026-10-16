import type { StoredOrder } from './types';
import { paymentMethods } from '@/app/components/buyer/checkout/payment-methods';

export function paymentMethodName(id?: string): string {
  if (!id) return '-';
  return paymentMethods.find((m) => m.id === id)?.name ?? id;
}

export function formatOrderDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatOrderDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatOrderTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getRemainingMs(order: StoredOrder): number {
  if (!order.estimatedCompletionAt) return 0;
  return Math.max(0, new Date(order.estimatedCompletionAt).getTime() - Date.now());
}

export function getOrderProgress(order: StoredOrder): number {
  if (!order.estimatedCompletionAt || order.status === 'completed') return 1;
  const start = new Date(order.createdAt).getTime();
  const end = new Date(order.estimatedCompletionAt).getTime();
  if (end <= start) return 1;
  const ratio = (Date.now() - start) / (end - start);
  return Math.min(1, Math.max(0, ratio));
}

export type OrderSubStatus =
  | 'diproses'
  | 'diantar'
  | 'disiapkan'
  | 'siap-diambil'
  | 'selesai';

export function getOrderSubStatus(
  order: StoredOrder,
  progress = getOrderProgress(order)
): OrderSubStatus {
  if (order.status === 'completed') return 'selesai';

  // Status progres yang dikendalikan penjual di dashboard (disiapkan ->
  // siap-diambil / diantar). Prioritas utama.
  if (order.progressStatus) return order.progressStatus;

  // Fallback: status lama berbasis orderStatus (paid/processing/etc) untuk kompatibilitas pesanan lama
  const orderStatus = order.orderStatus;
  if (orderStatus) {
    switch (orderStatus) {
      case 'ready_for_pickup':
        return 'siap-diambil';
      case 'out_for_delivery':
        return 'diantar';
      case 'processing':
        return order.fulfillment === 'delivery' ? 'diproses' : 'disiapkan';
      case 'paid':
        return order.fulfillment === 'delivery' ? 'diproses' : 'disiapkan';
      case 'completed':
        return 'selesai';
    }
  }

  return progress >= 0.6
    ? order.fulfillment === 'delivery'
      ? 'diantar'
      : 'siap-diambil'
    : order.fulfillment === 'delivery'
      ? 'diproses'
      : 'disiapkan';
}

export const SUB_STATUS_LABEL: Record<OrderSubStatus, string> = {
  diproses: 'Sedang diproses',
  diantar: 'Sedang diantar',
  disiapkan: 'Sedang disiapkan',
  'siap-diambil': 'Siap diambil',
  selesai: 'Selesai',
};

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export interface OrderTimelineEntry {
  timeIso: string;
  label: string;
  done: boolean;
}

export function getOrderTimeline(order: StoredOrder): OrderTimelineEntry[] {
  const created = new Date(order.createdAt).getTime();
  const readyAt =
    created + Math.max(0, order.preparationMinutes ?? 20) * 60_000;
  const finishedIso = order.completedAt ?? order.estimatedCompletionAt;
  const finished = finishedIso ? new Date(finishedIso).getTime() : NaN;
  const isDone = order.status === 'completed';

  const entries: OrderTimelineEntry[] = [
    { timeIso: order.createdAt, label: 'Pesanan dibuat', done: true },
    ...(isDone || !Number.isNaN(finished)
      ? [
          {
            timeIso: new Date(readyAt).toISOString(),
            label:
              order.fulfillment === 'pickup'
                ? 'Siap diambil'
                : 'Kurir mengambil pesanan',
            done: isDone || Date.now() >= readyAt,
          },
        ]
      : []),
    {
      timeIso: finishedIso ?? new Date(readyAt).toISOString(),
      label:
        order.fulfillment === 'pickup'
          ? 'Diterima di lokasi'
          : 'Tiba di tujuan',
      done: isDone,
    },
  ];
  return entries;
}
