'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Menu, User, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scrollToSection } from '@/app/components/landing/scroll-to-section';

type NavItem = { id: string; label: string };

const NAV_ITEMS: NavItem[] = [
  { id: 'rekomendasi', label: 'Jelajahi' },
  { id: 'cara-kerja', label: 'Cara Kerja' },
  { id: 'umkm', label: 'Untuk Penjual' },
  { id: 'pembeli', label: 'Untuk Pembeli' },
  { id: 'faq', label: 'FAQ' },
];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Sticky landing navbar. Deliberately always light (the hero, like most of the
 * page, sits on a white surface) so it never needs to flip contrast depending
 * on the section behind it — the previous navbar probed `[data-nav]` on every
 * scroll frame to solve exactly that.
 */
export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState('');

  // One rAF-coalesced pass per scroll frame: reads at most `NAV_ITEMS.length`
  // rects instead of forcing layout work on every scroll event.
  useEffect(() => {
    let rafId: number | null = null;

    const update = () => {
      rafId = null;
      setScrolled(window.scrollY > 12);

      let current = '';
      for (const item of NAV_ITEMS) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= 160) current = item.id;
      }
      setActive(current);
    };

    const schedule = () => {
      if (rafId == null) rafId = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
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

  const handleJump = (
    event: React.MouseEvent<HTMLAnchorElement>,
    id: string,
  ) => {
    event.preventDefault();
    setOpen(false);
    setActive(id);
    scrollToSection(id);
  };

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
              Re<span className="font-light italic">Bites</span>
            </span>
          </Link>

          <nav aria-label="Navigasi utama" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => {
                const isActive = active === item.id;
                return (
                  <li key={item.id}>
                    <Link
                      href={`/#${item.id}`}
                      onClick={(event) => handleJump(event, item.id)}
                      aria-current={isActive ? 'true' : undefined}
                      className={cn(
                        'relative inline-flex px-3 py-2 font-secondary text-sm transition-colors duration-200',
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
                          'absolute inset-x-3 bottom-1 h-0.5 origin-left rounded-full bg-primary transition-transform duration-300',
                          isActive ? 'scale-x-100' : 'scale-x-0',
                        )}
                      />
                    </Link>
                  </li>
                );
              })}
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
                {NAV_ITEMS.map((item) => {
                  const isActive = active === item.id;
                  return (
                    <li key={item.id}>
                      <Link
                        href={`/#${item.id}`}
                        onClick={(event) => handleJump(event, item.id)}
                        aria-current={isActive ? 'true' : undefined}
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
