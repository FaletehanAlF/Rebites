'use client';

import { useRouter } from 'next/navigation';
import type { Notification } from '@/lib/notification-storage';
import { formatNotificationTime } from '@/lib/notification-helpers';
import { NotificationIcon } from './notification-icon';
import { cn } from '@/lib/utils';

interface NotificationCardProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
}

export function NotificationCard({
  notification,
  onMarkRead,
}: NotificationCardProps) {
  const router = useRouter();

  const handleClick = () => {
    if (!notification.read) {
      onMarkRead(notification.id);
    }
    if (notification.href) {
      router.push(notification.href);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'flex w-full items-start gap-3.5 rounded-2xl border p-4 text-left transition-all duration-200',
        notification.read
          ? 'border-border bg-white hover:bg-secondary'
          : 'border-primary/20 bg-primary/5 hover:bg-primary-dark/20'
      )}
    >
      <NotificationIcon type={notification.type} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-sm leading-snug',
              notification.read
                ? 'font-medium text-muted-foreground'
                : 'font-semibold text-foreground'
            )}
          >
            {notification.title}
          </p>
          {!notification.read && (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
          )}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground/80">
          {notification.message}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <time className="text-[11px] text-muted-foreground">
            {formatNotificationTime(notification.createdAt)}
          </time>
          {notification.href && (
            <span className="text-[11px] font-medium text-primary">
              Lihat detail →
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
