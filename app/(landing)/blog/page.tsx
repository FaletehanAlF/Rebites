import type { Metadata } from 'next';
import { LandingNavbar } from '@/app/components/landing/LandingNavbar';
import { LandingFooter } from '@/app/components/landing/LandingFooter';

export const metadata: Metadata = {
  title: 'Blog - ReBites',
  description:
    'Blog ReBites: cerita dan edukasi seputar food waste, makanan surplus, dan perjuangan UMKM kuliner.',
};

/**
 * Halaman Blog — publik, konten menyusul.
 *
 * Kosong secara visual kecuali navbar dan footer landing; `<h1>` tersembunyi
 * menjaga struktur aksesibilitas (landmark + heading) tanpa mengisi halaman.
 */
export default function BlogPage() {
  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-white pt-16 sm:pt-[72px]">
        <h1 className="sr-only">Blog</h1>
      </main>
      <LandingFooter />
    </>
  );
}
