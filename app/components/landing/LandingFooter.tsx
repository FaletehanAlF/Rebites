'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUp, Mail } from 'lucide-react';
import { handleSectionLinkClick } from '@/app/components/landing/scroll-to-section';

type FooterLink = { label: string; href: string; sectionId?: string };

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
      className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-white text-muted-foreground shadow-sm transition-all duration-300 hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
        }`}
    >
      <ArrowUp className="h-4 w-4" aria-hidden />
    </button>
  );
}

export function LandingFooter() {
  const columns: { title: string; links: FooterLink[] }[] = [
    {
      title: 'Jelajahi',
      links: [
        { label: 'Beranda', href: '/' },
        { label: 'Jelajahi makanan', href: '/home' },
        { label: 'Fitur unggulan', href: '/fitur' },
        { label: 'Dampak lingkungan', href: '/dampak' },
      ],
    },
    {
      title: 'Tentang',
      links: [
        { label: 'Tentang Kami', href: '/tentang-kami' },
        { label: 'Visi & Misi', href: '/tentang-kami#visi-misi' },
        { label: 'Tim Kami', href: '/tentang-kami#tim-leadership' },
      ],
    },
    {
      title: 'Akun & Layanan',
      links: [
        { label: 'Masuk', href: '/auth/login' },
        { label: 'Daftar akun', href: '/auth/register' },
        { label: 'Gabung sebagai UMKM', href: '/auth/register/penjual' },
      ],
    },
    {
      title: 'Bantuan',
      links: [
        { label: 'Hubungi Kami', href: '/hubungi-kami' },
      ],
    },
  ];

  return (
    <footer className="relative overflow-hidden bg-white text-foreground border-t border-border/40">
      {/* Background Decorative Elements (+, x, o, diamond, dots) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 select-none overflow-hidden"
      >


        {/* Diamond / Square Element (Inline SVG) */}
        <svg
          className="absolute bottom-12 right-[5%] h-5 w-5 text-foreground/15 rotate-12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>

        {/* Subtle Grid Dot Pattern Canvas */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />

        {/* Big Watermark Brand Typography */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[14vw] font-extrabold uppercase leading-none tracking-tighter text-foreground/[0.02] sm:-bottom-10 lg:-bottom-14">
          ReBites.
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-8 pt-16 sm:px-8 lg:px-10">
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 lg:grid-cols-[1.6fr_repeat(4,minmax(0,1fr))] lg:gap-x-8">
          {/* Brand */}
          <div className="col-span-2 max-w-sm md:col-span-1">
            <Link
              href="/"
              aria-label="ReBites — beranda"
              className="inline-flex items-center gap-2.5 group"
            >
              <Image
                src="/logo.avif"
                alt=""
                width={34}
                height={34}
                className="h-8 w-8 rounded-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="font-display text-xl font-semibold tracking-tight text-primary">
                ReBites
              </span>
            </Link>

            <p className="mt-3.5 text-[13px] leading-relaxed text-muted-foreground">
              Makanan surplus, kesempatan baru. Temukan makanan layak konsumsi dari UMKM lokal dengan harga yang lebih bersahabat.
            </p>

            <a
              href="mailto:halo@rebites.id"
              className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden />
              halo@rebites.id
            </a>

            <ul className="mt-4 flex items-center gap-1.5">
              {SOCIALS.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/40 bg-secondary/30 text-muted-foreground transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Menu groups */}
          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/90">
                {column.title}
              </h2>

              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      onClick={
                        link.sectionId
                          ? (event) => handleSectionLinkClick(event, link.sectionId!)
                          : undefined
                      }
                      className="inline-flex text-[13px] leading-snug text-muted-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom row */}
        <div className="mt-14 flex flex-col gap-4 border-t border-border/40 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-muted-foreground">
            © {new Date().getFullYear()} ReBites. Dibuat dengan penuh kepedulian oleh{' '}
            <span className="font-medium text-foreground">Tim Sixquit</span> — SMK Taruna Bhakti.
          </p>

          <div className="flex items-center justify-between gap-6 sm:justify-end">
            <span className="text-[12px] font-medium tracking-wide text-muted-foreground/80">
              Better food, less waste.
            </span>
            <BackToTop />
          </div>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="relative z-0 -mt-15 w-full overflow-hidden"
      >
        <Image
          src="/footer_img_updt.png"
          alt=""
          width={2400}
          height={800}
          sizes="100vw"
          className="block h-auto w-full object-contain object-bottom saturate-[0.65]"
        />
      </div>
    </footer>
  );
}