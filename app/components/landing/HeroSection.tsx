'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, MapPin, Store } from 'lucide-react';
import { Reveal } from '@/app/components/shared/reveal';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Hero: komposisi asimetris (teks kiri, foto hidangan UMKM kanan) yang
 * menjelaskan apa itu ReBites dalam satu layar — tanpa panel berwarna,
 * tanpa kartu melayang, tanpa bayangan berat. Cuplikan produk asli tetap di
 * section `#rekomendasi`, supaya hero tidak bergantung pada fetch katalog.
 */
export function HeroSection() {
  return (
    <section id="top" className="bg-white">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:pb-24 lg:pt-36">
        <div className="flex max-w-2xl flex-col items-start">
          <Reveal delay={0.05}>
            <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary" aria-hidden />
              Makanan surplus Sekota Depok
            </p>
          </Reveal>

          <Reveal delay={0.12}>
            <h1 className="mt-5 text-balance font-display text-[clamp(2.1rem,5vw,3.5rem)] font-semibold leading-[1.06] tracking-[-0.035em] text-primary">
              Selamatkan Makanan, Nikmati Harga Lebih Hemat.
            </h1>
          </Reveal>

          <Reveal delay={0.18}>
            <p className="mt-5 max-w-[34rem] text-base leading-[1.75] text-muted-foreground sm:text-[1.0625rem]">
              Temukan dan beli makanan surplus yang masih layak konsumsi dari UMKM di sekitarmu dengan harga lebih hemat. Bantu kurangi makanan terbuang sekaligus dukung usaha kuliner lokal.
            </p>
          </Reveal>

          <Reveal delay={0.24} className="w-full">
            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
              <Link
                href="/home"
                className={`group inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 font-secondary text-sm font-semibold text-white transition-colors duration-300 hover:bg-primary-dark sm:w-auto ${FOCUS_RING}`}
              >
                Temukan Makanan
                <ArrowRight
                  className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden
                />
              </Link>
              <Link
                href="/auth/register/penjual"
                className={`inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full border border-border px-8 py-3.5 font-secondary text-sm font-semibold text-primary transition-colors duration-200 hover:border-primary hover:bg-secondary sm:w-auto ${FOCUS_RING}`}
              >
                <Store className="h-4 w-4 shrink-0" aria-hidden />
                <span>Gabung sebagai UMKM</span>
              </Link>
            </div>
          </Reveal>
        </div>

        {/* Visual: foto hidangan UMKM */}
        <Reveal delay={0.16} className="w-full">
          <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border bg-muted sm:aspect-[5/4] lg:aspect-square">
              <Image
                src="/hero-makanan.jpeg"
                alt="Aneka hidangan dari pelaku UMKM yang dijual melalui ReBites"
                fill
                priority
                sizes="(min-width: 1024px) 34rem, calc(100vw - 2rem)"
                className="object-cover"
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
