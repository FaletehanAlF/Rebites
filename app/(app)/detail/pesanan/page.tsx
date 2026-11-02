import { Suspense } from 'react';
import type { Metadata } from 'next';
import { CheckoutView } from '@/app/components/checkout/checkout-view';
import { BuyerShell } from '@/app/components/shared/buyer-shell';

export const metadata: Metadata = {
  title: 'Detail Pesanan - ReBites',
  description:
    'Selesaikan pesanan makanan surplus kamu, pilih ambil sendiri atau diantar.',
};

export default function DetailPesananPage() {
  return (
    <BuyerShell showBottomNav={false}>
      <Suspense fallback={<main className="min-h-screen bg-secondary" />}>
        <CheckoutView />
      </Suspense>
    </BuyerShell>
  );
}
