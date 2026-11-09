'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Menu, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRIMARY_NAV, isCurrentPath } from './nav-items';

/**
 * Anchor cepat di halaman Tentang Kami — dirender hanya ketika
 * `pathname` sesuai, memberikan lompatan langsung ke Visi atau Tim.
 */
const TENTANG_KAMI_ANCHORS: { label: string; href: string }[] = [
  { label: 'Visi & Misi', href: '/tentang-kami#visi-misi' },
  { label: 'Tim Leadership', href: '/tentang-kami#tim-leadership' },
];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Navbar situs publik: dipakai oleh kelima halaman di `app/(landing)/` dan
 * oleh pratinjau produk publik `/preview/product`.
 *
 * Navigasi utama menunjuk ke halaman nyata (`/tentang-kami`, `/fitur`, …),
 * bukan `#anchor`, dan halaman aktif ditandai lewat `usePathname()` sehingga
 * status aktif ikut berpindah bersama rute, bukan hasil tebakan scroll-spy.
 *
 * Selalu latar terang: hero seperti sebagian besar halaman duduk di permukaan
 * putih, jadi navbar tidak perlu membalik kontras mengikuti section di
 * belakangnya.
 */
export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Menu selalu tertutup setelah pindah halaman dan saat viewport melewati
  // breakpoint desktop, supaya tidak menyimpan state menu yang basi.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth >= 1024) setOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="border-b border-border bg-white">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:h-[72px] sm:px-6 lg:grid lg:grid-cols-[auto_1fr_auto] lg:gap-4 lg:px-8">
          <Link
            href="/"
            aria-label="ReBites — beranda"
            className="flex min-h-[44px] shrink-0 items-center gap-2.5"
          >
            <Image
              src="/logo.avif"
              alt=""
              width={36}
              height={36}
              priority
              className="h-9 w-9 rounded-full object-cover"
            />
            <span className="font-display text-xl font-semibold tracking-tight text-primary">
              Re<span className="font-light italic">Bites</span>
            </span>
          </Link>

          <nav aria-label="Navigasi utama" className="hidden lg:block">
            <ul className="flex items-center justify-center gap-3">
              {PRIMARY_NAV.map((item) => {
                const isActive = isCurrentPath(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'relative inline-flex min-h-[44px] items-center whitespace-nowrap px-2.5 py-2 font-secondary text-sm transition-colors duration-200',
                        isActive
                          ? 'font-semibold text-primary'
                          : 'text-muted-foreground hover:text-primary',
                        FOCUS_RING,
                      )}
                    >
                      {item.label}
                      <span
                        aria-hidden
                        className={cn(
                          'absolute inset-x-2.5 bottom-2 h-0.5 origin-left rounded-full bg-primary transition-transform duration-300',
                          isActive ? 'scale-x-100' : 'scale-x-0',
                        )}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Anchor cepat di halaman Tentang Kami — langsung ke Visi & Tim */}
            {pathname.startsWith('/tentang-kami') && (
              <ul className="mt-2 flex items-center justify-center gap-4 border-t border-border pt-2">
                {TENTANG_KAMI_ANCHORS.map((a) => (
                  <li key={a.href}>
                    <Link
                      href={a.href}
                      className="text-[12px] leading-none text-muted-foreground/80 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      {a.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/auth/login"
              aria-current={isCurrentPath(pathname, '/auth/login') ? 'page' : undefined}
              className={cn(
                'hidden min-h-[44px] items-center gap-1.5 rounded-full border border-border px-4 py-2 font-secondary text-sm font-semibold text-primary transition-colors duration-200 hover:border-primary hover:bg-secondary lg:inline-flex',
                isCurrentPath(pathname, '/auth/login') && 'border-primary bg-secondary',
                FOCUS_RING,
              )}
            >
              <User className="h-3.5 w-3.5" />
              Masuk
            </Link>

            <Link
              href="/auth/register"
              aria-current={isCurrentPath(pathname, '/auth/register') ? 'page' : undefined}
              className={cn(
                'group inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-secondary text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-dark sm:px-5',
                FOCUS_RING,
              )}
            >
              Daftar
              <ArrowRight
                className="hidden h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 sm:block"
                aria-hidden
              />
            </Link>

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-label={open ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
              aria-expanded={open}
              aria-controls="landing-mobile-menu"
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary transition-colors duration-200 hover:bg-secondary lg:hidden',
                FOCUS_RING,
              )}
            >
              {open ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:hidden">
        {open && (
          <div
            aria-hidden
            className="fixed inset-0 -z-10 bg-foreground/10 lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}
        <AnimatePresence initial={false}>
          {open && (
            <motion.nav
              id="landing-mobile-menu"
              aria-label="Navigasi utama"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="mt-2 overflow-hidden rounded-2xl border border-border bg-white p-2 shadow-[0_24px_48px_-28px_rgba(36,92,67,0.5)]"
            >
              <ul className="flex flex-col">
                {PRIMARY_NAV.map((item) => {
                  const isActive = isCurrentPath(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex min-h-[44px] items-center rounded-xl px-4 font-secondary text-sm transition-colors duration-200',
                          isActive
                            ? 'bg-secondary font-semibold text-primary'
                            : 'text-foreground hover:bg-secondary',
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
                {/* Anchor cepat di halaman Tentang Kami */}
                {pathname.startsWith('/tentang-kami') && (
                  <li className="border-t border-border pt-2 mt-1">
                    <div className="px-4 py-2 flex gap-4 text-xs text-muted-foreground/80">
                      {TENTANG_KAMI_ANCHORS.map((a) => (
                        <Link key={a.href} href={a.href}>{a.label}</Link>
                      ))}
                    </div>
                  </li>
                )}
              </ul>

              <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
                <Link
                  href="/auth/login"
                  aria-current={isCurrentPath(pathname, '/auth/login') ? 'page' : undefined}
                  className={cn(
                    'flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-border font-secondary text-sm font-semibold text-primary transition-colors duration-200 hover:border-primary hover:bg-secondary',
                    FOCUS_RING,
                  )}
                >
                  <User className="h-4 w-4" />
                  Masuk
                </Link>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
