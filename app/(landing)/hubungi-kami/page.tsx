import type { Metadata } from 'next';
import { LandingNavbar } from '@/app/components/landing/LandingNavbar';
import { LandingFooter } from '@/app/components/landing/LandingFooter';
import { FAQSection } from '@/app/components/landing/FAQSection';
import { FinalCTASection } from '@/app/components/landing/FinalCTASection';

export const metadata: Metadata = {
  title: 'Hubungi Kami - ReBites',
  description:
    'Hubungi tim ReBites untuk pertanyaan, kerja sama, atau dukungan seputar marketplace makanan surplus UMKM.',
};

/**
 * Halaman Hubungi Kami — publik, konten menyusul.
 *
 * Kosong secara visual kecuali navbar dan footer landing; `<h1>` tersembunyi
 * menjaga struktur aksesibilitas (landmark + heading) tanpa mengisi halaman.
 */
export default function HubungiKamiPage() {
  return (
    <>
      <LandingNavbar />
      <main className="min-h-screen bg-white pt-16 sm:pt-[72px]">
        <h1 className="sr-only">Hubungi Kami</h1>
          <FAQSection />
          <FinalCTASection />
      </main>
      <LandingFooter />
    </>
  );
}
