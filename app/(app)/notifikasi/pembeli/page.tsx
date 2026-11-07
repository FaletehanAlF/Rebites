import { Suspense } from 'react';
import type { Metadata } from 'next';
import { BuyerNotificationView } from '@/app/components/notification/buyer-notification-view';
import { NotificationSidebarShell } from '@/app/components/notification/notification-shell';
import { RequireAuth } from '@/app/components/auth/require-auth';
import { Skeleton } from '@/app/components/ui/skeleton';
export const metadata: Metadata = {
    title: 'Notifikasi | ReBites',
    description: 'Lihat notifikasi pesanan dan promosi untuk pembeli ReBites.',
};
export default function BuyerNotificationPage() {
    return (<RequireAuth>
      <NotificationSidebarShell>
        <Suspense fallback={<div role="status" aria-label="Memuat notifikasi" className="space-y-4">
              <Skeleton className="h-10 w-48 rounded-xl"/>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-16 rounded-full"/>
                <Skeleton className="h-9 w-20 rounded-full"/>
              </div>
              {[1, 2, 3].map((i) => (<Skeleton key={i} className="h-24 rounded-2xl"/>))}
            </div>}>
          <BuyerNotificationView />
        </Suspense>
      </NotificationSidebarShell>
    </RequireAuth>);
}
