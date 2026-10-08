import type { ReactNode } from 'react';
import { LandingShell } from '@/app/components/landing/landing-shell';

/**
 * Route group untuk situs publik ReBites: `/`, `/tentang-kami`, `/fitur`,
 * `/dampak`, `/hubungi-kami` dan `/preview/product`.
 *
 * Layout ini hanya membungkus client boundary bersama (framer-motion
 * `MotionConfig` + Lenis). Navbar, `<main>`, dan footer tetap dimiliki
 * masing-masing halaman lewat `PublicShell`, karena `/preview/product`
 * memasang navbar-nya sendiri lewat prop `shell` pada detail produk.
 *
 * Preloader sengaja tidak ada di sini: intro hanya layak sekali jalan di
 * halaman utama, bukan setiap kali pengunjung membuka halaman pendukung.
 */
export default function PublicSiteLayout({ children }: { children: ReactNode }) {
  return <LandingShell>{children}</LandingShell>;
}
