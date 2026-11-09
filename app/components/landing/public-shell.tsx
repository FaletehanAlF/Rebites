import type { ReactNode } from 'react';
import { Preloader } from '@/app/components/landing/preloader';
import { LandingNavbar } from '@/app/components/landing/LandingNavbar';
import { LandingFooter } from '@/app/components/landing/LandingFooter';

export function PublicShell({
  children,
  intro = false,
}: {
  children: ReactNode;
  intro?: boolean;
}) {
  return (
    <>
      {intro && <Preloader />}
      <LandingNavbar />
      <main className='mt-3'>{children}</main>
      <LandingFooter />
    </>
  );
}
