import Link from 'next/link';
import {
  CreditCard,
  LogIn,
  Package,
  ShieldAlert,
  ShoppingBag,
  Store,
  UserPlus,
} from 'lucide-react';
import { DashboardCard } from './primitives';
import { labelAktivitas, waktuLalu } from '../admin-format';
import type { AdminDashboardData, DashboardActivityItem } from '@/lib/admin-dashboard';

const TYPE_ICONS: Record<string, typeof ShoppingBag> = {
  login: LogIn,
  register: UserPlus,
  product_created: Package,
  product_updated: Package,
  product_deleted: Package,
  order_created: ShoppingBag,
  order_cancelled: ShoppingBag,
  store_updated: Store,
  subscription_changed: CreditCard,
  report_received: ShieldAlert,
  warning_received: ShieldAlert,
};

function targetHref(item: DashboardActivityItem): string | null {
  if (item.targetType === 'product' && item.targetId) {
    return `/dashboard/admin/produk?produk=${encodeURIComponent(item.targetId)}`;
  }
  if (item.targetType === 'order' || item.targetType === 'orders') {
    return item.orderCode
      ? `/dashboard/admin/pesanan?kode=${encodeURIComponent(item.orderCode)}`
      : '/dashboard/admin/pesanan';
  }
  if (
    (item.targetType === 'store' ||
      item.targetType === 'stores' ||
      item.targetType === 'umkm') &&
    item.targetId
  ) {
    return `/dashboard/admin/umkm/${encodeURIComponent(item.targetId)}`;
  }
  if (item.targetType === 'user' && item.targetId) {
    return `/dashboard/admin/pengguna/${encodeURIComponent(item.targetId)}`;
  }
  return null;
}

export function DashboardActivity({ data }: { data: AdminDashboardData }) {
  return (
    <DashboardCard>
      {data.activity.length === 0 ? (
        <p className="py-4 text-center text-sm text-sage-500">Belum ada aktivitas tercatat.</p>
      ) : (
        <ul className="divide-y divide-border">
          {data.activity.map((item) => {
            const Icon = TYPE_ICONS[item.activityType] ?? ShoppingBag;
            const href = targetHref(item);
            return (
              <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-sage-100 text-sage-600">
                  <Icon aria-hidden className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-charcoal-900">
                    {item.description}
                  </p>
                  <p className="text-xs text-sage-500">
                    {labelAktivitas(item.activityType)}
                    {item.userName ? ` · ${item.userName}` : ''}
                  </p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs text-sage-500">
                  {waktuLalu(item.createdAt)}
                </span>
                {href && (
                  <Link
                    href={href}
                    className="shrink-0 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    Lihat detail
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}