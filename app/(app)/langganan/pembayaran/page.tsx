import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SubscriptionCheckoutView } from '@/app/components/subscription/subscription-checkout-view';
import { Skeleton } from '@/app/components/ui/skeleton';
export const metadata: Metadata = {
    title: 'Pembayaran Langganan | ReBites',
    description: 'Selesaikan langganan paket penjual ReBites untuk mengaktifkan toko UMKM kamu.',
};
export default function SubscriptionPaymentPage() {
    return (<main className="min-h-screen bg-secondary px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-[980px]">
        <Suspense fallback={<div role="status" aria-label="Memuat halaman pembayaran" className="overflow-hidden rounded-[20px] bg-white shadow-[0_24px_64px_rgba(0,0,0,0.14)]">
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="space-y-3 bg-white p-8">
                  <Skeleton className="h-6 w-32 rounded-lg"/>
                  <Skeleton className="h-4 w-full rounded-full"/>
                  <Skeleton className="h-4 w-full rounded-full"/>
                  <Skeleton className="mt-6 h-[46px] w-full rounded-full"/>
                </div>
                <div className="space-y-4 bg-white p-8">
                  <Skeleton className="h-32 rounded-2xl"/>
                  <Skeleton className="h-32 rounded-2xl"/>
                </div>
              </div>
            </div>}>
          <SubscriptionCheckoutView />
        </Suspense>
      </div>
    </main>);
}
