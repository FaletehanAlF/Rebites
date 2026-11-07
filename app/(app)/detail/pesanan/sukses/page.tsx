import { Suspense } from 'react';
import type { Metadata } from 'next';
import { OrderSuccessView } from '@/app/components/checkout/order-success-view';
export const metadata: Metadata = {
    title: 'Pesanan Berhasil - ReBites',
};
export default function OrderSuccessPage() {
    return (<Suspense fallback={<main className="min-h-screen bg-secondary"/>}>
      <OrderSuccessView />
    </Suspense>);
}
