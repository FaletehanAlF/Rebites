'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronDown, Menu, User, X } from 'lucide-react';
import { cn } from '@/lib/utils'

type NavItem = { href: string; label: string };

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Beranda' },
  { href: '/blog', label: 'Blog' },
  { href: '/hubungi-kami', label: 'Hubungi Kami' },
];

/**
 * Item-item dropdown "Tentang Kami" — mengarah ke halaman `/tentang-kami`;
 * item pertama ke halaman utuh, sisanya langsung ke section (anchor).
 */
const ABOUT_ITEMS = [
  { href: '/tentang-kami', label: 'Tentang Kami' },
  { href: '/tentang-kami#visi-misi', label: 'Visi & Misi' },
  { href: '/tentang-kami#tim-leadership', label: 'Tim & Leadership' },
] as const;

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const NAV_LINK =
  'inline-flex px-3 py-2 font-secondary text-sm transition-colors duration-200';

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(NAV_LINK, 'text-muted-foreground hover:text-primary', FOCUS_RING)}
      >
        {label}
      </Link>
    </li>
  );
}

/**
 * Dropdown "Tentang Kami" di navbar desktop — pemicunya tombol yang membuka
 * panel putih membulat; item panel memuat link ke `/tentang-kami` (item
 * pertama) dan anchor section halaman Tentang Kami.
 */
function AboutDropdown() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLLIElement>(null);

  // Tutup dropdown saat berpindah route.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Klik di luar atau Escape menutup dropdown.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <li
      ref={containerRef}
      className="relative"
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="tentang-kami-menu"
        aria-label={open ? 'Tutup menu Tentang Kami' : 'Buka menu Tentang Kami'}
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        className={cn(NAV_LINK, 'items-center gap-1.5 text-muted-foreground', FOCUS_RING)}
      >
        Tentang Kami
        <ChevronDown
          aria-hidden
          className={cn(
            'h-4 w-4 text-current transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          // Pembungkus transparan: pt-3 menggantikan margin panel, supaya area
          // hover tetap tersambung dari tombol ke panel (dropdown tidak
          // tertutup saat mouse melintasi jarak).
          <div key="tentang-kami-panel" className="absolute left-0 top-full z-10 pt-3">
            <motion.div
              id="tentang-kami-menu"
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="w-[280px] rounded-2xl border border-border/80 bg-white p-2 shadow-[0_28px_56px_-30px_rgba(27,77,50,0.45)]"
            >
              <ul className="flex flex-col">
                {ABOUT_ITEMS.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'block rounded-xl px-4 py-3.5 font-secondary text-[15px] leading-none text-neutral-600 transition-colors duration-150',
                        FOCUS_RING,
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </li>
  );
}

/**
 * Public navigation bar for the ReBites showcase: the landing page, the
 * public pages that render it (`/tentang-kami`, `/blog`, `/hubungi-kami`) and
 * the public product preview (`/preview/product`).
 *
 * Deliberately always light (the hero, like most of the page, sits on a white
 * surface) so it never needs to flip contrast depending on the section behind
 * it. Menu items are plain route links; "Tentang Kami" is a dropdown of
 * section anchors within `/tentang-kami`. `usePathname()` only feeds
 * `aria-current` for screen readers — all items render in the same style.
 */
export function LandingNavbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Escape closes the mobile sheet; resizing to desktop closes it too so the
  // page never comes back with a stale, hidden menu state.
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

  // Tutup accordion "Tentang Kami" saat berpindah route.
  useEffect(() => {
    setAboutOpen(false);
  }, [pathname]);

  const isActive = (href: string) => pathname === href;

  // Beranda selalu pertama, "Tentang Kami" menyusul, sisanya di belakangnya.
  const leadingItems = NAV_ITEMS.filter((item) => item.href === '/');
  const trailingItems = NAV_ITEMS.filter((item) => item.href !== '/');

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className={cn(
          'border-b transition-all duration-300',
          scrolled
            ? 'border-border/80 bg-white/90 shadow-[0_12px_32px_-26px_rgba(27,77,50,0.55)] backdrop-blur-xl'
            : 'border-transparent bg-white/70 backdrop-blur-sm',
        )}
      >
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:h-[72px] sm:px-6 lg:px-8">
          <Link
            href="/"
            aria-label="ReBites — beranda"
            className="flex shrink-0 items-center gap-2.5"
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
              ReBites
            </span>
          </Link>

          <nav aria-label="Navigasi utama" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {leadingItems.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  active={isActive(item.href)}
                />
              ))}
              <AboutDropdown />
              {trailingItems.map((item) => (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  active={isActive(item.href)}
                />
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/auth/login"
              className={cn(
                'hidden items-center gap-1.5 rounded-full border border-border px-4 py-2 font-secondary text-sm font-semibold text-primary transition-colors duration-200 hover:border-primary hover:bg-secondary sm:inline-flex',
                FOCUS_RING,
              )}
            >
              <User className="h-3.5 w-3.5" />
              Masuk
            </Link>

            <Link
              href="/auth/register"
              className={cn(
                'group inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-secondary text-sm font-semibold text-white transition-colors duration-200 hover:bg-primary-dark sm:px-5',
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
              aria-label={open ? 'Tutup menu' : 'Buka menu'}
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
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id="landing-mobile-menu"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="mt-2 overflow-hidden rounded-2xl border border-border bg-white p-2 shadow-[0_24px_48px_-28px_rgba(27,77,50,0.5)]"
            >
              <ul className="flex flex-col">
                {leadingItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex min-h-[44px] items-center rounded-xl px-4 font-secondary text-sm transition-colors duration-200',
                          'text-foreground hover:bg-secondary',
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}

                <li>
                  <button
                    type="button"
                    onClick={() => setAboutOpen((value) => !value)}
                    aria-expanded={aboutOpen}
                    aria-controls="mobile-tentang-kami"
                    aria-label={aboutOpen ? 'Tutup menu Tentang Kami' : 'Buka menu Tentang Kami'}
                    className={cn(
                      'flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl px-4 text-left font-secondary text-sm text-foreground transition-colors duration-200',
                      FOCUS_RING,
                    )}
                  >
                    <span>Tentang Kami</span>
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        'h-4 w-4 text-current transition-transform duration-200',
                        aboutOpen && 'rotate-180',
                      )}
                    />
                  </button>

                  <AnimatePresence initial={false}>
                    {aboutOpen && (
                      <motion.ul
                        id="mobile-tentang-kami"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="overflow-hidden pl-9"
                      >
                        {ABOUT_ITEMS.map((item) => (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className="flex min-h-[44px] items-center rounded-xl px-4 font-secondary text-sm text-neutral-600 transition-colors duration-200"
                            >
                              {item.label}
                            </Link>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </li>

                {trailingItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex min-h-[44px] items-center rounded-xl px-4 font-secondary text-sm transition-colors duration-200',
                          'text-foreground hover:bg-secondary',
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
                <Link
                  href="/auth/login"
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-border font-secondary text-sm font-semibold text-primary transition-colors duration-200 hover:border-primary hover:bg-secondary',
                    FOCUS_RING,
                  )}
                >
                  <User className="h-4 w-4" />
                  Masuk
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
