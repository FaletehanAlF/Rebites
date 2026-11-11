'use client';

import { useState } from 'react';
import { ArrowRight, Users, Store } from 'lucide-react';
import Link from 'next/link';
import { Reveal } from '@/app/components/shared/reveal';
import { SectionHeading } from '@/app/components/landing/SectionHeading';
import { cn } from '@/lib/utils';


const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

const PATHS = {
  buyer: {
    steps: [
      {
        number: '01',
        title: 'Temukan makanan',
        description:
          'Jelajahi berbagai pilihan makanan surplus dari UMKM di sekitar Kota Depok. Temukan kuliner yang sesuai dengan kebutuhan dan seleramu.',
      },
      {
        number: '02',
        title: 'Pilih sesuai selera',
        description:
          'Periksa informasi produk, harga, dan detail makanan sebelum menentukan pilihan. Kamu bisa mempertimbangkan pilihan yang paling sesuai.',
      },
      {
        number: '03',
        title: 'Nikmati lebih hemat',
        description:
          'Dapatkan makanan yang masih layak konsumsi dengan harga lebih terjangkau, sekaligus ikut mengurangi makanan yang terbuang.',
      },
    ],
    cta: 'Temukan Makanan',
    href: '/home',
    note: 'Pilihan lebih hemat, manfaat lebih besar.',
  },
  seller: {
    steps: [
      {
        number: '01',
        title: 'Daftarkan usahamu',
        description:
          'Buat akun penjual di ReBites untuk mulai memperkenalkan usaha kulinermu dan bergabung dengan ekosistem makanan surplus.',
      },
      {
        number: '02',
        title: 'Tampilkan produk',
        description:
          'Cantumkan makanan surplus yang tersedia beserta informasi dan harganya agar calon pembeli dapat mengetahui pilihanmu.',
      },
      {
        number: '03',
        title: 'Jangkau pelanggan',
        description:
          'Buka peluang agar makanan yang masih layak konsumsi dapat dimanfaatkan dan usaha kulinermu dikenal oleh lebih banyak orang.',
      },
    ],
    cta: 'Gabung sebagai UMKM',
    href: '/auth/register/penjual',
    note: 'Kurangi makanan terbuang, dukung usaha lokal.',
  },
} as const;

type Audience = keyof typeof PATHS;

export function HowItWorksSection() {
  const [audience, setAudience] = useState<Audience>('buyer');
  const currentPath = PATHS[audience];

  function handleTabKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;

    event.preventDefault();

    const next = audience === 'buyer' ? 'seller' : 'buyer';
    setAudience(next);

    requestAnimationFrame(() => {
      document.getElementById(`how-it-works-tab-${next}`)?.focus();
    });
  }

  return (
    <section
      id="cara-kerja"
      aria-labelledby="how-it-works-title"
      className="relative z-10 scroll-mt-20 border-t border-border bg-white rounded-[30px] sm:rounded-[70px]"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <SectionHeading
          id="how-it-works-title"
          heading="Langkah Sederhana, Dampak Nyata."
          description="Temukan makanan surplus atau tawarkan produk usahamu melalui ReBites dengan langkah yang mudah dipahami."
        />

        <Reveal delay={0.06}>
          <div
            role="tablist"
            aria-label="Pilih cara menggunakan ReBites"
            className="mx-auto mt-8 grid w-full max-w-md grid-cols-2 gap-2 sm:mt-10 sm:gap-3"
          >
            {(
              [
                ['buyer', 'Pembeli', Users, 'Belanja hemat'],
                ['seller', 'UMKM', Store, 'Jual surplus'],
              ] as const
            ).map(([key, label, Icon, hint]) => (
              <button
                key={key}
                id={`how-it-works-tab-${key}`}
                type="button"
                role="tab"
                aria-selected={audience === key}
                aria-controls="how-it-works-panel"
                tabIndex={audience === key ? 0 : -1}
                onClick={() => setAudience(key)}
                onKeyDown={handleTabKeyDown}
                className={cn(
                  'group flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-4 py-4 transition-all duration-300 ease-out sm:py-5',
                  FOCUS_RING,
                  audience === key
                    ? 'border-primary bg-primary text-white shadow-lg shadow-primary/30 scale-[1.02]'
                    : 'border-border bg-white text-muted-foreground hover:-translate-y-0.5 hover:border-primary/50 hover:text-primary hover:shadow-md',
                )}
              >
                <Icon
                  className="h-6 w-6 transition-transform duration-300 group-hover:scale-110 sm:h-7 sm:w-7"
                  aria-hidden
                />
                <span className="font-secondary text-sm font-semibold sm:text-base">
                  {label}
                </span>
                <span
                  className={cn(
                    'font-secondary text-[10px] font-medium leading-none sm:text-[11px]',
                    audience === key ? 'text-white/85' : 'text-muted-foreground/80',
                  )}
                >
                  {hint}
                </span>
              </button>
            ))}
          </div>
        </Reveal>

        <div
          id="how-it-works-panel"
          role="tabpanel"
          aria-labelledby={`how-it-works-tab-${audience}`}
          className="mt-10 grid gap-8 sm:mt-12 lg:grid-cols-3 lg:gap-10"
        >
          {currentPath.steps.map((step, index) => (
            <Reveal
              key={`${audience}-${step.number}`}
              delay={index * 0.08}
              className="h-full"
            >
              <div className="flex h-full flex-col border-t border-border pt-6">
                <span className="font-secondary text-sm font-semibold tabular-nums text-primary">
                  {step.number}
                </span>

                <h3 className="mt-4 font-display text-xl font-semibold leading-snug tracking-[-0.02em] text-foreground sm:text-2xl">
                  {step.title}
                </h3>

                <p className="mt-3 max-w-sm text-sm leading-[1.8] text-muted-foreground sm:text-base">
                  {step.description}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.12}>
          <div className="mt-8 flex flex-col gap-5 sm:mt-10 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {currentPath.note}
            </p>

            <Link
              href={currentPath.href}
              className={cn(
                'group inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 font-secondary text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary-dark hover:shadow-xl hover:shadow-primary/30 sm:w-fit',
                FOCUS_RING,
              )}
            >
              {currentPath.cta}
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transform-none"
                aria-hidden
              />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
