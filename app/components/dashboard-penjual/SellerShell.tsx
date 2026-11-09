'use client';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { notFound, useParams } from 'next/navigation';
import { MotionConfig } from 'framer-motion';
import { RefreshCw, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardDecor } from './decor';
import { SellerShellSkeleton } from './SellerShellSkeleton';
import { Sidebar, SELLER_CONTENT_OFFSET_CLASS } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileSellerNav } from './MobileSellerNav';
import { NotificationAlertPopup } from '@/app/components/notification/notification-alert-popup';
import { StoreDeactivatedNotice } from './store-deactivated-notice';
import { useRequireSeller } from '@/hooks/use-require-seller';
interface SellerShellProps {
    children: ReactNode;
}
export function SellerShell({ children }: SellerShellProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const { loading, status, errorMessage, retry, umkm } = useRequireSeller();
    const params = useParams<{
        storeId?: string;
    }>();
    useEffect(() => {
        try {
            setSidebarCollapsed(window.localStorage.getItem('rebites-seller-sidebar-collapsed') === '1');
        }
        catch {
            setSidebarCollapsed(false);
        }
    }, []);
    const toggleSidebarCollapsed = () => {
        setSidebarCollapsed((value) => {
            const next = !value;
            try {
                window.localStorage.setItem('rebites-seller-sidebar-collapsed', next ? '1' : '0');
            }
            catch {
            }
            return next;
        });
    };
    const routeStoreId = typeof params?.storeId === 'string' ? params.storeId : '';
    const storeId = umkm?.id ?? routeStoreId;
    const storeMismatch = Boolean(umkm && routeStoreId && routeStoreId !== umkm.id);
    if (loading) {
        return <SellerShellSkeleton />;
    }
    if (status === 'error') {
        return (<div className="flex min-h-screen items-center justify-center bg-secondary p-6">

        <div className="w-full max-w-md rounded-[var(--radius)] border border-border bg-white p-6 text-center shadow-admin-card">

          <WifiOff aria-hidden className="mx-auto h-10 w-10 text-destructive"/>

          <h1 className="mt-3 font-display text-lg font-semibold text-charcoal-900">

            Gagal memeriksa akses penjual

          </h1>

          <p className="mt-1.5 text-sm text-sage-500">

            {errorMessage ?? 'Tidak dapat memuat data toko. Coba lagi.'}

          </p>

          <button type="button" onClick={retry} className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">

            <RefreshCw aria-hidden className="h-4 w-4"/>

            Coba lagi

          </button>

        </div>

      </div>);
    }
    if (storeMismatch) {
        notFound();
    }
    return (<MotionConfig reducedMotion="user">

      <div className="relative min-h-screen bg-secondary font-sans text-foreground">

        <DashboardDecor />



        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} storeId={storeId} collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebarCollapsed}/>



        <div className={cn("relative z-10 transition-[padding] duration-200 ease-out", sidebarCollapsed
            ? SELLER_CONTENT_OFFSET_CLASS.collapsed
            : SELLER_CONTENT_OFFSET_CLASS.expanded)}>

          <Topbar onMenuClick={() => setSidebarOpen(true)} storeId={storeId}/>



          

          <StoreDeactivatedNotice />



          <main className="mx-auto max-w-[1400px] px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pb-0">

            {children}

          </main>



          


        </div>



        {!sidebarOpen && <MobileSellerNav storeId={storeId} />}



        

        <NotificationAlertPopup />

      </div>

    </MotionConfig>);
}
