import { Suspense } from 'react';
import type { Metadata } from 'next';
import { DetailProductContent } from '@/app/components/detail-product/detail-product-content';

export const metadata: Metadata = {
  title: 'Detail Produk - ReBites',
  description:
    'Selamatkan porsi makanan surplus favoritmu langsung dari UMKM pilihan di Depok.',
};

/**
 * The *application* product detail route.
 *
 * The application shell (mobile navbar + profile navbar with notifications,
 * account sidebar and logout) is passed in here as the route's `shell`, not
 * baked into `detail-page.tsx`. That is what keeps `/preview/product` — the
 * public showcase route used by the landing page — free of account UI and out
 * of the supabase/auth bundle.
 */
export default function DetailProductPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-secondary" />}>
      <DetailProductContent
              shell={{
                buyerShell: true,
                productPath: '/detail/product',
                seeAllHref: '/home',
              }}
            />
    </Suspense>
  );
}
