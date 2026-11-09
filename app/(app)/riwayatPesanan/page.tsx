import { Suspense } from 'react';
import type { Metadata } from 'next';
import { OrderHistoryView } from '@/app/components/order-history/order-history-view';
import { RiwayatSidebarShell } from '@/app/components/order-history/riwayat-sidebar-shell';
import { RequireAuth } from '@/app/components/auth/require-auth';
import { Skeleton } from '@/app/components/ui/skeleton';
export const metadata: Metadata = {
    title: 'Pesanan Saya | ReBites',
    description: 'Lacak pesanan yang sedang berlangsung dan lihat riwayat belanja makanan di ReBites.',
};
export default function OrderHistoryPage() {
    return (<RequireAuth>

      <RiwayatSidebarShell>

        <Suspense fallback={<div role="status" aria-label="Memuat riwayat pesanan" className="space-y-5">

              <Skeleton className="h-14 w-56 rounded-xl"/>

              <Skeleton className="h-52 rounded-2xl"/>

            </div>}>

          <OrderHistoryView />

        </Suspense>

      </RiwayatSidebarShell>

    </RequireAuth>);
}
