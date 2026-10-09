'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, LayoutGrid, MapPin, Store } from 'lucide-react';
import { Reveal } from '@/app/components/shared/reveal';
import { CATEGORIES } from '@/lib/categories';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Hero: satu layar yang menjelaskan apa itu ReBites — marketplace makanan
 * surplus dari UMKM di Kota Depok — lewat copy pendek dan foto hidangan
 * UMKM. Cuplikan produk asli ditampilkan di section `#rekomendasi`, bukan di
 * sini, supaya hero tetap ringan dan tidak bergantung pada fetch katalog.
 */
export function HeroSection() {
  return (
    <section id="top" className="relative overflow-hidden bg-white">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:pb-24 lg:pt-36">
        <div className="flex max-w-2xl flex-col items-start mb-10">
          <Reveal delay={0.05}>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3.5 py-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden />
              <span className="font-secondary text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                Makanan surplus Sekota Depok
              </span>
            </span>
          </Reveal>

          <Reveal delay={0.12}>
            <h1 className="mt-6 text-balance font-display text-[clamp(2.1rem,5vw,3.75rem)] font-semibold leading-[1.06] tracking-[-0.035em] text-primary">
              Selamatkan Makanan, Nikmati Harga Lebih Hemat.
            </h1>
          </Reveal>

          <Reveal delay={0.18}>
            <p className="mt-5 max-w-[34rem] text-base leading-[1.5] text-muted-foreground sm:text-[1.0625rem]">
              Temukan dan beli makanan surplus yang masih layak konsumsi dari UMKM di sekitarmu dengan harga lebih hemat. Bantu kurangi makanan terbuang sekaligus dukung usaha kuliner lokal.
            </p>
          </Reveal>

          <Reveal delay={0.24} className="w-full">
            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
              <Link
                href="/home"
                className={`group inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-3.5 font-secondary text-sm font-semibold text-white transition-colors duration-300 hover:bg-primary-dark sm:w-auto ${FOCUS_RING}`}
              >
                Temukan Makanan
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden
                />
              </Link>
              <Link
                href="/auth/register/penjual"
                className={`inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 px-8 py-3.5 font-secondary text-sm font-semibold text-primary transition-all duration-200 ease-out hover:scale-105 sm:w-auto ${FOCUS_RING}`}
              >
                <Store className="h-4 w-4 shrink-0" aria-hidden />
                <span>Gabung sebagai UMKM</span>
              </Link>
            </div>
          </Reveal>
        </div>

        {/* Visual: foto hidangan UMKM + badge kategori */}
        <Reveal delay={0.16} className="w-full">
          <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.5rem] border border-border/70 bg-muted shadow-[0_40px_80px_-56px_rgba(27,77,50,0.65)] sm:aspect-[5/4] sm:rounded-[2rem] lg:aspect-square">
              <Image
                src="/hero-makanan.jpeg"
                alt="Aneka hidangan dari pelaku UMKM yang dijual melalui ReBites"
                fill
                priority
                sizes="(min-width: 1024px) 34rem, calc(100vw - 2rem)"
                className="object-cover"
              />
            </div>

            <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full border border-border/70 bg-white/95 px-3.5 py-2 shadow-[0_18px_34px_-22px_rgba(27,77,50,0.55)] backdrop-blur sm:right-5 sm:top-5">
              <LayoutGrid className="h-4 w-4 text-primary" strokeWidth={2} aria-hidden />
              <span className="whitespace-nowrap font-display text-sm font-bold tabular-nums text-primary">
                {CATEGORIES.length}
              </span>
              <span className="whitespace-nowrap font-secondary text-xs text-muted-foreground">
                kategori kuliner
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
