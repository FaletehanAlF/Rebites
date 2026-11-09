'use client';
import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Skeleton } from '@/app/components/ui/skeleton';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopbar } from './admin-topbar';
import { AdminErrorState } from './admin-state';
import { ADMIN_SIDEBAR_COLLAPSED_KEY, syncAdminPreferencesFromServer } from '@/lib/admin-preferences';
import { useRequireAdmin } from '@/hooks/use-require-admin';
import { cn } from '@/lib/utils';
interface AdminShellProps {
    children: ReactNode;
}
const RAIL_EXPANDED = '264px';
const RAIL_COLLAPSED = '76px';
function ScrollToTopButton() {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const onScroll = () => setVisible(window.scrollY > 480);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);
    return (<button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Kembali ke atas halaman" aria-hidden={!visible} tabIndex={visible ? 0 : -1} className={cn('fixed bottom-5 right-5 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-admin-line/80 bg-admin-panel text-charcoal-700 shadow-admin-pop transition-all duration-200', 'hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40', visible
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-3 opacity-0')}>
      <ArrowUp aria-hidden className="h-4 w-4"/>
    </button>);
}
export function AdminShell({ children }: AdminShellProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { status, loading, errorMessage, retry } = useRequireAdmin();
    const [collapsed, setCollapsed] = useState<boolean | null>(null);
    useEffect(() => {
        try {
            setCollapsed(window.localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_KEY) === '1');
        }
        catch {
            setCollapsed(false);
        }
    }, []);
    useEffect(() => {
        void syncAdminPreferencesFromServer();
    }, []);
    const toggleCollapsed = useCallback(() => {
        setCollapsed((prev) => {
            const next = !prev;
            try {
                window.localStorage.setItem(ADMIN_SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
            }
            catch {
            }
            return next;
        });
    }, []);
    const railWidth = collapsed ? RAIL_COLLAPSED : RAIL_EXPANDED;
    if (loading) {
        return (<div className="flex min-h-screen flex-col bg-admin-canvas">
        <div className="sticky top-0 z-30 border-b border-border/60 bg-white/75 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Skeleton className="h-9 w-40 rounded-full bg-white/80 ring-1 ring-border/60"/>
            <Skeleton className="ml-auto h-9 w-9 rounded-full bg-white/80 ring-1 ring-border/60"/>
          </div>
        </div>
        <div role="status" aria-label="Memuat panel admin" className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 pt-6 sm:px-6 lg:px-8">
          <Skeleton className="h-9 w-64 rounded-full bg-white/70 ring-1 ring-border/50"/>
          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <div className="space-y-3 px-4 py-4">
              {[0, 1, 2, 3].map((i) => (<Skeleton key={i} className="h-10 w-full rounded-lg bg-white/70 ring-1 ring-border/50"/>))}
            </div>
          </div>
        </div>
      </div>);
    }
    if (status === 'error') {
        return (<div className="flex min-h-screen items-center justify-center bg-admin-canvas p-6">
        <div className="w-full max-w-md">
          <AdminErrorState title="Gagal memeriksa akses admin" message={errorMessage ?? 'Tidak dapat memeriksa status admin. Coba lagi.'} onRetry={retry}/>
        </div>
      </div>);
    }
    if (status !== 'admin') {
        return (<div className="flex min-h-screen flex-col bg-admin-canvas">
        <div className="sticky top-0 z-30 border-b border-border/60 bg-white/75 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Skeleton className="h-9 w-40 rounded-full bg-white/80 ring-1 ring-border/60"/>
          </div>
        </div>
        <div role="status" aria-label="Mengalihkan halaman" className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 pt-6 sm:px-6 lg:px-8">
          <Skeleton className="h-9 w-56 rounded-full bg-white/70 ring-1 ring-border/50"/>
          <Skeleton className="h-40 w-full rounded-2xl bg-white/70 ring-1 ring-border/50"/>
        </div>
      </div>);
    }
    return (<div className="flex min-h-screen flex-col overflow-x-clip bg-admin-canvas font-sans text-charcoal-900" style={{ '--admin-rail-w': railWidth } as CSSProperties}>
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} collapsed={collapsed === true} onToggleCollapsed={toggleCollapsed}/>

      
      <div className="flex min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-out motion-reduce:transition-none lg:pl-[var(--admin-rail-w)]">
        <AdminTopbar onMenuClick={() => setSidebarOpen(true)}/>

        <main className="min-h-0 flex-1">{children}</main>

        
      </div>

      <ScrollToTopButton />
    </div>);
}
