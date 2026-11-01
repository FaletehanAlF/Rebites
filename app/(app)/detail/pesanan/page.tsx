import { Suspense } from 'react';
import type { Metadata } from 'next';
<<<<<<< HEAD
import { CheckoutView } from '@/app/components/checkout/checkout-view';
import { BuyerShell } from '@/app/components/shared/buyer-shell';
=======
import { CheckoutView } from '@/app/components/buyer/checkout/checkout-view';
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34

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
