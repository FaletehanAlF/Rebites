import { Suspense } from 'react';
import type { Metadata } from 'next';
import { DetailProductContent } from '@/app/components/buyer/detail-product/detail-product-content';
import { LandingNavbar } from '@/app/components/landing/LandingNavbar';

export const metadata: Metadata = {
  title: 'Preview Produk - ReBites',
  description:
    'Pratinjau publik menu surplus dari UMKM pilihan di Depok — tanpa perlu masuk ke aplikasi ReBites.',
};

// Route detail produk showcase publik — tujuan semua kartu produk di landing
// (/). Konten sama persis dengan /detail/product, tapi memakai shell publik:
// navbar landing, link tetap di /preview/product, "Lihat Semua" kembali ke
// katalog landing. Tidak ada UI akun sama sekali.
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
