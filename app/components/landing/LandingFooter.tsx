'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUp, Mail } from 'lucide-react';
import { handleSectionLinkClick } from '@/app/components/landing/scroll-to-section';
import { PRIMARY_NAV } from '@/app/components/landing/nav-items';

type FooterLink = { label: string; href: string; sectionId?: string };

/** Ke halaman aplikasi: tempat pengunjung benar-benar bisa mulai memakai ReBites. */
const PRODUCT_LINKS: FooterLink[] = [
  { label: 'Jelajahi makanan', href: '/home' },
  { label: 'Membership', href: '/#langganan', sectionId: 'langganan' },
  { label: 'Masuk', href: '/auth/login' },
];

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.2c3.2 0 3.6.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.26.07 1.66.07 4.85s-.01 3.6-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.26.06-1.66.07-4.85.07s-3.6-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.2 15.6 2.2 15.2 2.2 12s.01-3.6.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.4 2.2 8.8 2.2 12 2.2Zm0 4.47a5.33 5.33 0 1 0 0 10.66 5.33 5.33 0 0 0 0-10.66Zm0 2.2a3.13 3.13 0 1 1 0 6.26 3.13 3.13 0 0 1 0-6.26Zm5.54-3.14a1.24 1.24 0 1 0 0 2.49 1.24 1.24 0 0 0 0-2.49Z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.3 0 .58.05.85.13V9.4a6.33 6.33 0 0 0-.85-.06 6.34 6.34 0 1 0 6.34 6.34V8.33a8.16 8.16 0 0 0 4.77 1.52V6.4c-.22 0-.43.02-.65.04l.65-.49V6.69Z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.1 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.9h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.9 2.7h3.3l-7.2 8.2 8.5 11.2h-6.6l-5.2-6.8-6 6.8H2.4l7.7-8.8L2 2.7h6.8l4.7 6.2 5.4-6.2Zm-1.15 17.5h1.84L7.8 4.5H5.82l11.93 15.7Z" />
    </svg>
  );
}

const SOCIALS = [
  { label: 'Instagram', href: 'https://instagram.com/rebites', Icon: InstagramIcon },
  { label: 'TikTok', href: 'https://tiktok.com/@rebites', Icon: TikTokIcon },
  { label: 'Facebook', href: 'https://facebook.com/rebites', Icon: FacebookIcon },
  { label: 'X', href: 'https://x.com/rebites', Icon: XIcon },
];

function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 560);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        const lenis = window.__lenis;
        if (lenis) lenis.scrollTo(0, { duration: 1 });
        else window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
      aria-label="Kembali ke atas"
      tabIndex={visible ? 0 : -1}
      className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition-all duration-300 hover:bg-white hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary ${
        visible
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <ArrowUp className="h-5 w-5" aria-hidden />
    </button>
  );
}

/**
 * Footer situs publik. Sengaja ringkas: identitas + kanal kontak, navigasi
 * halaman yang sama persis dengan navbar, dan tiga tautan menuju produk.
 * Sitemap aplikasi tidak dicantumkan — semuanya masih bisa dicapai lewat
 * aplikasi itu sendiri.
 */
export function LandingFooter() {
  const columns: { title: string; links: FooterLink[] }[] = [
    { title: 'Navigasi', links: PRIMARY_NAV },
    { title: 'ReBites', links: PRODUCT_LINKS },
  ];

  return (
    <footer className="grain-overlay bg-primary text-primary-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-14 sm:px-6 sm:pt-16 lg:px-8 lg:pt-20">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.7fr_1fr_1fr] lg:gap-8">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              aria-label="ReBites — beranda"
              className="inline-flex min-h-[44px] items-center gap-2.5"
            >
              <Image
                src="/logo.png"
                alt=""
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-cover ring-1 ring-white/20"
              />
              <span className="font-display text-2xl font-semibold tracking-tight text-white">
                Re<span className="font-light italic">Bites</span>
              </span>
            </Link>

            <p className="mt-4 max-w-sm text-sm leading-[1.75] text-white/70">
              Marketplace makanan surplus yang masih layak konsumsi dari pelaku
              UMKM — agar makanan berakhir di piring, bukan di tempat sampah.
            </p>

            <a
              href="mailto:halo@rebites.id"
              className="mt-5 inline-flex min-h-[40px] items-center gap-2 text-sm text-white/70 transition-colors duration-300 hover:text-white"
            >
              <Mail className="h-4 w-4 shrink-0" aria-hidden />
              halo@rebites.id
            </a>

            <ul className="mt-4 flex flex-wrap items-center gap-2.5">
              {SOCIALS.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white/80 transition-colors duration-300 hover:border-white/40 hover:bg-white/10 hover:text-white"
                  >
                    <Icon className="h-[17px] w-[17px]" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                {column.title}
              </p>
              <ul className="mt-4 space-y-1">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      onClick={
                        link.sectionId
                          ? (event) =>
                              handleSectionLinkClick(event, link.sectionId as string)
                          : undefined
                      }
                      className="inline-flex min-h-[40px] items-center text-sm text-white/70 transition-colors duration-300 hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col-reverse items-center gap-5 border-t border-white/10 pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-center text-xs leading-relaxed text-white/70 sm:text-left">
            © {new Date().getFullYear()} ReBites. Dibuat oleh{' '}
            <span className="text-white/80">Tim Sixquit</span> — SMK Taruna
            Bhakti.
          </p>

          <BackToTop />
        </div>
      </div>
    </footer>
  );
}
