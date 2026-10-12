import type { ReactNode } from 'react';
import { LandingShell } from '@/app/components/landing/landing-shell';

export default function PublicSiteLayout({ children }: { children: ReactNode }) {
  return <LandingShell>{children}</LandingShell>;
}
