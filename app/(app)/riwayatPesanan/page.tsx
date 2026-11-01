import { Suspense } from 'react';
import type { Metadata } from 'next';
<<<<<<< HEAD
import { OrderHistoryView } from '@/app/components/order-history/order-history-view';
import { RiwayatSidebarShell } from '@/app/components/order-history/riwayat-sidebar-shell';
import { RequireAuth } from '@/app/components/auth/require-auth';
=======
import { OrderHistoryView } from '@/app/components/buyer/order-history/order-history-view';
import { RiwayatSidebarShell } from '@/app/components/buyer/order-history/riwayat-sidebar-shell';
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34

export const metadata: Metadata = {
  title: 'Pesanan Saya | ReBites',
  description:
    'Lacak pesanan yang sedang berlangsung dan lihat riwayat belanja makanan di ReBites.',
};

export default function OrderHistoryPage() {
  // RequireAuth di luar shell: navbar, judul halaman, dan skeleton TIDAK
  // ikut terlihat sebelum sesi valid (mencegah flash UI pra-redirect).
  return (
    <RequireAuth>
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
    </RequireAuth>
  );
}
