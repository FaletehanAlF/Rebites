import { Suspense } from 'react';
import type { Metadata } from 'next';
import { OrderHistoryView } from '@/app/components/buyer/order-history/order-history-view';
import { RiwayatSidebarShell } from '@/app/components/buyer/order-history/riwayat-sidebar-shell';

export const metadata: Metadata = {
  title: 'Pesanan Saya | ReBites',
  description:
    'Lacak pesanan yang sedang berlangsung dan lihat riwayat belanja makanan di ReBites.',
};

export default function OrderHistoryPage() {
  return (
    <RiwayatSidebarShell>
      <Suspense
        fallback={
          <div className="space-y-5">
            <div className="h-14 w-56 animate-pulse rounded-xl bg-white ring-1 ring-border" />
            <div className="h-52 animate-pulse rounded-2xl bg-white ring-1 ring-border" />
          </div>
        }
      >
        <OrderHistoryView />
      </Suspense>
    </RiwayatSidebarShell>
  );
}
