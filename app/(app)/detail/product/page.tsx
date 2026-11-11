import { Suspense } from 'react';
import type { Metadata } from 'next';
import { DetailProductContent } from '@/app/components/buyer/detail-product/detail-product-content';
import { RequireAuth } from '@/app/components/auth/require-auth';

export const metadata: Metadata = {
  title: 'Detail Produk - ReBites',
  description:
    'Selamatkan porsi makanan surplus favoritmu langsung dari UMKM pilihan di Depok.',
};

export default function DetailProductPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<div className="min-h-screen bg-secondary" />}>
        <DetailProductContent
          shell={{
            buyerShell: true,
            productPath: '/detail/product',
            seeAllHref: '/home',
          }}
        />
      </Suspense>
    </RequireAuth>
  );
}
