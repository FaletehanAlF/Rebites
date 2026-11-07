import type { Metadata } from 'next';
import { LandingNavbar } from '@/app/components/landing/LandingNavbar';
import { LandingFooter } from '@/app/components/landing/LandingFooter';
import { BandingForm } from '@/app/components/support/banding-form';
export const metadata: Metadata = {
    title: 'Ajukan Banding Akun | ReBites',
    description: 'Ajukan banding bila akun ReBites-mu diblokir atau ditangguhkan, tanpa perlu bisa login. Simpan kode banding untuk memantau statusnya.',
};
export default function BandingPage() {
    return (<>
      <LandingNavbar />
      <main className="bg-background pb-20 pt-28 sm:pt-32">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
          <BandingForm />
        </div>
      </main>
      <LandingFooter />
    </>);
}
