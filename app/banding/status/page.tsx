import type { Metadata } from 'next';
import { LandingNavbar } from '@/app/components/landing/LandingNavbar';
import { LandingFooter } from '@/app/components/landing/LandingFooter';
import { BandingStatus } from '@/app/components/support/banding-status';
export const metadata: Metadata = {
    title: 'Status Banding Akun | ReBites',
    description: 'Cek status banding akun ReBites dengan kode banding yang kamu simpan, dan kirim keterangan tambahan untuk admin.',
};
export default function BandingStatusPage() {
    return (<>
      <LandingNavbar />
      <main className="bg-background pb-20 pt-28 sm:pt-32">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
          <BandingStatus />
        </div>
      </main>
      <LandingFooter />
    </>);
}
