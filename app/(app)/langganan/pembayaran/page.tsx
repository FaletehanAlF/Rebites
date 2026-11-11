import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SubscriptionCheckoutView } from '@/app/components/seller/subscription/subscription-checkout-view';
import { RequireAuth } from '@/app/components/auth/require-auth';

export const metadata: Metadata = {
  title: 'Pembayaran Langganan | ReBites',
  description:
    'Selesaikan langganan paket penjual ReBites untuk mengaktifkan toko UMKM kamu.',
};

export default function SubscriptionPaymentPage() {
  return (
    <RequireAuth>
    <main className="min-h-screen bg-secondary px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-[980px]">
        <Suspense
          fallback={
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2">
                <div className="h-[420px] animate-pulse bg-white p-8">
                  <div className="h-6 w-32 rounded-full bg-muted" />
                  <div className="mt-6 space-y-3">
                    <div className="h-4 rounded-full bg-muted" />
                    <div className="h-4 rounded-full bg-muted" />
                  </div>
                </div>
                <div className="h-[420px] animate-pulse bg-muted p-8">
                  <div className="h-32 rounded-full bg-muted" />
                </div>
              </div>
            </div>
          }
        >
          <SubscriptionCheckoutView />
        </Suspense>
      </div>
    </main>
    </RequireAuth>
  );
}
