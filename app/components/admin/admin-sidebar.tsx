'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Activity, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Coins, CreditCard, ExternalLink, Flag, Gavel, ShieldCheck, LayoutDashboard, MessageSquare, Newspaper, Package, Settings, Server, ShoppingBag, Store, TriangleAlert, Truck, UserCog, Users, X, } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
const DRAWER_EASE: [
    number,
    number,
    number,
    number
] = [0.23, 1, 0.32, 1];
import { useSellerStatus } from '@/hooks/use-seller-status';
import { useAdminMe } from '@/hooks/use-admin-me';
import { useRoleRequestBadge } from '@/hooks/use-role-request-badge';
import { useStoreActivationBadge } from '@/hooks/use-store-activation-badge';
import { useShipmentBadge } from '@/hooks/use-shipment-badge';
import { useAdminSupportBadge } from '@/hooks/use-support-badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '@/app/components/ui/dropdown-menu';
interface AdminSidebarProps {
    open: boolean;
    onClose: () => void;
    collapsed: boolean;
    onToggleCollapsed: () => void;
}
interface NavItem {
    label: string;
    icon: LucideIcon;
    href: string;
    exact?: boolean;
    badgeCount?: number | null;
    badgeKind?: 'pending' | 'decision' | 'store-activation' | 'shipment' | 'support' | null;
}
const MONITORING_CHILDREN: NavItem[] = [
    { label: 'Aktivitas', icon: Activity, href: '/dashboard/admin/monitoring/aktivitas' },
    { label: 'Laporan', icon: Flag, href: '/dashboard/admin/monitoring/laporan' },
    { label: 'Peringatan', icon: TriangleAlert, href: '/dashboard/admin/monitoring/peringatan' },
    { label: 'Sanksi', icon: Gavel, href: '/dashboard/admin/monitoring/sanksi' },
    { label: 'Audit', icon: ClipboardList, href: '/dashboard/admin/monitoring/audit' },
];
const MONITORING_MENU: NavItem[] = [
    { label: 'Ringkasan Monitoring', icon: Activity, href: '/dashboard/admin/monitoring', exact: true },
    ...MONITORING_CHILDREN,
];
function isActivePath(pathname: string | null, href: string, exact?: boolean) {
    if (!pathname)
        return false;
    const normalized = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    if (exact)
        return normalized === href;
    return normalized === href || normalized.startsWith(`${href}/`);
}
export function AdminSidebar({ open, onClose, collapsed, onToggleCollapsed, }: AdminSidebarProps) {
    const pathname = usePathname();
    const inMonitoring = pathname
        ? pathname === '/dashboard/admin/monitoring' ||
            pathname.startsWith('/dashboard/admin/monitoring/')
        : false;
    const [monitoringOpen, setMonitoringOpen] = useState(inMonitoring);
    const [monitoringMenuOpen, setMonitoringMenuOpen] = useState(false);
    const panelRef = useRef<HTMLElement | null>(null);
    const prefersReducedMotion = useReducedMotion();
    const { isSeller, loading: sellerStatusLoading } = useSellerStatus();
    const { me } = useAdminMe();
    const { count: roleBadgeCount, kind: roleBadgeKind } = useRoleRequestBadge(me !== null, me?.isSuperAdmin === true);
    const { count: activationCount } = useStoreActivationBadge(me !== null);
    const { count: shipmentBadgeCount } = useShipmentBadge(me !== null);
    const { count: supportBadgeCount } = useAdminSupportBadge(me !== null);
    const withActivationBadge = (items: NavItem[]): NavItem[] => items.map((item) => item.href === '/dashboard/admin/monitoring/aktivitas' &&
        activationCount != null &&
        activationCount > 0
        ? { ...item, badgeCount: activationCount, badgeKind: 'store-activation' as const }
        : item);
    const [tip, setTip] = useState<{
        label: string;
        top: number;
    } | null>(null);
    const showTip = (event: {
        currentTarget: HTMLElement;
    }, label: string) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setTip({ label, top: rect.top + rect.height / 2 });
    };
    const hideTip = () => setTip(null);
    useEffect(() => {
        if (inMonitoring)
            setMonitoringOpen(true);
    }, [inMonitoring]);
    useEffect(() => {
        setTip(null);
        setMonitoringMenuOpen(false);
    }, [collapsed, pathname]);
    useEffect(() => {
        if (!open)
            return;
        const panel = panelRef.current;
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const focusables = () => Array.from(panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []).filter((element) => element.offsetParent !== null);
        focusables()[0]?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
                return;
            }
            if (event.key !== 'Tab')
                return;
            const nodes = focusables();
            if (nodes.length === 0)
                return;
            const first = nodes[0];
            const last = nodes[nodes.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            }
            else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        document.addEventListener('keydown', onKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
            previousFocus?.focus();
        };
    }, [open, onClose]);
    const childLink = (item: NavItem) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;
        return (<Link key={item.href} href={item.href} onClick={onClose} aria-current={active ? 'page' : undefined} className={cn('flex items-center gap-2.5 rounded-lg py-2 pl-11 pr-3 text-[13px] transition-colors', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', active
                ? 'bg-primary/[0.08] font-semibold text-primary'
                : 'font-medium text-charcoal-500 hover:bg-sage-100/50 hover:text-charcoal-900')}>
        <Icon aria-hidden className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-primary' : 'text-sage-500')}/>
        <span className="flex-1 truncate">{item.label}</span>
        
        {item.badgeCount != null && item.badgeCount > 0 && (<span aria-label={`${item.badgeCount} permintaan aktivasi toko menunggu`} className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold tabular-nums text-white">
            {item.badgeCount > 99 ? '99+' : item.badgeCount}
          </span>)}
      </Link>);
    };
    const navLink = (item: NavItem, compact: boolean) => {
        const active = isActivePath(pathname, item.href, item.exact);
        const Icon = item.icon;
        return (<Link key={item.href} href={item.href} onClick={onClose} aria-current={active ? 'page' : undefined} aria-label={compact ? item.label : undefined} onMouseEnter={compact ? (event) => showTip(event, item.label) : undefined} onMouseLeave={compact ? hideTip : undefined} onFocus={compact ? (event) => showTip(event, item.label) : undefined} onBlur={compact ? hideTip : undefined} className={cn('group relative flex items-center rounded-lg text-sm transition-colors', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', compact ? 'h-10 justify-center px-0' : 'gap-4 px-3 py-2.5', active
                ? 'bg-primary/[0.08] font-semibold text-primary'
                : 'font-medium text-charcoal-500 hover:bg-sage-100/50 hover:text-charcoal-900')}>
        
        {active && (<span aria-hidden className={cn('absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary', compact && 'h-6')}/>)}
        <Icon aria-hidden className={cn('h-[18px] w-[18px] shrink-0 transition-colors', active ? 'text-primary' : 'text-sage-500 group-hover:text-primary')}/>
        <span className={cn('flex-1 truncate', compact && 'sr-only')}>{item.label}</span>
        
        {item.badgeCount != null && item.badgeCount > 0 && (<span className={cn('flex shrink-0 items-center justify-center rounded-full bg-destructive font-bold text-white tabular-nums', compact
                    ? 'absolute right-1 top-1 h-4 min-w-4 px-1 text-[10px]'
                    : 'h-5 min-w-5 px-1.5 text-[11px]')} aria-label={item.badgeKind === 'decision'
                    ? `${item.badgeCount} permintaan role sudah diputuskan`
                    : item.badgeKind === 'store-activation'
                        ? `${item.badgeCount} permintaan aktivasi toko menunggu`
                        : item.badgeKind === 'shipment'
                            ? `${item.badgeCount} kiriman baru menunggu`
                            : item.badgeKind === 'support'
                                ? `${item.badgeCount} percakapan dengan pesan baru`
                                : `${item.badgeCount} permintaan menunggu`}>
            {item.badgeCount > 99 ? '99+' : item.badgeCount}
          </span>)}
      </Link>);
    };
    const content = (closeOnNav: boolean, compact: boolean) => (<div className="flex h-full min-h-0 flex-col overflow-hidden bg-admin-panel">
      
      <div className={cn('flex h-16 shrink-0 items-center', compact ? 'justify-center px-2' : 'gap-2.5 px-5')}>
        <Link href="/home" aria-label="Ke beranda ReBites" className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-black/5 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
          <Image src="/logo.avif" alt="ReBites" width={36} height={36} className="h-9 w-9 object-cover"/>
        </Link>
        {!compact && (<Link href="/home" className="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
            <p className="font-display text-lg font-semibold leading-none tracking-tight text-primary">ReBites</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sage-500">Panel Admin</p>
          </Link>)}
        <button type="button" onClick={onClose} aria-label="Tutup menu navigasi" className={cn('flex h-8 w-8 items-center justify-center rounded-full text-sage-500 transition-colors hover:bg-sage-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:hidden', compact && 'hidden')}>
          <X className="h-4 w-4"/>
        </button>
      </div>

      <nav className={cn('min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden overscroll-contain py-5', compact ? 'px-2' : 'px-3')} aria-label="Navigasi dashboard admin">
        <div>
          {!compact && (<p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-sage-500">Utama</p>)}
          <div className="space-y-1">
            {navLink({ label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard/admin', exact: true }, compact)}
            {navLink({ label: 'Moderasi', icon: ShieldCheck, href: '/dashboard/admin/moderasi', exact: true }, compact)}
            <div>
              <div className="flex items-center">
                {compact ? (<DropdownMenu open={monitoringMenuOpen} onOpenChange={(next) => {
                setMonitoringMenuOpen(next);
                if (next)
                    hideTip();
            }}>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label="Monitoring" aria-current={inMonitoring ? 'page' : undefined} onMouseEnter={(event) => showTip(event, 'Monitoring')} onMouseLeave={hideTip} onFocus={(event) => showTip(event, 'Monitoring')} onBlur={hideTip} className={cn('group flex h-10 w-full min-w-0 items-center justify-center rounded-lg px-0 text-sm transition-colors', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', inMonitoring
                ? 'bg-primary/[0.08] font-semibold text-primary'
                : 'font-medium text-charcoal-500 hover:bg-sage-100/50 hover:text-charcoal-900')}>
                        <Activity aria-hidden className={cn('h-[18px] w-[18px] shrink-0 transition-colors', inMonitoring ? 'text-primary' : 'text-sage-500 group-hover:text-primary')}/>
                        <span className="sr-only">Monitoring</span>
                      </button>
                    </DropdownMenuTrigger>
                    
                    <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-56">
                      {withActivationBadge(MONITORING_MENU).map((item) => {
                const Icon = item.icon;
                const active = isActivePath(pathname, item.href, item.exact);
                return (<DropdownMenuItem key={item.href} asChild>
                            <Link href={item.href} aria-current={active ? 'page' : undefined} className={cn('flex w-full items-center gap-2.5', active && 'bg-primary/[0.08] font-semibold text-primary')}>
                              <Icon aria-hidden className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-sage-500')}/>
                              <span className="flex-1 truncate">{item.label}</span>
                              {item.badgeCount != null && item.badgeCount > 0 && (<span aria-label={`${item.badgeCount} permintaan aktivasi toko menunggu`} className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold tabular-nums text-white">
                                  {item.badgeCount > 99 ? '99+' : item.badgeCount}
                                </span>)}
                            </Link>
                          </DropdownMenuItem>);
            })}
                    </DropdownMenuContent>
                  </DropdownMenu>) : (<Link href="/dashboard/admin/monitoring" onClick={closeOnNav ? onClose : undefined} aria-current={inMonitoring ? 'page' : undefined} className={cn('group flex min-w-0 flex-1 items-center gap-4 rounded-lg px-3 py-2.5 text-sm transition-colors', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', inMonitoring
                ? 'bg-primary/[0.08] font-semibold text-primary'
                : 'font-medium text-charcoal-500 hover:bg-sage-100/50 hover:text-charcoal-900')}>
                    <Activity aria-hidden className={cn('h-[18px] w-[18px] shrink-0 transition-colors', inMonitoring ? 'text-primary' : 'text-sage-500 group-hover:text-primary')}/>
                    <span className="flex-1 truncate">Monitoring</span>
                  </Link>)}
                
                {!compact && (<button type="button" onClick={() => setMonitoringOpen((v) => !v)} aria-label={monitoringOpen ? 'Tutup submenu monitoring' : 'Buka submenu monitoring'} aria-expanded={monitoringOpen} className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sage-500 transition-colors hover:bg-sage-100 hover:text-charcoal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                    <ChevronDown className={cn('h-4 w-4 transition-transform', monitoringOpen ? '' : '-rotate-90')}/>
                  </button>)}
              </div>
              {!compact && monitoringOpen && (<div className="mt-1 space-y-0.5">
                  {withActivationBadge(MONITORING_CHILDREN).map(childLink)}
                </div>)}
            </div>
            {!sellerStatusLoading && isSeller && (<div className="pt-1">
                {navLink({ label: 'Toko Saya', icon: Store, href: '/dashboard/penjual' }, compact)}
              </div>)}
          </div>
        </div>

        <div>
          {!compact && (<p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-sage-500">Kelola</p>)}
          <div className="space-y-1">
            {navLink({ label: 'Pengguna', icon: Users, href: '/dashboard/admin/pengguna' }, compact)}
            {navLink({ label: 'Permintaan Role', icon: UserCog, href: '/dashboard/admin/permintaan-role', badgeCount: roleBadgeCount, badgeKind: roleBadgeKind }, compact)}
            {navLink({ label: 'UMKM', icon: Store, href: '/dashboard/admin/umkm' }, compact)}
            {navLink({ label: 'Produk', icon: Package, href: '/dashboard/admin/produk' }, compact)}
            {navLink({ label: 'Pesanan', icon: ShoppingBag, href: '/dashboard/admin/pesanan' }, compact)}
            {navLink({
            label: 'Chat',
            icon: MessageSquare,
            href: '/dashboard/admin/chat',
            badgeCount: supportBadgeCount,
            badgeKind: 'support',
        }, compact)}
            {navLink({
            label: 'Pengiriman',
            icon: Truck,
            href: '/dashboard/admin/pengiriman',
            badgeCount: shipmentBadgeCount,
            badgeKind: 'shipment',
        }, compact)}
            {navLink({ label: 'Langganan', icon: CreditCard, href: '/dashboard/admin/langganan' }, compact)}
            {navLink({ label: 'ReBites Coin', icon: Coins, href: '/dashboard/admin/koin' }, compact)}
          </div>
        </div>

        <div>
          {!compact && (<p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-sage-500">Konten</p>)}
          <div className="space-y-1">
            {navLink({ label: 'Artikel', icon: Newspaper, href: '/dashboard/admin/artikel' }, compact)}
          </div>
        </div>

        <div>
          {!compact && (<p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-sage-500">Sistem</p>)}
          <div className="space-y-1">
            {navLink({ label: 'Performa Sistem', icon: Activity, href: '/dashboard/admin/system' }, compact)}
            {navLink({ label: 'Pengaturan', icon: Settings, href: '/dashboard/admin/pengaturan' }, compact)}
          </div>
        </div>
      </nav>

      
      <div className={cn('px-3 py-3', compact && 'px-2')}>
        <Link href="/home" onClick={closeOnNav ? onClose : undefined} aria-label={compact ? 'Lihat situs ReBites' : undefined} onMouseEnter={compact ? (event) => showTip(event, 'Lihat situs ReBites') : undefined} onMouseLeave={compact ? hideTip : undefined} onFocus={compact ? (event) => showTip(event, 'Lihat situs ReBites') : undefined} onBlur={compact ? hideTip : undefined} className={cn('flex items-center rounded-[var(--radius)] text-xs font-semibold text-sage-500 transition-colors hover:bg-sage-100/50 hover:text-charcoal-900', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', compact ? 'h-10 justify-center px-0' : 'gap-2.5 px-3 py-2')}>
          <ExternalLink aria-hidden className="h-4 w-4 shrink-0"/>
          <span className={cn('truncate', compact && 'sr-only')}>Lihat situs ReBites</span>
        </Link>

        <button type="button" onClick={onToggleCollapsed} aria-expanded={!collapsed} aria-label={collapsed ? 'Perbesar navigasi' : 'Perkecilkan navigasi'} aria-controls="admin-sidebar-desktop" className={cn('mt-1 hidden w-full items-center rounded-[var(--radius)] text-xs font-semibold text-sage-500 transition-colors hover:bg-sage-100/60 hover:text-charcoal-900', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:flex', compact ? 'h-10 justify-center px-0' : 'gap-2.5 px-3 py-2')}>
          {collapsed ? (<ChevronRight aria-hidden className="h-4 w-4 shrink-0"/>) : (<ChevronLeft aria-hidden className="h-4 w-4 shrink-0"/>)}
          <span className={cn('truncate', compact && 'sr-only')}>
            {collapsed ? 'Perbesar navigasi' : 'Perkecilkan navigasi'}
          </span>
        </button>
      </div>
    </div>);
    return (<>
      
      <AnimatePresence>
        {open && (<motion.div key="admin-drawer-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{
                duration: prefersReducedMotion ? 0.01 : 0.18,
                ease: 'linear',
            }} onClick={onClose} className="fixed inset-0 z-40 bg-charcoal-900/45 lg:hidden" aria-hidden/>)}

        {open && (<motion.aside key="admin-drawer-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Navigasi admin" initial={prefersReducedMotion ? { opacity: 0 } : { x: '-100%', opacity: 0.6 }} animate={prefersReducedMotion
                ? { opacity: 1, transition: { duration: 0.01 } }
                : {
                    x: 0,
                    opacity: 1,
                    transition: { duration: 0.26, ease: DRAWER_EASE },
                }} exit={prefersReducedMotion
                ? { opacity: 0, transition: { duration: 0.01 } }
                : {
                    x: '-100%',
                    opacity: 0.6,
                    transition: { duration: 0.18, ease: DRAWER_EASE },
                }} style={{ willChange: prefersReducedMotion ? undefined : 'transform' }} className="fixed inset-y-0 left-0 z-50 flex w-[264px] max-w-[85vw] flex-col bg-admin-panel shadow-admin-pop lg:hidden">
            {content(true, false)}
          </motion.aside>)}
      </AnimatePresence>

      
      <aside id="admin-sidebar-desktop" className="fixed inset-y-0 left-0 z-40 hidden w-[var(--admin-rail-w)] border-r border-border bg-admin-panel transition-[width] duration-200 ease-out motion-reduce:transition-none lg:block">
        {content(false, collapsed)}
      </aside>

      
      {collapsed && tip && !monitoringMenuOpen && (<div role="tooltip" className="pointer-events-none fixed left-[calc(var(--admin-rail-w)_+_0.5rem)] z-50 -translate-y-1/2 whitespace-nowrap rounded-md bg-charcoal-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-md motion-safe:animate-in motion-safe:fade-in-0" style={{ top: tip.top }}>
          {tip.label}
        </div>)}
    </>);
}
