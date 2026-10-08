'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Reveal } from '@/app/components/shared/reveal';

const FOCUS_RING_ON_GREEN =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary';

type PathKey = 'pembeli' | 'umkm';

const PATHS: Record<
  PathKey,
  { label: string; heading: string; steps: { title: string; description: string }[]; cta: { label: string; href: string } }
> = {
  pembeli: {
    label: 'Untuk pembeli',
    heading: 'Tiga langkah sampai ke piring.',
    steps: [
      {
        title: 'Temukan',
        description:
          'Cari makanan surplus dari UMKM di sekitarmu lewat kategori atau pencarian.',
      },
      {
        title: 'Pilih',
        description:
          'Lihat makanan, harga, sisa stok, dan jam ketersediaannya sebelum menentukan pilihan.',
      },
      {
        title: 'Pesan',
        description:
          'Diantar atau ambil sendiri, bayar, dan nikmati makanan berkualitas dengan harga lebih hemat.',
      },
    ],
    cta: { label: 'Temukan Makanan', href: '/home' },
  },
  umkm: {
    label: 'Untuk UMKM',
    heading: 'Tiga langkah sampai pesanan masuk.',
    steps: [
      {
        title: 'Daftar',
        description:
          'Gabung sebagai UMKM, lengkapi profil usaha, dan atur jam operasional toko.',
      },
      {
        title: 'Tawarkan',
        description:
          'Tampilkan makanan surplus yang masih layak konsumsi beserta harga, stok, dan waktu penjualannya.',
      },
      {
        title: 'Jangkau pembeli',
        description:
          'Menu tampil ke pembeli di Depok, dan setiap pesanan masuk bisa kamu pantau dari dashboard.',
      },
    ],
    cta: { label: 'Gabung sebagai UMKM', href: '/auth/register/penjual' },
  },
};

/**
 * "Cara kerja" — maksimal tiga langkah untuk dua jalur (pembeli & UMKM),
 * digabung lewat tab supaya section ini tidak mengulang section lain.
 * Konten tiap tab diganti lewat key sehingga transisinya cukup satu fade
 * pendek, tanpa AnimatePresence.
 */
export function HowItWorksSection() {
  const [active, setActive] = useState<PathKey>('pembeli');
  const path = PATHS[active];

  return (
    <section
      id="cara-kerja"
      aria-labelledby="how-heading"
      className="grain-overlay bg-primary text-primary-foreground"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-16">
          <Reveal>
            <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary-foreground/70">
              Cara kerja
            </p>
            <h2
              id="how-heading"
              className="mt-4 text-balance font-display text-[clamp(1.75rem,3.4vw,2.85rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white"
            >
              Dari niat baik ke piring,{' '}
              <span className="font-light italic">tiga langkah saja.</span>
            </h2>
          </Reveal>

          <Reveal delay={0.08}>
            <p className="max-w-xl text-[15px] leading-[1.8] text-white/70 lg:pb-1.5">
              Alurnya sama sederhananya untuk kedua sisi: penjual cukup
              mengunggah, pembeli cukup memilih.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.06}>
          <div
            role="tablist"
            aria-label="Alur penggunaan ReBites"
            className="mt-8 inline-flex w-full flex-col gap-2 rounded-3xl border border-white/20 bg-white/10 p-1.5 sm:w-auto sm:flex-row sm:rounded-full sm:gap-0"
          >
            {(Object.keys(PATHS) as PathKey[]).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`cara-tab-${key}`}
                aria-selected={active === key}
                aria-controls={`cara-panel-${key}`}
                onClick={() => setActive(key)}
                className={cn(
                  'min-h-[44px] flex-1 rounded-full px-6 py-2.5 font-secondary text-sm font-semibold transition-colors duration-200 sm:flex-none',
                  active === key
                    ? 'bg-white text-primary'
                    : 'text-white/70 hover:text-white',
                  FOCUS_RING_ON_GREEN,
                )}
              >
                {PATHS[key].label}
              </button>
            ))}
          </div>
        </Reveal>

        <motion.div
          key={active}
          role="tabpanel"
          id={`cara-panel-${active}`}
          aria-labelledby={`cara-tab-${active}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10"
        >
          <p className="font-display text-base font-semibold tracking-tight text-white sm:text-lg">
            {path.heading}
          </p>

          <ol className="mt-6 grid gap-7 sm:grid-cols-3 sm:gap-8">
            {path.steps.map((step, index) => (
              <li key={step.title} className="list-none border-t border-white/20 pt-5">
                <span className="font-display text-xs font-semibold tabular-nums tracking-[0.2em] text-white/70">
                  0{index + 1}
                </span>
                <h3 className="mt-2.5 font-display text-lg font-semibold tracking-tight text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-[1.75] text-white/70">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-9">
            <Link
              href={path.cta.href}
              className={`group inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-white px-7 py-3 font-secondary text-sm font-semibold text-primary transition-colors duration-300 hover:bg-secondary ${FOCUS_RING_ON_GREEN}`}
            >
              {path.cta.label}
              <ArrowRight
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                aria-hidden
              />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
