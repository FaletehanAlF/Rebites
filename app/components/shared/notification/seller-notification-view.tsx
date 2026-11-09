'use client';

import { useMemo, useState } from 'react';

import { Bell, CheckCheck } from 'lucide-react';
import { useCurrentUser } from '@/lib/current-user';
import { useNotifications } from '@/hooks/use-notifications';
import type { NotificationType } from '@/lib/notification-storage';
import { NotificationCard } from './notification-card';
import { SellerShell } from '@/app/components/seller/dashboard-penjual/SellerShell';
import { cn } from '@/lib/utils';

type NotificationFilter = 'all' | 'order' | 'subscription' | 'moderation';

const FILTER_TABS: { value: NotificationFilter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'order', label: 'Pesanan Masuk' },
  { value: 'subscription', label: 'Langganan' },
  { value: 'moderation', label: 'Moderasi' },
];

const ORDER_TYPES: NotificationType[] = ['incoming_order', 'new_review', 'order_completed'];
const MODERATION_TYPES: NotificationType[] = [
  'product_approved',
  'product_rejected',
  'product_warning',
  'report_received',
];
const SUBSCRIPTION_TYPES: NotificationType[] = [
  'subscription_active',
  'subscription_renewed',
  'subscription_expiring',
  'subscription_changed',
  'subscription_expired',
  // fallback untuk data legacy yang sempat pakai payment_success untuk seller
  'payment_success' as NotificationType,
];

export function SellerNotificationView() {
  const { userId } = useCurrentUser();
  const { notifications, unreadCount, markRead, markAllRead } =
    useNotifications(userId, 'seller');
  const [filter, setFilter] = useState<NotificationFilter>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    const types =
      filter === 'order'
        ? ORDER_TYPES
        : filter === 'moderation'
          ? MODERATION_TYPES
          : SUBSCRIPTION_TYPES;
    return notifications.filter((n) => types.includes(n.type));
  }, [notifications, filter]);

  return (
    <SellerShell>
      { }
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="mt-1 font-display text-[clamp(1.8rem,4vw,2.6rem)] font-medium leading-tight tracking-[-0.02em] text-primary">
            Notifikasi
          </h1>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary-dark hover:text-white"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Tandai semua dibaca
          </button>
        )}
      </div>

      { }
      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={filter === tab.value}
            onClick={() => setFilter(tab.value)}
            className={cn(
              'rounded-full px-4 py-2 text-xs font-semibold transition-colors',
              filter === tab.value
                ? 'bg-primary text-white'
                : 'border border-border bg-white text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      { }
      <div className="mt-5 space-y-2.5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-secondary px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Bell className="h-6 w-6" />
            </span>
            <h3 className="mt-4 font-display text-lg font-medium text-foreground">
              Belum ada notifikasi
            </h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {filter === 'all'
                ? 'Notifikasi pesanan masuk, langganan, dan moderasi produk akan muncul di sini.'
                : filter === 'moderation'
                  ? 'Notifikasi hasil moderasi produk (disetujui/ditolak) akan muncul di sini.'
                  : 'Tidak ada notifikasi untuk filter ini.'}
            </p>
          </div>
        ) : (
          filtered.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onMarkRead={markRead}
            />
          ))
        )}
      </div>
    </SellerShell>
  );
}
