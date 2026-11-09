import type { Metadata } from 'next';
import { LandingNavbar } from '@/app/components/landing/LandingNavbar';
import { LandingFooter } from '@/app/components/landing/LandingFooter';
import { ArtikelDetailView } from '@/app/components/artikel/artikel-detail-view';

export const metadata: Metadata = {
  title: 'Artikel - ReBites',
  description:
    'Artikel ReBites tentang makanan surplus, food waste, dan perjalanan UMKM kuliner.',
};

/**
 * Detail artikel versi landing — dipakai tautan dari halaman Blog supaya
 * pembaca yang datang dari halaman publik tetap berada di cangkang landing
 * (navbar + footer landing), bukan cangkang aplikasi pembeli.
 */
export default function BlogArticlePage({
  params,
}: {
  params: { slug: string };
}) {
  const slug = typeof params.slug === 'string' ? params.slug : '';
  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-secondary pb-20 pt-16 sm:pb-24 sm:pt-[72px]">
        <ArtikelDetailView slug={slug} backHref="/blog" backLabel="Kembali ke Blog" />
      </main>
      <LandingFooter />
    </>
  );
}
