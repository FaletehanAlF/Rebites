'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUp, Mail } from 'lucide-react';
import { handleSectionLinkClick } from '@/app/components/landing/scroll-to-section';

type FooterLink = { label: string; href: string; sectionId?: string };

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81ZM9.55 15.57V8.43L15.82 12l-6.27 3.57Z" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 .3a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.28-1.55 3.29-1.23 3.29-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.63-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.21.7.83.58A12 12 0 0 0 12 .3Z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.44-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.28-.2-.57-.35Zm-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.64-.24-.38a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88Zm8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.9c0 2.09.55 4.14 1.59 5.94L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.9a11.82 11.82 0 0 0-3.48-8.41Z" />
    </svg>
  );
}

const SOCIALS = [
  { label: 'YouTube', href: 'https://youtube.com/@faletehanalfarabi?si=8dTYvmdfYGrh5o1u', Icon: YouTubeIcon },
  { label: 'GitHub', href: 'https://github.com/FaletehanAlF/Rebites', Icon: GitHubIcon },
  { label: 'WhatsApp', href: 'https://wa.me/6281219010664', Icon: WhatsAppIcon },
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
        { label: 'Blog', href: '/blog' },
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
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 select-none overflow-hidden"
      >


        <svg
          className="absolute bottom-12 right-[5%] h-5 w-5 text-foreground/15 rotate-12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>

        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />

        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[14vw] font-extrabold uppercase leading-none tracking-tighter text-foreground/[0.02] sm:-bottom-10 lg:-bottom-14">
          ReBites.
        </div>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-5 pb-8 pt-16 sm:px-8 lg:px-10">
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 lg:grid-cols-[1.6fr_repeat(4,minmax(0,1fr))] lg:gap-x-8">
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

            <ul className="mt-4 flex flex-wrap items-center gap-1.5">
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

        <div className="mt-14 flex flex-col gap-4 border-t border-border/40 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-muted-foreground">
            © {new Date().getFullYear()} ReBites. Dibuat dengan penuh kepedulian oleh{' '}
            <span className="font-medium text-foreground">Tim Tony Stark Inc</span> — SMK Taruna Bhakti.
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