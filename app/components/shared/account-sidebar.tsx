'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  Coins,
  Heart,
  LogOut,
  MapPin,
  Receipt,
  Settings,
  Store,
  Truck,
  User,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRebitesCoins } from '@/hooks/buyer/use-rebites-coins';
import { useSellerStatus } from '@/hooks/seller/use-seller-status';
import { useProfile } from '@/hooks/use-profile';
import { useIsCourier } from '@/hooks/use-is-courier';

export interface SidebarUser {
  fullName: string;
  email: string;
}

interface AccountSidebarProps {
  open: boolean;
  onClose: () => void;
  user: SidebarUser | null;
  onLogout?: () => void;
  unreadCount?: number;
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const ACCOUNT_MENU: {
  href: string;
  label: string;
  icon: LucideIcon;
  showUnread?: boolean;
}[] = [
  { href: '/profile', label: 'Profil & Akun Saya', icon: Settings },
  { href: '/riwayatPesanan', label: 'Pesanan Saya', icon: Receipt },
  { href: '/notifikasi/pembeli', label: 'Notifikasi', icon: Bell, showUnread: true },
];

const ACTIVITY_MENU: {
  href: string;
  label: string;
  icon: LucideIcon;
}[] = [
  { href: '/profile#sukai-makanan', label: 'Makanan Disukai', icon: Heart },
  { href: '/toko-diikuti', label: 'Toko Diikuti', icon: Store },
  { href: '/pengaturan/coin', label: 'ReBites Coin', icon: Coins },
  { href: '/profile#alamat', label: 'Alamat Pengiriman', icon: MapPin },
];

function getInitials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function AccountSidebar({
  open,
  onClose,
  user,
  onLogout,
  unreadCount = 0,
}: AccountSidebarProps) {
  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  const displayName = user?.fullName?.trim() || 'Akun ReBites';
  const initials = user?.fullName ? getInitials(user.fullName) : '';
  const { balance, totalEarned } = useRebitesCoins();
  const { avatarUrl } = useProfile();
  const { isSeller, loading: sellerStatusLoading } = useSellerStatus();
  const { isCourier } = useIsCourier(open);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            aria-hidden
            className="fixed inset-0 z-[70] bg-primary/40"
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Profil pengguna"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: EASE }}
            className="fixed right-0 top-0 z-[80] flex h-full w-[88vw] max-w-[92vw] flex-col overflow-y-auto bg-secondary md:w-[360px] md:max-w-none lg:w-[400px]"
          >
            { }
            <header className="flex items-center justify-between px-6 pb-4 pt-6 sm:px-7">
              <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
                Profil Pengguna
              </h2>
              <button
                type="button"
                aria-label="Tutup profil pengguna"
                onClick={onClose}
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground',
                  FOCUS_RING,
                )}
              >
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="mx-6 h-px bg-border sm:mx-7" />

            { }
            <div className="flex items-center gap-4 px-6 py-5 sm:px-7">
              <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 ring-1 ring-border">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={displayName} fill className="object-cover" unoptimized />
                ) : initials ? (
                  <span className="font-display text-lg font-semibold text-primary">
                    {initials}
                  </span>
                ) : (
                  <User className="h-6 w-6 text-primary" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-secondary text-base font-semibold text-foreground">
                  {displayName}
                </p>
                <p className="truncate font-secondary text-sm text-muted-foreground">
                  {user?.email || '-'}
                </p>
              </div>
            </div>
            <div className="mx-6 h-px bg-border sm:mx-7" />

            { }
            <div className="px-6 pt-5 sm:px-7">
              <div className="flex items-center gap-3.5 rounded-2xl border border-primary/20 bg-white px-4 py-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-sm">
                  <Coins className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-secondary text-base font-bold tabular-nums text-primary">
                    {balance.toLocaleString('id-ID')} Coin
                  </p>
                  <p className="font-secondary text-xs text-muted-foreground">
                    Total didapat: {totalEarned.toLocaleString('id-ID')} Coin
                  </p>
                </div>
              </div>
            </div>

            { }
            {!sellerStatusLoading && (
              <div className="px-6 pt-5 sm:px-7">
                {isSeller ? (
                  <Link
                    href="/dashboard/penjual"
                    onClick={onClose}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-secondary text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-dark',
                      FOCUS_RING,
                    )}
                  >
                    <Store className="h-4 w-4" />
                    Toko Saya
                  </Link>
                ) : (
                  <Link
                    href="/auth/register/penjual"
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full bg-primary/10 px-5 py-2.5 font-secondary text-sm font-semibold text-primary transition-colors duration-200 hover:bg-primary-dark/[0.18]',
                      FOCUS_RING,
                    )}
                  >
                    <Store className="h-4 w-4" />
                    Mulai Jualan
                  </Link>
                )}
              </div>
            )}

            { }
            <nav aria-label="Menu akun" className="mt-4 px-4 sm:px-5">
              <p className="px-4 pb-1 font-secondary text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Akun
              </p>
              {ACCOUNT_MENU.map(({ href, label, icon: Icon, showUnread }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={cn(
                    'group flex w-full items-center gap-3.5 rounded-xl px-4 py-3 font-secondary text-[15px] font-medium text-foreground transition-colors duration-200 hover:bg-white hover:text-primary',
                    FOCUS_RING,
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground transition-colors duration-200 group-hover:text-primary" />
                  <span className="flex-1">{label}</span>
                  {showUnread && unreadCount > 0 && (
                    <span
                      className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-none text-white"
                      aria-label={`${unreadCount} belum dibaca`}
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              ))}

              {isCourier && (
                <Link
                  href="/dashboard/kurir"
                  onClick={onClose}
                  className={cn(
                    'group flex w-full items-center gap-3.5 rounded-xl px-4 py-3 font-secondary text-[15px] font-medium text-foreground transition-colors duration-200 hover:bg-white hover:text-primary',
                    FOCUS_RING,
                  )}
                >
                  <Truck className="h-5 w-5 shrink-0 text-muted-foreground transition-colors duration-200 group-hover:text-primary" />
                  <span className="flex-1">Dashboard Kurir</span>
                </Link>
              )}

              <p className="mt-4 px-4 pb-1 font-secondary text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Aktivitas
              </p>
              {ACTIVITY_MENU.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={cn(
                    'group flex w-full items-center gap-3.5 rounded-xl px-4 py-3 font-secondary text-[15px] font-medium text-foreground transition-colors duration-200 hover:bg-white hover:text-primary',
                    FOCUS_RING,
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground transition-colors duration-200 group-hover:text-primary" />
                  <span className="flex-1">{label}</span>
                </Link>
              ))}
            </nav>

            { }
            <div className="flex-1" />

            <div className="mx-6 h-px bg-border sm:mx-7" />
            <div className="px-6 py-5 sm:px-7">
              {user ? (
                <button
                  type="button"
                  onClick={onLogout}
                  className={cn(
                    'inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-destructive px-4 py-3 font-secondary text-sm font-semibold text-white transition-colors duration-200 hover:bg-destructive/90',
                    FOCUS_RING,
                  )}
                >
                  <LogOut className="h-5 w-5" />
                  Keluar Akun
                </button>
              ) : (
                <Link
                  href="/auth/login"
                  className={cn(
                    'inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 font-secondary text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-dark active:scale-[0.98]',
                    FOCUS_RING,
                  )}
                >
                  Keluar
                </Link>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
