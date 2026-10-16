import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CheckoutView } from '@/app/components/buyer/checkout/checkout-view';

export const metadata: Metadata = {
  title: 'Detail Pesanan - ReBites',
  description:
    'Selesaikan pesanan makanan surplus kamu, pilih ambil sendiri atau diantar.',
};

export default function DetailPesananPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-secondary" />}>
      <CheckoutView />
    </Suspense>
  );
}
