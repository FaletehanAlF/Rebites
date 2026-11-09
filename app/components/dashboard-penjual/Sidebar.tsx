'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, LayoutGrid, LogOut, PanelLeftClose, PanelLeftOpen, ShieldCheck, ShoppingBag, Star, Store, TrendingUp, Utensils, X, } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsAdminAccount } from '@/hooks/use-is-admin-account';
import { supabase } from '@/lib/supabase';
import { sellerStorePath, type SellerSubPage, } from '@/lib/seller-store-path';
import { IconTooltip } from '@/app/components/shared/icon-tooltip';
export const SELLER_SIDEBAR_WIDTH_CLASS = {
    collapsed: 'w-[76px]',
    expanded: 'w-[240px]',
} as const;
export const SELLER_CONTENT_OFFSET_CLASS = {
    collapsed: 'lg:pl-[76px]',
    expanded: 'lg:pl-[240px]',
} as const;
interface SidebarProps {
    open: boolean;
    onClose: () => void;
    storeId: string;
    collapsed: boolean;
    onToggleCollapsed: () => void;
}
interface NavItem {
    id: string;
    label: string;
    icon: LucideIcon;
    href: string;
    exact?: boolean;
}
function sellerNavItems(storeId: string): NavItem[] {
    const page = (sub?: SellerSubPage) => sellerStorePath(storeId, sub);
    return [
        {
            id: 'dashboard',
            label: 'Dashboard',
            icon: LayoutGrid,
            href: page(),
            exact: true,
        },
        {
            id: 'pesanan',
            label: 'Pesanan Masuk',
            icon: ShoppingBag,
            href: page('pesanan'),
        },
        {
            id: 'ulasan',
            label: 'Ulasan',
            icon: Star,
            href: page('ulasan'),
        },
        {
            id: 'menu',
            label: 'Menu Saya',
            icon: Utensils,
            href: page('menu'),
        },
        {
            id: 'performa',
            label: 'Performa Toko',
            icon: TrendingUp,
            href: page('performa'),
        },
        {
            id: 'profil',
            label: 'Profil Toko',
            icon: Store,
            href: page('pengaturan'),
        },
    ];
}
function useActiveHref(href: string, exact?: boolean) {
    const pathname = usePathname();
    if (!pathname)
        return false;
    return exact ? pathname === href : pathname.startsWith(href);
}
function NavItemLink({ item, collapsed, onClose }: {
    item: NavItem;
    collapsed: boolean;
    onClose?: () => void;
}) {
    const isActive = useActiveHref(item.href, item.exact);
    const Icon = item.icon;
    return (<IconTooltip label={item.label} side="right" enabled={collapsed} className="flex w-full">

      <Link href={item.href} onClick={onClose} aria-current={isActive ? 'page' : undefined} className={cn('group flex min-h-[44px] w-full items-center gap-3 rounded-xl text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white', collapsed ? 'justify-center px-0' : 'px-3', isActive
            ? 'bg-emerald-50 font-semibold text-emerald-900 shadow-[inset_3px_0_0_0_#1b4d32]'
            : 'text-charcoal-900 hover:bg-emerald-50/60 hover:text-emerald-900')}>

        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-[0_1px_2px_0_rgba(27,77,50,0.06)] transition-colors', isActive
            ? 'text-emerald-900'
            : 'text-muted-foreground group-hover:text-emerald-800')}>

          <Icon className="h-[18px] w-[18px]" aria-hidden/>

        </span>

        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}

      </Link>

    </IconTooltip>);
}
function SidebarContent({ onClose, storeId, collapsed, onToggleCollapsed }: {
    onClose: () => void;
    storeId: string;
    collapsed: boolean;
    onToggleCollapsed: () => void;
}) {
    const isAdmin = useIsAdminAccount();
    const navItems = sellerNavItems(storeId);
    const router = useRouter();
    const [signingOut, setSigningOut] = useState(false);
    const handleLogout = async () => {
        if (signingOut)
            return;
        setSigningOut(true);
        try {
            await supabase.auth.signOut();
            onClose();
            router.push('/auth/login');
        }
        finally {
            setSigningOut(false);
        }
    };
    return (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="relative flex h-full flex-col">

      <div className="flex h-16 shrink-0 items-center border-b border-border px-4">

        <Link href="/home" aria-label="ReBites — ke beranda" className={cn("flex items-center gap-3 overflow-hidden rounded-xl transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white", collapsed ? "justify-center" : "px-1.5 py-1")}>

          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary">

            <Image src="/logo.avif" alt="ReBites" width={36} height={36} className="h-9 w-9 object-cover"/>

          </span>

          {!collapsed && (<span className="flex min-w-0 flex-col">

              <span className="font-display text-base font-bold leading-tight tracking-tight text-primary">

                ReBites

              </span>

              <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">

                Food Rescue

              </span>

            </span>)}

        </Link>

        <button type="button" onClick={onClose} aria-label="Tutup menu navigasi" className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted lg:hidden">

          <X className="h-4 w-4"/>

        </button>

      </div>



      <nav aria-label="Navigasi dashboard penjual" className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">

        <div className="space-y-1">

        {navItems.map((item) => (<NavItemLink key={item.id} item={item} collapsed={collapsed} onClose={onClose}/>))}

        </div>

      </nav>



      

      <div className="shrink-0 border-t border-border px-3 py-4">

        <div className="space-y-2">

        <IconTooltip label="Lihat sebagai Pembeli" side="right" enabled={collapsed} className="flex w-full">

          <Link href="/home" onClick={onClose} className={cn('group flex min-h-[44px] items-center gap-3 rounded-xl w-full px-3 py-2.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white', collapsed && 'justify-center px-0', 'text-charcoal-900 hover:bg-emerald-50/60 hover:text-emerald-900')}>

            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-[0_1px_2px_0_rgba(27,77,50,0.06)] text-muted-foreground transition-colors group-hover:text-emerald-800">

              <Eye className="h-[18px] w-[18px]" aria-hidden/>

            </span>

            {!collapsed && <span className="truncate">Lihat sebagai Pembeli</span>}

          </Link>

        </IconTooltip>



        {isAdmin && (<IconTooltip label="Panel Admin" side="right" enabled={collapsed} className="flex w-full">

            <Link href="/dashboard/admin" onClick={onClose} className={cn('group flex min-h-[44px] w-full items-center gap-3 rounded-xl text-[13px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white', collapsed ? 'justify-center px-0' : 'px-3', 'text-charcoal-900 hover:bg-emerald-50/60 hover:text-emerald-900')}>

              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-[0_1px_2px_0_rgba(27,77,50,0.06)] text-muted-foreground transition-colors group-hover:text-emerald-800">

                <ShieldCheck className="h-[18px] w-[18px]" aria-hidden/>

              </span>

              {!collapsed && <span className="flex-1">Panel Admin</span>}

            </Link>

          </IconTooltip>)}



      

        <IconTooltip label="Keluar Akun" side="right" enabled={collapsed} className="flex w-full">

          <button type="button" onClick={() => void handleLogout()} disabled={signingOut} className={cn("group flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/[0.05] text-[13px] font-semibold text-destructive transition-colors duration-150 hover:border-destructive hover:bg-destructive hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 disabled:cursor-not-allowed disabled:opacity-60", collapsed ? "justify-center px-0" : "px-3")}>

            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-destructive/20 bg-white text-destructive transition-colors group-hover:border-white/40 group-hover:bg-white/20 group-hover:text-white">

              <LogOut aria-hidden className="h-[18px] w-[18px]"/>

            </span>

            {!collapsed && (<span className="flex-1 text-left truncate">

                {signingOut ? 'Keluar…' : 'Keluar Akun'}

              </span>)}

          </button>

        </IconTooltip>

        </div>



        <div className="mt-2 border-t border-border pt-2">

        <IconTooltip label={collapsed ? "Perbesar navigasi" : "Perkecil navigasi"} side="right" enabled={collapsed} className="flex w-full">

          <button type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "Perbesar navigasi" : "Perkecil navigasi"} className={cn("flex min-h-[44px] w-full items-center gap-3 rounded-xl text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", collapsed ? "justify-center px-0" : "px-3")}>

            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-[0_1px_2px_0_rgba(27,77,50,0.06)] text-muted-foreground">

              {collapsed ? (<PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden/>) : (<PanelLeftClose className="h-[18px] w-[18px]" aria-hidden/>)}

            </span>

            {!collapsed && (<span className="truncate">

                Perkecil navigasi

              </span>)}

          </button>

        </IconTooltip>

        </div>

      </div>

    </motion.div>);
}
export function Sidebar({ open, onClose, storeId, collapsed, onToggleCollapsed }: SidebarProps) {
    return (<>

      <AnimatePresence>

        {open && (<motion.div key="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm lg:hidden" aria-hidden/>)}

      </AnimatePresence>



      <aside aria-label="Navigasi dashboard penjual" className={cn("fixed inset-y-0 left-0 z-50 hidden border-r border-border bg-white transition-[width] duration-200 ease-out lg:flex lg:flex-col", collapsed ? SELLER_SIDEBAR_WIDTH_CLASS.collapsed : SELLER_SIDEBAR_WIDTH_CLASS.expanded)}>

        <SidebarContent onClose={onClose} storeId={storeId} collapsed={collapsed} onToggleCollapsed={onToggleCollapsed}/>

      </aside>



      <AnimatePresence>

        {open && (<motion.aside key="drawer" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }} className="fixed inset-y-0 left-0 z-50 w-[260px] border-r border-border bg-white lg:hidden">

            <SidebarContent onClose={onClose} storeId={storeId} collapsed={false} onToggleCollapsed={onToggleCollapsed}/>

          </motion.aside>)}

      </AnimatePresence>

    </>);
}
