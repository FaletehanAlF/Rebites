'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUp, Mail, MapPin } from 'lucide-react';

const WAVE_FILL = 'hsl(var(--secondary))';
const WAVE_LINE = 'hsl(var(--muted-foreground))';
const WAVE_LINE_BRAND = 'hsl(var(--primary))';

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
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.3 0 .58.05.85.13V9.4a6.33 6.33 0 0 0-.85-.06 6.34 6.34 0 1 0 6.34 6.34V8.33a8.16 8.16 0 0 0 4.77 1.52V6.4c-.22 0-.43-.02-.65-.04l.65-.49V6.69Z" />
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

const EXPLORE_LINKS = [
  { label: 'Cara Kerja', href: '/#cara-kerja' },
  { label: 'Untuk UMKM', href: '/fitur#umkm' },
  { label: 'Untuk Pembeli', href: '/fitur#pembeli' },
  { label: 'Paket Langganan', href: '/#langganan' },
];

const LEGAL_LINKS = [
  { label: 'Privacy Policy', href: '#' },
  { label: 'Terms of Use', href: '#' },
  { label: 'Disclaimer', href: '#' },
];

function FooterWave() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[120px] w-full">
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <path
          d="M0,0 H1440 V48 C1180,104 980,20 720,44 C470,68 280,112 0,76 Z"
          fill={WAVE_FILL}
        />
        <path
          d="M0,76 C280,112 470,68 720,44 C980,20 1180,104 1440,48"
          fill="none"
          stroke={WAVE_LINE}
          strokeOpacity="0.55"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <path
          d="M0,70 C288,106 482,62 724,40 C978,18 1184,100 1440,45"
          fill="none"
          stroke={WAVE_LINE_BRAND}
          strokeOpacity="0.25"
          strokeWidth="0.8"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTop = () => {
    const lenis = (window as unknown as { __lenis?: { scrollTo: (t: number | HTMLElement, o?: unknown) => void } }).__lenis;
    if (lenis) lenis.scrollTo(0, { duration: 1 });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={scrollTop}
      aria-label="Kembali ke atas"
      className={`fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-primary shadow-sm transition-all duration-300 hover:bg-primary-dark hover:text-white ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}

export function SiteFooter() {
  return (
    <footer
      data-nav="green"
      className="relative overflow-hidden bg-primary"
    >
      <FooterWave />

      <div className="mx-auto max-w-7xl px-4 pb-10 pt-32 sm:px-6 lg:px-8 lg:pt-36">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.2fr_1.4fr] lg:gap-8 lg:items-end">
          {/* Brand - widest column */}
          <div className="text-center sm:text-left">
            <Link href="/" className="inline-flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="ReBites"
                width={48}
                height={48}
                className="h-12 w-12 rounded-full object-cover ring-1 ring-white/20"
              />
              <span className="flex items-baseline gap-0.5 text-primary-foreground">
                <span className="font-display text-3xl font-bold tracking-tight">Re</span>
                <span className="font-display text-3xl font-light">Bites</span>
              </span>
            </Link>

            <p
              className="mx-auto mt-5 max-w-xs font-sans text-sm leading-relaxed text-primary-foreground/70 sm:mx-0"
            >
              Marketplace khusus penjualan makanan surplus yang masih layak
              konsumsi dari pelaku UMKM Indonesia, untuk mengurangi food loss
              dan food waste.
            </p>

            <div className="mt-7 flex items-center justify-center gap-3 sm:justify-start">
              {SOCIALS.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-primary transition-colors duration-300 hover:bg-primary-dark hover:text-white"
                >
                  <Icon className="h-[18px] w-[18px]" />
                </a>
              ))}
            </div>
          </div>

          {/* Explore */}
          <nav aria-label="Jelajahi" className="text-center sm:text-left">
            <ul className="space-y-3.5">
              {EXPLORE_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="font-sans text-[15px] text-primary-foreground transition-colors duration-300 hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Legal */}
          <nav aria-label="Legal" className="text-center sm:text-left">
            <ul className="space-y-3.5">
              <li>
                <a
                  href="mailto:halo@rebites.id"
                  className="inline-flex items-center justify-center gap-2 font-sans text-[15px] text-primary-foreground transition-colors duration-300 hover:text-primary sm:justify-start"
                >
                  <Mail className="h-4 w-4 shrink-0 opacity-70" />
                  halo@rebites.id
                </a>
              </li>
              {LEGAL_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="font-sans text-[15px] text-primary-foreground transition-colors duration-300 hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Support */}
          <nav aria-label="Dukungan" className="text-center sm:text-left">
            <ul className="space-y-3.5">
              <li>
                <span
                  className="inline-flex items-start gap-2 text-left font-sans text-[15px] leading-relaxed text-primary-foreground/70"
                >
                  <MapPin className="mt-1 h-4 w-4 shrink-0 opacity-70" />
                  SMK Taruna Bhakti, Jl. Pekapuran, RT.02/RW.06, Curug, Kec. Cimanggis, Kota Depok,
                  Jawa Barat 16953
                </span>
              </li>
            </ul>
          </nav>

          {/* Giant wordmark */}
          <div className="col-span-full flex flex-col items-center gap-6 sm:col-span-2 lg:col-span-1 lg:items-end">
            <p
              className="text-center font-display font-medium leading-none tracking-tight text-primary-foreground lg:text-right"
              style={{ fontSize: 'clamp(3.5rem, 6.5vw, 6.5rem)' }}
            >
              Re
              <span className="font-light">Bites</span>
            </p>

            <div className="flex items-center gap-2.5 rounded-full border border-white/20 px-4 py-2">
              <span
                aria-hidden
                className="h-4 w-4 overflow-hidden rounded-full bg-white"
              >
                <span className="block h-1/2 w-full rounded-t-full bg-destructive" />
              </span>
              <span className="font-sans text-xs text-primary-foreground">
                Indonesia (ID)
              </span>
            </div>
          </div>
        </div>

        <div
          className="mt-16 border-t border-white/10 pt-7"
        >
          <p className="text-center font-sans text-xs text-primary-foreground/70">
            © {new Date().getFullYear()} ReBites. Dibuat oleh{' '}
            <span className="text-primary-foreground">Tim Sixquit</span> - SMK Taruna Bhakti.
          </p>
        </div>
      </div>

      <BackToTop />
    </footer>
  );
}
