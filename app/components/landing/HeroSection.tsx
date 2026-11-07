'use client';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check, LayoutGrid, MapPin } from 'lucide-react';
import { Reveal } from '@/app/components/shared/reveal';
import { CATEGORIES } from '@/lib/categories';
import { scrollToSection } from '@/app/components/landing/scroll-to-section';
const ASSURANCES = [
    'Masih layak konsumsi',
    'Harga lebih hemat',
    'Kurangi food waste',
];
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';
export function HeroSection() {
    return (<section id="top" className="relative overflow-hidden bg-white">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 pb-20 pt-28 sm:px-8 sm:pb-24 sm:pt-32 lg:grid-cols-[1fr_0.9fr] lg:gap-16 lg:px-10 lg:pb-28 lg:pt-36 xl:gap-24">
        
        <div className="flex max-w-2xl flex-col items-start">
          <Reveal delay={0.05}>
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3.5 py-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary" aria-hidden/>
              <span className="font-secondary text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                Khusus Kota Depok
              </span>
            </span>
          </Reveal>

          <Reveal delay={0.12}>
            <h1 className="mt-6 text-balance font-display text-[clamp(2.25rem,5.2vw,4.25rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-primary">
              Masih layak, lebih hemat,{' '}
              <span className="font-light italic">tidak terbuang.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.18}>
            <p className="mt-6 max-w-[34rem] text-base leading-[1.75] text-muted-foreground sm:text-[1.0625rem]">
              ReBites adalah marketplace makanan surplus dari pelaku UMKM Kota
              Depok. Jelajahi menu hari ini, pesan sesukamu, lalu pilih diantar
              atau ambil sendiri.
            </p>
          </Reveal>

          <Reveal delay={0.24} className="w-full">
            <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
              <Link href="/auth/register" className={`group inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 font-secondary text-sm font-semibold text-white shadow-[0_18px_30px_-18px_rgba(27,77,50,0.8)] transition-colors duration-300 hover:bg-primary-dark sm:w-auto ${FOCUS_RING}`}>
                Mulai jelajahi
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden/>
              </Link>

              <a href="/#cara-kerja" onClick={(event) => {
            event.preventDefault();
            scrollToSection('cara-kerja');
        }} className={`inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full border border-border px-8 py-3.5 font-secondary text-sm font-semibold text-primary transition-colors duration-300 hover:border-primary hover:bg-secondary sm:w-auto ${FOCUS_RING}`}>
                Lihat cara kerjanya
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.3} className="w-full">
            <ul className="mt-10 flex w-full flex-col gap-3 border-t border-border/60 pt-6 sm:flex-row sm:flex-wrap sm:gap-x-7 sm:gap-y-3">
              {ASSURANCES.map((item) => (<li key={item} className="flex items-center gap-2.5 font-secondary text-sm text-muted-foreground">
                  <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                    <Check className="h-3 w-3" strokeWidth={3.25}/>
                  </span>
                  {item}
                </li>))}
            </ul>
          </Reveal>
        </div>

        
        <Reveal delay={0.16}>
          <div className="relative mx-auto w-full max-w-xl pb-6 sm:pb-8 lg:max-w-none lg:pb-0">
            <div className="relative aspect-[5/4] w-full overflow-hidden rounded-[1.75rem] border border-border/70 bg-muted shadow-[0_40px_80px_-56px_rgba(27,77,50,0.65)] sm:rounded-[2.25rem] lg:aspect-[4/5]">
              <Image src="/hero-makanan.avif" alt="Aneka hidangan dari pelaku UMKM yang dijual melalui ReBites" fill priority sizes="(min-width: 1024px) 44rem, calc(100vw - 2.5rem)" className="object-cover"/>
            </div>

            
            <div className="absolute -bottom-0 left-4 hidden aspect-square w-32 overflow-hidden rounded-2xl border-4 border-white shadow-[0_24px_44px_-24px_rgba(27,77,50,0.55)] min-[480px]:block sm:-bottom-2 sm:-left-5 sm:w-36 sm:rounded-3xl lg:-bottom-8 lg:-left-8 lg:w-40 xl:-left-10 xl:w-44">
              <Image src="/makanan13.avif" alt="Salah satu menu surplus yang tersedia di ReBites" fill sizes="(min-width: 1280px) 11rem, (min-width: 640px) 9rem, 8rem" className="object-cover"/>
            </div>

            
            <div className="absolute right-3 top-3 flex items-center gap-2 rounded-full border border-border/70 bg-white/95 px-3.5 py-2 shadow-[0_18px_34px_-22px_rgba(27,77,50,0.55)] backdrop-blur sm:right-5 sm:top-6 lg:-right-4 lg:top-10">
              <LayoutGrid className="h-4 w-4 text-primary" strokeWidth={2} aria-hidden/>
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
    </section>);
}
