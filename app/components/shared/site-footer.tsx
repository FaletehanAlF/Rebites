'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Leaf, Instagram, Mail, MapPin } from 'lucide-react';
import { Reveal } from './reveal';

export function SiteFooter() {
  return (
    <footer
      className="relative overflow-hidden bg-primary text-primary-foreground"
    >
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <Reveal className="grid gap-8 sm:gap-12 lg:grid-cols-[1.1fr_0.8fr_1fr_1.3fr]">
          <div>
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/logo.avif"
                alt="ReBites"
                width={48}
                height={48}
                className="h-10 w-10 rounded-full object-cover ring-1 ring-primary-foreground/20 sm:h-12 sm:w-12"
              />
              <span className="flex items-baseline gap-0.5">
                <span className="font-display text-3xl font-medium text-primary-foreground-strong">
                  Re
                </span>
                <span className="font-display text-3xl font-light text-primary-foreground-strong">
                  Bites
                </span>
              </span>
            </Link>
            <p className="mt-5 max-w-xs font-sans text-sm leading-relaxed text-primary-foreground/70">
              Marketplace yang menyelamatkan makanan surplus dari dapur UMKM
              kuliner Indonesia sebelum menjadi food waste.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-primary-foreground/20 text-primary-foreground/80 transition-colors hover:border-primary hover:bg-primary-dark hover:text-white"
                aria-label="Instagram"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="mailto:halo@rebites.id"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-primary-foreground/20 text-primary-foreground/80 transition-colors hover:border-primary hover:bg-primary-dark hover:text-white"
                aria-label="Email"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-sans text-[11px] uppercase tracking-[0.25em] text-primary-foreground/50">
              Platform
            </h4>
            <ul className="mt-5 space-y-3">
              <li>
                <Link
                  href="/#cara-kerja"
                  className="font-sans text-sm text-primary-foreground/80 transition-colors hover:text-primary"
                >
                  Cara Kerja
                </Link>
              </li>
              <li>
                <Link
                  href="/fitur#umkm"
                  className="font-sans text-sm text-primary-foreground/80 transition-colors hover:text-primary"
                >
                  Untuk UMKM
                </Link>
              </li>
              <li>
                <Link
                  href="/fitur#pembeli"
                  className="font-sans text-sm text-primary-foreground/80 transition-colors hover:text-primary"
                >
                  Untuk Pembeli
                </Link>
              </li>
              <li>
                <Link
                  href="/#langganan"
                  className="font-sans text-sm text-primary-foreground/80 transition-colors hover:text-primary"
                >
                  Paket Langganan
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-sans text-[11px] uppercase tracking-[0.25em] text-primary-foreground/50">
              Kontak
            </h4>
            <ul className="mt-5 space-y-3 font-sans text-sm text-primary-foreground/80">
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary-foreground/60" />
                halo@rebites.id
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-foreground/60" />
                SMK Taruna Bhakti, Jl. Pekapuran, RT.02/RW.06, Curug, Kec. Cimanggis, Kota Depok, Jawa Barat 16953
              </li>
            </ul>
          </div>

          <div className="lg:text-right">
            <p className="font-display text-[clamp(3.5rem,6.5vw,6rem)] font-medium leading-none tracking-tight text-primary-foreground-strong">
              Re
              <span className="font-light">Bites</span>
            </p>

            <div className="mt-6 flex flex-col items-start gap-4 lg:items-end">
              <div className="flex items-center gap-2.5 rounded-full border border-primary-foreground/20 px-4 py-2">
                <span
                  aria-hidden
                  className="h-4 w-4 overflow-hidden rounded-full bg-white"
                >
                  <span className="block h-1/2 w-full rounded-t-full bg-destructive" />
                </span>
                <span className="font-sans text-xs text-primary-foreground/80">
                  Indonesia (ID)
                </span>
              </div>

              <p className="flex items-center gap-2 font-sans text-xs text-primary-foreground/50">
                <Leaf className="h-3.5 w-3.5" />
                Selamatkan Makanan, selamatkan bumi.
              </p>
            </div>
          </div>
        </Reveal>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-primary-foreground/15 pt-6 sm:mt-16 sm:flex-row sm:items-center sm:pt-8">
          <p className="font-sans text-xs text-primary-foreground/50">
             {new Date().getFullYear()} ReBites. Dibuat oleh{' '}
            <span className="text-primary-foreground/80">Tim Sixquit</span> -
            SMK Taruna Bhakti.
          </p>

          {/* Halaman kebijakan belum ada; label statis, tanpa pointer yang berbohong (R-26). */}
          <div className="flex flex-wrap items-center gap-6 font-sans text-xs text-primary-foreground/50">
            <span>Kebijakan Privasi</span>
            <span>Syarat Penggunaan</span>
            <span>Penyangkalan</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
