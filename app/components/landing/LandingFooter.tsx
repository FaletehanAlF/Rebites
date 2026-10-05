'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUp, Mail, MapPin } from 'lucide-react';
import { scrollToSection } from '@/app/components/landing/scroll-to-section';

type FooterLink = { label: string; href: string; sectionId?: string };

const EXPLORE_LINKS: FooterLink[] = [
  { label: 'Cara Kerja', href: '/#cara-kerja', sectionId: 'cara-kerja' },
  { label: 'Jelajahi Katalog', href: '/#rekomendasi', sectionId: 'rekomendasi' },
  { label: 'Untuk UMKM', href: '/#umkm', sectionId: 'umkm' },
  { label: 'Untuk Pembeli', href: '/#pembeli', sectionId: 'pembeli' },
  { label: 'FAQ', href: '/#faq', sectionId: 'faq' },
  { label: 'Paket Langganan', href: '/#langganan', sectionId: 'langganan' },
];

const BUYER_LINKS: FooterLink[] = [
  { label: 'Beranda aplikasi', href: '/home' },
  { label: 'Kategori makanan', href: '/makanan/makanan-berat' },
  { label: 'Riwayat pesanan', href: '/riwayatPesanan' },
  { label: 'Notifikasi', href: '/notifikasi/pembeli' },
];

const SELLER_LINKS: FooterLink[] = [
  { label: 'Dashboard penjual', href: '/dashboard/penjual' },
  { label: 'Tambah menu', href: '/dashboard/penjual/tambahMenu' },
  { label: 'Pesanan masuk', href: '/dashboard/penjual/pesanan' },
  { label: 'Ulasan pembeli', href: '/dashboard/penjual/ulasan' },
  { label: 'Performa penjualan', href: '/dashboard/penjual/performa' },
];

const ACCOUNT_LINKS: FooterLink[] = [
  { label: 'Masuk', href: '/auth/login' },
  { label: 'Daftar', href: '/auth/register' },
  { label: 'Masuk penjual', href: '/auth/login/penjual' },
  { label: 'Daftar penjual', href: '/auth/register/penjual' },
  { label: 'Lupa sandi', href: '/auth/forgotPassword' },
];

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  { title: 'Jelajahi', links: EXPLORE_LINKS },
  { title: 'Untuk pembeli', links: BUYER_LINKS },
  { title: 'Untuk penjual', links: SELLER_LINKS },
  { title: 'Akun', links: ACCOUNT_LINKS },
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

export function LandingFooter() {
  return (
    <footer className="grain-overlay bg-primary text-primary-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-14 sm:px-6 sm:pt-16 lg:px-8 lg:pt-20">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] lg:gap-8">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" aria-label="ReBites — beranda" className="inline-flex items-center gap-2.5">
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

            <p className="mt-5 max-w-sm text-sm leading-[1.75] text-white/65">
              Marketplace khusus penjualan makanan surplus yang masih layak
              konsumsi dari pelaku UMKM, untuk mengurangi food loss dan food
              waste.
            </p>

            <ul className="mt-6 flex flex-wrap items-center gap-2.5">
              {SOCIALS.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/80 transition-colors duration-300 hover:border-white/40 hover:bg-white/10 hover:text-white"
                  >
                    <Icon className="h-[17px] w-[17px]" />
                  </a>
                </li>
              ))}
            </ul>

            <ul className="mt-6 space-y-3 text-sm text-white/65">
              <li>
                <a
                  href="mailto:halo@rebites.id"
                  className="inline-flex items-center gap-2 transition-colors duration-300 hover:text-white"
                >
                  <Mail className="h-4 w-4 shrink-0" aria-hidden />
                  halo@rebites.id
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span className="leading-relaxed">
                  SMK Taruna Bhakti, Jl. Pekapuran, RT.02/RW.06, Curug, Kec.
                  Cimanggis, Kota Depok, Jawa Barat 16953
                </span>
              </li>
            </ul>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
                {column.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      onClick={
                        link.sectionId
                          ? (event) => {
                              event.preventDefault();
                              scrollToSection(link.sectionId as string);
                            }
                          : undefined
                      }
                      className="inline-flex min-h-[28px] items-center text-sm text-white/70 transition-colors duration-300 hover:text-white"
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
          <p className="text-center text-xs leading-relaxed text-white/55 sm:text-left">
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
