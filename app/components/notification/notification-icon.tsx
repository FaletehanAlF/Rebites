
import {
  CreditCard,
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
    bg: 'bg-blue-50',
    color: 'text-blue-600',
  },
  payment_success: {
    icon: CreditCard,
    bg: 'bg-primary/10',
    color: 'text-primary',
  },
  order_delivering: {
    icon: Truck,
    bg: 'bg-orange-50',
    color: 'text-orange-600',
  },
  order_completed: {
    icon: PackageCheck,
    bg: 'bg-sage-100',
    color: 'text-primary',
  },
  promo: {
    icon: Gift,
    bg: 'bg-caramel/15',
    color: 'text-caramel-dark',
  },
  incoming_order: {
    icon: ShoppingBag,
    bg: 'bg-primary/10',
    color: 'text-primary',
  },
  new_review: {
    icon: Star,
    bg: 'bg-caramel-50',
    color: 'text-caramel-dark',
  },
  subscription_active: {
    icon: Crown,
    bg: 'bg-caramel/15',
    color: 'text-caramel-dark',
  },
  subscription_renewed: {
    icon: RefreshCw,
    bg: 'bg-primary/10',
    color: 'text-primary',
  },
  subscription_expiring: {
    icon: AlertTriangle,
    bg: 'bg-orange-50',
    color: 'text-orange-600',
  },
  subscription_changed: {
    icon: Crown,
    bg: 'bg-blue-50',
    color: 'text-blue-600',
  },
  subscription_expired: {
    icon: XCircle,
    bg: 'bg-red-50',
    color: 'text-red-500',
  },
};

export function NotificationIcon({ type, className }: NotificationIconProps) {
  const config = ICON_CONFIG[type] ?? {
    icon: Bell,
    bg: 'bg-cream-100',
    color: 'text-charcoal-500',
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
