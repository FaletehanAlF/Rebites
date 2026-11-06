import type { Metadata } from 'next';
import { LandingNavbar } from '@/app/components/landing/LandingNavbar';
import { LandingFooter } from '@/app/components/landing/LandingFooter';
import { BlogIndex } from '@/app/components/landing/blog-index';

export const metadata: Metadata = {
  title: 'Blog - ReBites',
  description:
    'Blog ReBites: cerita dan edukasi seputar food waste, makanan surplus, dan perjuangan UMKM kuliner.',
};

/**
 * Halaman Blog — publik. Daftar artikel published (terbaru dulu) dengan
 * pencarian, filter kategori, dan kartu featured untuk artikel teratas.
 */
export default function BlogPage() {
  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-secondary pt-16 sm:pt-[72px]">
        <BlogIndex />
      </main>
      <LandingFooter />
    </>
  );
}
