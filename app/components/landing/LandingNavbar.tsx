
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  ChevronDown,
  Menu,
  User,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRIMARY_NAV, isCurrentPath } from './nav-items';
import { MEGA_MENUS, type MegaMenuGroup } from './mega-menus';

const TENTANG_KAMI_ANCHORS: { label: string; href: string }[] = [
  { label: 'Visi & Misi', href: '/tentang-kami#visi-misi' },
  { label: 'Tim Leadership', href: '/tentang-kami#tim-leadership' },
];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const PANEL_TRANSITION = {
  initial: { opacity: 0, y: -6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
} as const;

function panelId(
  group: MegaMenuGroup,
  variant: 'desktop' | 'mobile',
): string {
  return `mega-panel-${variant}-${group.id}`;
}

export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);

  const pathname = usePathname();

  const headerRef = useRef<HTMLElement | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoverTimeout = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  const closeMegaMenu = useCallback(() => {
    clearHoverTimeout();
    setOpenGroup(null);
  }, [clearHoverTimeout]);

  const openMegaMenu = useCallback(
    (id: string) => {
      clearHoverTimeout();
      setOpenGroup(id);
    },
    [clearHoverTimeout],
  );

  const onTriggerEnter = useCallback(
    (event: React.PointerEvent, id: string) => {
      if (event.pointerType !== 'mouse') return;

      clearHoverTimeout();
      setOpenGroup(id);
    },
    [clearHoverTimeout],
  );

  const onTriggerLeave = useCallback(
    (event: React.PointerEvent) => {
      if (event.pointerType !== 'mouse') return;

      clearHoverTimeout();

      // Beri waktu pointer berpindah dari trigger ke panel.
      hoverTimeoutRef.current = setTimeout(() => {
        setOpenGroup(null);
        hoverTimeoutRef.current = null;
      }, 200);
    },
    [clearHoverTimeout],
  );

  const onToggleGroup = useCallback(
    (id: string) => {
      clearHoverTimeout();

      setOpenGroup((current) => (current === id ? null : id));
    },
    [clearHoverTimeout],
  );

  // Reset menu saat berpindah halaman.
  useEffect(() => {
    closeMegaMenu();
    setOpen(false);
    setOpenMobileGroup(null);
  }, [pathname, closeMegaMenu]);

  // Escape dan resize.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        closeMegaMenu();
        setOpenMobileGroup(null);
      }
    };

    const onResize = () => {
      if (window.innerWidth >= 1024) {
        setOpen(false);
        setOpenMobileGroup(null);
      } else {
        closeMegaMenu();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [closeMegaMenu]);

  // Klik di luar navbar menutup mega-menu.
  useEffect(() => {
    if (!openGroup) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;

      if (!target || !headerRef.current) return;

      if (!headerRef.current.contains(target)) {
        closeMegaMenu();
      }
    };

    document.addEventListener('pointerdown', onPointerDown, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [openGroup, closeMegaMenu]);

  // Bersihkan timer ketika komponen dilepas.
  useEffect(() => {
    return () => clearHoverTimeout();
  }, [clearHoverTimeout]);

  return (
    <header ref={headerRef} className="fixed inset-x-0 top-0 z-50">
      <div className="border-b border-border bg-white">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:h-[72px] sm:px-6 lg:grid lg:grid-cols-[auto_1fr_auto] lg:gap-4 lg:px-8">

          {/* Logo */}
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

          {/* Desktop Navigation */}
          <nav aria-label="Navigasi utama" className="hidden lg:block">
            <ul className="flex items-center justify-center gap-3">
              {PRIMARY_NAV.map((item) => {
                const isActive = isCurrentPath(pathname, item.href);

                const menu = MEGA_MENUS.find(
                  (group) => group.triggerLabel === item.label,
                );

                const isGroupOpen = openGroup === menu?.id;

                return (
                  <li key={item.href} className="relative">

                    {menu ? (
                      /*
                       * PENTING:
                       * Trigger dan dropdown berada dalam satu wrapper.
                       * Pointer tidak dianggap meninggalkan area saat
                       * bergerak dari tombol menuju dropdown.
                       */
                      <div
                        className="relative"
                        onPointerEnter={(event) =>
                          onTriggerEnter(event, menu.id)
                        }
                        onPointerLeave={onTriggerLeave}
                        onFocus={() => openMegaMenu(menu.id)}
                      >
                        {/* Trigger */}
                        <button
                          type="button"
                          onClick={() => onToggleGroup(menu.id)}
                          aria-expanded={isGroupOpen}
                          aria-haspopup="true"
                          aria-controls={panelId(menu, 'desktop')}
                          className={cn(
                            'relative inline-flex min-h-[44px] items-center gap-1 whitespace-nowrap px-2.5 py-2 font-secondary text-sm transition-colors duration-200',
                            isActive
                              ? 'font-semibold text-primary'
                              : 'text-muted-foreground hover:text-primary',
                            FOCUS_RING,
                          )}
                        >
                          {item.label}

                          <ChevronDown
                            aria-hidden
                            className={cn(
                              'h-3.5 w-3.5 transition-transform duration-200',
                              isGroupOpen && 'rotate-180',
                            )}
                          />
                        </button>

                        {/* Mega Menu */}
                        <AnimatePresence>
                          {isGroupOpen && (
                            <motion.div
                              key={menu.id}
                              id={panelId(menu, 'desktop')}
                              data-mega-panel
                              initial={PANEL_TRANSITION.initial}
                              animate={PANEL_TRANSITION.animate}
                              exit={PANEL_TRANSITION.exit}
                              transition={{
                                duration: 0.18,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                              className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2"
                            >
                              <div
                                role="group"
                                aria-label={menu.panelTitle}
                                className="w-[22rem] rounded-xl border border-border bg-white p-2 shadow-[0_24px_48px_-28px_rgba(36,92,67,0.5)]"
                              >
                                {menu.groupLabel && (
                                  <p className="px-3 pb-1 pt-2 font-secondary text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                    {menu.groupLabel}
                                  </p>
                                )}

                                <ul className="flex flex-col">
                                  {menu.items.map((link) => {
                                    const Icon = link.icon;

                                    return (
                                      <li key={link.href}>
                                        <Link
                                          href={link.href}
                                          onClick={closeMegaMenu}
                                          className={cn(
                                            'flex items-start gap-3 rounded-lg p-3 transition-colors duration-150 hover:bg-secondary',
                                            FOCUS_RING,
                                          )}
                                        >
                                          {Icon && (
                                            <span
                                              aria-hidden
                                              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent"
                                            >
                                              <Icon className="h-4 w-4 text-primary" />
                                            </span>
                                          )}

                                          <span className="min-w-0">
                                            <span className="block font-secondary text-sm font-semibold text-foreground">
                                              {link.label}
                                            </span>

                                            <span className="mt-1 block text-xs leading-[1.6] text-muted-foreground">
                                              {link.description}
                                            </span>
                                          </span>
                                        </Link>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ) : (
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
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Desktop Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/auth/login"
              aria-current={
                isCurrentPath(pathname, '/auth/login') ? 'page' : undefined
              }
              className={cn(
                'hidden min-h-[44px] items-center gap-1.5 rounded-full border border-border px-4 py-2 font-secondary text-sm font-semibold text-primary transition-colors duration-200 hover:border-primary hover:bg-secondary lg:inline-flex',
                isCurrentPath(pathname, '/auth/login') &&
                'border-primary bg-secondary',
                FOCUS_RING,
              )}
            >
              <User className="h-3.5 w-3.5" />
              Masuk
            </Link>

            <Link
              href="/auth/register"
              aria-current={
                isCurrentPath(pathname, '/auth/register') ? 'page' : undefined
              }
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

            {/* Mobile Toggle */}
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-label={
                open ? 'Tutup menu navigasi' : 'Buka menu navigasi'
              }
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

      {/* Mobile Navigation */}
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
              transition={{
                duration: 0.22,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-2 overflow-hidden rounded-2xl border border-border bg-white p-2 shadow-[0_24px_48px_-28px_rgba(36,92,67,0.5)]"
            >
              <ul className="flex flex-col">
                {PRIMARY_NAV.map((item) => {
                  const isActive = isCurrentPath(pathname, item.href);

                  const menu = MEGA_MENUS.find(
                    (group) => group.triggerLabel === item.label,
                  );

                  const isGroupOpen = openMobileGroup === menu?.id;

                  return (
                    <li key={item.href}>
                      {menu ? (
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMobileGroup((current) =>
                              current === menu.id ? null : menu.id,
                            )
                          }
                          aria-expanded={isGroupOpen}
                          aria-controls={panelId(menu, 'mobile')}
                          className={cn(
                            'flex min-h-[44px] w-full items-center justify-between rounded-xl px-4 font-secondary text-sm transition-colors duration-200',
                            isActive
                              ? 'bg-secondary font-semibold text-primary'
                              : 'text-foreground hover:bg-secondary',
                            FOCUS_RING,
                          )}
                        >
                          {item.label}

                          <ChevronDown
                            aria-hidden
                            className={cn(
                              'h-4 w-4 transition-transform duration-200',
                              isGroupOpen && 'rotate-180',
                            )}
                          />
                        </button>
                      ) : (
                        <Link
                          href={item.href}
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => setOpen(false)}
                          className={cn(
                            'flex min-h-[44px] items-center rounded-xl px-4 font-secondary text-sm transition-colors duration-200',
                            isActive
                              ? 'bg-secondary font-semibold text-primary'
                              : 'text-foreground hover:bg-secondary',
                            FOCUS_RING,
                          )}
                        >
                          {item.label}
                        </Link>
                      )}

                      {menu && (
                        <div
                          id={panelId(menu, 'mobile')}
                          className={cn(
                            'overflow-hidden transition-[max-height] duration-300',
                            isGroupOpen ? 'max-h-60' : 'max-h-0',
                          )}
                        >
                          <ul className="flex flex-col border-l border-border pl-4">
                            {menu.items.map((link) => (
                              <li key={link.href}>
                                <Link
                                  href={link.href}
                                  onClick={() => setOpen(false)}
                                  className="flex min-h-[44px] items-center rounded-xl px-4 font-secondary text-sm text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-primary"
                                >
                                  {link.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}

                {/* Anchor halaman Tentang Kami */}
                {pathname.startsWith('/tentang-kami') && (
                  <li className="mt-1 border-t border-border pt-2">
                    <div className="flex flex-wrap gap-4 px-4 py-2 text-xs text-muted-foreground/80">
                      {TENTANG_KAMI_ANCHORS.map((anchor) => (
                        <Link
                          key={anchor.href}
                          href={anchor.href}
                          onClick={() => setOpen(false)}
                        >
                          {anchor.label}
                        </Link>
                      ))}
                    </div>
                  </li>
                )}
              </ul>

              {/* Mobile Actions */}
              <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
                <Link
                  href="/auth/login"
                  aria-current={
                    isCurrentPath(pathname, '/auth/login') ? 'page' : undefined
                  }
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
            </motion.nav>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
