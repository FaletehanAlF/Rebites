import { Suspense } from 'react';
import type { Metadata } from 'next';
import { OrderSuccessView } from '@/app/components/buyer/checkout/order-success-view';
import { RequireAuth } from '@/app/components/auth/require-auth';

export const metadata: Metadata = {
  title: 'Pesanan Berhasil - ReBites',
};

export default function OrderSuccessPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<main className="min-h-screen bg-secondary" />}>
        <OrderSuccessView />
      </Suspense>
    </RequireAuth>
  );
}
