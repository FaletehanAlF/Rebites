import { Suspense } from 'react';
import type { Metadata } from 'next';
import { DetailProductContent } from '@/app/components/detail-product/detail-product-content';
import { LandingNavbar } from '@/app/components/landing/LandingNavbar';

export const metadata: Metadata = {
  title: 'Preview Produk - ReBites',
  description:
    'Pratinjau publik menu surplus dari UMKM pilihan di Depok — tanpa perlu masuk ke aplikasi ReBites.',
};

/**
 * The *public showcase* product detail route — the destination of every
 * product card on the landing page (`/`).
 *
 * It renders the exact same product content as `/detail/product`, but inside
 * the public shell: the landing navbar, related-product links that stay on
 * `/preview/product`, and "Lihat Semua" back to the landing catalog. No
 * profile navbar, no notifications, no account sidebar, no demo-user state —
 * a visitor who has never signed in sees a public presentation of ReBites.
 */
export default function PreviewProductPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-secondary" />}>
      <DetailProductContent
        shell={{
          header: <LandingNavbar />,
          productPath: '/preview/product',
          seeAllHref: '/#rekomendasi',
        }}
      />
    </Suspense>
  );
}
