'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Eye,
  LayoutGrid,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Star,
  TrendingUp,
  Utensils,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsAdminAccount } from '@/hooks/use-is-admin-account';

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
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutGrid,
    href: '/dashboard/penjual',
    exact: true,
  },
  {
    id: 'pesanan',
    label: 'Pesanan Masuk',
    icon: ShoppingBag,
    href: '/dashboard/penjual/pesanan',
  },
  {
    id: 'ulasan',
    label: 'Ulasan',
    icon: Star,
    href: '/dashboard/penjual/ulasan',
  },
  {
    id: 'menu',
    label: 'Menu Saya',
    icon: Utensils,
    href: '/dashboard/penjual/menu',
  },
  {
    id: 'performa',
    label: 'Performa Toko',
    icon: TrendingUp,
    href: '/dashboard/penjual/performa',
  },
  {
    id: 'pengaturan',
    label: 'Pengaturan Toko',
    icon: Settings,
    href: '/dashboard/penjual/pengaturan',
  },
];

function useActiveHref(href: string, exact?: boolean) {
  const pathname = usePathname();
  if (!pathname) return false;
  return exact ? pathname === href : pathname.startsWith(href);
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
          isActive
            ? 'text-primary'
            : 'text-muted-foreground group-hover:text-primary'
        )}
      />
      <span className="flex-1">{item.label}</span>
    </Link>
  );
}

function SidebarContent({ onClose }: { onClose: () => void }) {
  // Tautan "Panel Admin" hanya untuk akun ber-role admin. Membaca role sendiri
  // (bukan GET /api/admin/me) menghindari 403 yang wajar di log untuk setiap
  // penjual non-admin. Route admin tetap memverifikasi ulang di server.
  const isAdmin = useIsAdminAccount();

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
          <Image src="/logo.avif" alt="ReBites" width={40} height={40} className="h-10 w-10 object-cover" />
        </Link>
        <Link href="/home" className="min-w-0 flex-1">
          <p className="font-display text-xl font-semibold leading-none tracking-tight text-primary">
            ReBites
          </p>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Food Rescue
          </p>
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

      <nav className="relative flex-1 space-y-1 px-4" aria-label="Navigasi dashboard penjual">
        {NAV_ITEMS.map((item) => (
          <NavItemLink key={item.id} item={item} onClose={onClose} />
        ))}
      </nav>

      {/*
        Jalan masuk ke sisi pembeli.

        Penjual dan pembeli memakai beranda yang berbeda, dan dashboard penjual
        tidak menyediakan pratinjau dari sudut pandang pembeli: tanpa tautan ini
        satu-satunya cara memeriksanya adalah mengetik /home di address bar.

        Diletakkan di luar daftar NAV_ITEMS karena ini bukan halaman lain di
        dashboard, melainkan berpindah sisi — sama seperti "Panel Admin" di
        bawahnya. Sengaja satu baris tanpa subjudul: baris dua tingkat membuat
        tingginya berbeda dari menu di atasnya sehingga terbaca sebagai kartu
        tersendiri, padahal ia sekadar satu menu lagi.

        Jalan kembali tersedia di sisi pembeli dan tidak diduplikasi di sini:
        sidebar pembeli menampilkan "Toko Saya" dan drawer ponsel pembeli
        menampilkan "Dashboard Penjual" untuk akun yang punya toko.
      */}
      <div className="relative border-t border-sage-100 px-4 py-3">
        <Link
          href="/home"
          onClick={onClose}
          className={cn(
            'group flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-colors',
            'text-charcoal-500 hover:bg-sage-100/60 hover:text-charcoal-900'
          )}
        >
          <Eye
            aria-hidden
            className="h-[18px] w-[18px] shrink-0 text-sage-500 group-hover:text-caramel"
          />
          <span className="truncate">Lihat sebagai Pembeli</span>
        </Link>
      </div>

      {isAdmin && (
        <div className="relative border-t border-sage-100 px-4 py-3">
          <Link
            href="/dashboard/admin"
            onClick={onClose}
            className={cn(
              'group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
              'text-charcoal-500 hover:bg-sage-100/60 hover:text-charcoal-900'
            )}
          >
            <ShieldCheck
              aria-hidden
              className="h-[18px] w-[18px] shrink-0 text-sage-500 group-hover:text-caramel"
            />
            <span className="flex-1">Panel Admin</span>
          </Link>
        </div>
      )}
    </motion.div>
  );
}

export function Sidebar({ open, onClose }: SidebarProps) {
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
