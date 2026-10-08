import type { ReactNode } from 'react';
import { Preloader } from '@/app/components/preloader';
import { LandingNavbar } from '@/app/components/landing/LandingNavbar';
import { LandingFooter } from '@/app/components/landing/LandingFooter';

/**
 * Kerangka setiap halaman situs publik: navbar tetap di atas, `<main>` untuk
 * konten halaman, dan footer publik di bawah.
 *
 * Server Component — tidak ada klien JavaScript tambahan di sini; hanya
 * `intro` (preloader) yang berupa komponen klien, dan itu pun opsional
 * sehingga halaman pendukung tidak ikut memutar intro setiap kunjungan.
 */
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
      <main>{children}</main>
      <LandingFooter />
    </>
  );
}
