
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, MapPin, Store } from 'lucide-react';
import { Reveal } from '@/app/components/shared/reveal';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const FOOD_WORDS = [
  'MAKANAN.',
  'MINUMAN.'
];

function AnimatedFoodText() {
  const [index, setIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;

    const interval = window.setInterval(() => {
      setIndex((current) => (current + 1) % FOOD_WORDS.length);
    }, 2500);

    return () => window.clearInterval(interval);
  }, [prefersReducedMotion]);

  return (
    <span className="inline-flex max-w-full overflow-hidden align-bottom text-primary">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={FOOD_WORDS[index]}
          initial={
            prefersReducedMotion
              ? false
              : { opacity: 0, y: 14 }
          }
          animate={{ opacity: 1, y: 0 }}
          exit={
            prefersReducedMotion
              ? { opacity: 1 }
              : { opacity: 0, y: -14 }
          }
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="inline-block"
        >
          {FOOD_WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function HeroSection() {
  return (
    <section id="top" className="bg-white">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:pb-24 lg:pt-36">
        {/* Hero content */}
        <div className="flex min-w-0 max-w-2xl flex-col items-center text-center lg:items-start lg:text-left">
          <Reveal delay={0.05}>
            <p className="inline-flex max-w-full items-center justify-center gap-1.5 text-sm font-medium text-primary lg:justify-start">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Makanan surplus se-Kota Depok</span>
            </p>
          </Reveal>

          <Reveal delay={0.12}>
            <h1 className="mt-5 w-full text-balance font-display text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.08] tracking-[-0.035em] text-foreground">
              TEMUKAN NILAI LEBIH DARI{' '}
              <AnimatedFoodText />
            </h1>
          </Reveal>

          <Reveal delay={0.18}>
            <p className="mt-5 w-full max-w-[34rem] text-sm leading-[1.75] text-muted-foreground sm:text-base">
              Temukan dan beli makanan surplus yang masih layak
              konsumsi dari UMKM di sekitarmu dengan harga lebih
              hemat. Bantu kurangi makanan terbuang sekaligus
              dukung usaha kuliner lokal.
            </p>
          </Reveal>

          {/* Responsive CTA */}
          <Reveal delay={0.24} className="w-full">
            <div className="mt-8 grid w-full grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-4">
              <Link
                href="/home"
                className={`group inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 font-secondary text-sm font-semibold text-white transition-colors duration-300 hover:bg-primary-dark min-[480px]:px-3 sm:w-auto sm:px-8 ${FOCUS_RING}`}
              >
                <span>Temukan Makanan</span>
                <ArrowRight
                  className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>

              <Link
                href="/auth/register/penjual"
                className={`inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3.5 font-secondary text-sm font-semibold text-primary transition-colors duration-200 hover:border-primary hover:bg-secondary min-[480px]:px-3 sm:w-auto sm:px-8 ${FOCUS_RING}`}
              >
                <Store
                  className="h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>Gabung sebagai UMKM</span>
              </Link>
            </div>
          </Reveal>
        </div>

        {/* Food image */}
        <Reveal delay={0.16} className="w-full min-w-0">
          <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border bg-muted sm:aspect-[5/4] lg:aspect-square">
              <Image
                src="/hero-makanan.avif"
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