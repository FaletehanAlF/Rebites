
import {
  CheckCircle2,
  CreditCard,
  Flag,
  Gift,
  PackageCheck,
  ShoppingBag,
  Truck,
  Bell,
  RefreshCw,
  AlertTriangle,
  Crown,
  XCircle,
  Star,
} from 'lucide-react';
import type { NotificationType } from '@/lib/notification-storage';
import { cn } from '@/lib/utils';

interface NotificationIconProps {
  type: NotificationType;
  className?: string;
}

const ICON_CONFIG: Record<
  NotificationType,
  {
    icon: typeof Bell;
    bg: string;
    color: string;
  }
> = {
  order_created: {
    icon: ShoppingBag,
    bg: 'bg-primary/10',
    color: 'text-primary',
  },
  payment_success: {
    icon: CreditCard,
    bg: 'bg-primary/10',
    color: 'text-primary',
  },
  order_delivering: {
    icon: Truck,
    bg: 'bg-warning/10',
    color: 'text-warning',
  },
  order_completed: {
    icon: PackageCheck,
    bg: 'bg-muted',
    color: 'text-primary',
  },
  promo: {
    icon: Gift,
    bg: 'bg-primary/15',
    color: 'text-primary',
  },
  incoming_order: {
    icon: ShoppingBag,
    bg: 'bg-primary/10',
    color: 'text-primary',
  },
  new_review: {
    icon: Star,
    bg: 'bg-primary/15',
    color: 'text-primary',
  },
  subscription_active: {
    icon: Crown,
    bg: 'bg-primary/15',
    color: 'text-primary',
  },
  subscription_renewed: {
    icon: RefreshCw,
    bg: 'bg-primary/10',
    color: 'text-primary',
  },
  subscription_expiring: {
    icon: AlertTriangle,
    bg: 'bg-warning/10',
    color: 'text-warning',
  },
  subscription_changed: {
    icon: Crown,
    bg: 'bg-primary/10',
    color: 'text-primary',
  },
  subscription_expired: {
    icon: XCircle,
    bg: 'bg-destructive/10',
    color: 'text-destructive',
  },
  product_approved: {
    icon: CheckCircle2,
    bg: 'bg-sage-100',
    color: 'text-primary',
  },
  product_rejected: {
    icon: XCircle,
    bg: 'bg-red-50',
    color: 'text-red-500',
  },
  product_warning: {
    icon: AlertTriangle,
    bg: 'bg-caramel/15',
    color: 'text-caramel-dark',
  },
  // NOTIF-1: laporan baru untuk toko. Diberi ikon bendera agar berbeda dari
  // peringatan produk (keduanya sama-sama terkait moderasi).
  report_received: {
    icon: Flag,
    bg: 'bg-orange-50',
    color: 'text-orange-600',
  },
};

export function NotificationIcon({ type, className }: NotificationIconProps) {
  const config = ICON_CONFIG[type] ?? {
    icon: Bell,
    bg: 'bg-muted',
    color: 'text-muted-foreground',
  };
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
        config.bg,
        className
      )}
    >
      <Icon className={cn('h-5 w-5', config.color)} />
    </span>
  );
}
