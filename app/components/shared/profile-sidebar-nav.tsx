'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  Receipt,
  User,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'profil',
    label: 'Profil Saya',
    icon: User,
    href: '/profile',
    exact: true,
  },
  {
    id: 'riwayat',
    label: 'Riwayat Transaksi',
    icon: Receipt,
    href: '/riwayatPesanan',
  },
  {
    id: 'notifikasi',
    label: 'Notifikasi',
    icon: Bell,
    href: '/notifikasi/pembeli',
  },
];

function useActiveHref(href: string, exact?: boolean) {
  const pathname = usePathname();
  if (!pathname) return false;
  
  const base = href.split('#')[0];
  if (!base || base === '/profile') return pathname === '/profile' && exact ? true : pathname.startsWith('/profile');
  return exact ? pathname === href : pathname.startsWith(base);
}

function NavItemLink({ item, onClose }: { item: NavItem; onClose?: () => void }) {
  const isActive = useActiveHref(item.href, item.exact);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClose}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
        isActive
          ? 'bg-muted text-foreground'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      )}
    >
      <Icon
        className={cn(
          'h-[18px] w-[18px] shrink-0',
          isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
        )}
      />
      <span className="flex-1">{item.label}</span>
    </Link>
  );
}

function SidebarContent({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="relative flex h-full flex-col overflow-y-auto"
    >
      <div className="relative flex items-center gap-2.5 px-6 pb-6 pt-7">
        <Link
          href="/home"
          aria-label="Ke beranda ReBites"
          className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-border transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Image src="/logo.png" alt="ReBites" width={40} height={40} className="h-10 w-10 object-cover" />
        </Link>
        <Link href="/home" className="min-w-0 flex-1">
          <p className="font-display text-xl font-semibold leading-none tracking-tight text-primary">ReBites</p>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Food Rescue</p>
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup menu navigasi"
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="relative flex-1 space-y-1 px-4" aria-label="Navigasi profil">
        {NAV_ITEMS.map((item) => (
          <NavItemLink key={item.id} item={item} onClose={onClose} />
        ))}
      </nav>

      <div className="relative px-4 pb-6 pt-4">
        <div className="rounded-2xl border border-border/70 bg-white p-4">
          <p className="font-display text-sm font-semibold text-primary">Butuh bantuan?</p>
          <p className="mt-1 font-secondary text-xs leading-relaxed text-muted-foreground">Kelola makanan surplusmu dan bantu kurangi food waste.</p>
          <Link
            href="/home#umkm"
            className="mt-3 inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-dark"
          >
            Jelajahi Toko
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export function ProfileSidebarNav({ open, onClose }: SidebarProps) {
  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
            aria-hidden
          />
        )}
      </AnimatePresence>

      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[280px] border-r border-border bg-secondary lg:block">
        <SidebarContent onClose={onClose} />
      </aside>

      <AnimatePresence>
        {open && (
          <motion.aside
            key="drawer"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
            className="fixed inset-y-0 left-0 z-50 w-[300px] bg-secondary lg:hidden"
          >
            <SidebarContent onClose={onClose} />
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
