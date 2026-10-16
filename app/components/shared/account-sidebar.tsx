'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Coins, Receipt, Settings, Store, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRebitesCoins } from '@/hooks/buyer/use-rebites-coins';
import { useSellerStatus } from '@/hooks/seller/use-seller-status';
import { useProfile } from '@/hooks/use-profile';

export interface SidebarUser {
  fullName: string;
  email: string;
}

interface AccountSidebarProps {
  open: boolean;
  onClose: () => void;
  user: SidebarUser | null;
  onLogout?: () => void;
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const ACCOUNT_MENU = [
  { href: '/profile', label: 'Profil & Akun Saya', icon: Settings },
  { href: '/riwayatPesanan', label: 'Pesanan Saya', icon: Receipt },
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
            <header className="flex items-center justify-between px-8 pb-5 pt-7">
              <h2 className="font-secondary text-xl font-semibold text-foreground">
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
            <div className="mx-8 h-px bg-border" />

            { }
            <div className="flex items-center gap-4 px-8 py-6">
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
            <div className="mx-8 h-px bg-border" />

            { }
            <div className="px-8 pt-6">
              <div className="flex items-center gap-3.5 rounded-2xl border border-primary/40 bg-primary/15 px-4 py-3.5">
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
              <div className="px-8 pt-6">
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
            <nav aria-label="Menu akun" className="mt-5 px-8">
              {ACCOUNT_MENU.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={cn(
                    'group flex w-full items-center gap-3.5 rounded-xl px-4 py-3 font-secondary text-base font-medium text-foreground transition-colors duration-200 hover:bg-primary-dark/5 hover:text-primary',
                    FOCUS_RING,
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground transition-colors duration-200 group-hover:text-primary" />
                  {label}
                </Link>
              ))}
            </nav>

            { }
            <div className="flex-1" />

            <div className="mx-8 h-px bg-border" />
            <div className="px-8 py-6">
              {user ? (
                <button
                  type="button"
                  onClick={onLogout}
                  className={cn(
                    'inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-destructive px-4 py-3.5 font-secondary text-sm font-semibold text-destructive-foreground transition-colors duration-200 hover:bg-destructive/90',
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
                    'inline-flex w-full items-center justify-center rounded-full bg-destructive px-4 py-3.5 font-secondary text-sm font-semibold text-destructive-foreground transition-all duration-200 hover:bg-destructive/90 active:scale-[0.98]',
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
