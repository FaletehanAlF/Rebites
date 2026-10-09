'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import {
  motion,
  useReducedMotion,
  type Variants,
} from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Reveal } from '@/app/components/shared/reveal';

const FOCUS_RING_ON_GREEN =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary';

type PathKey = 'pembeli' | 'umkm';

type Step = {
  title: string;
  description: string;
  detail: string;
};

type AudiencePath = {
  label: string;
  eyebrow: string;
  heading: string;
  headingTail: string;
  note: string;
  steps: Step[];
  cta: { label: string; href: string };
};

const PATHS: Record<PathKey, AudiencePath> = {
  pembeli: {
    label: 'Pembeli',
    eyebrow: 'UNTUK KAMU YANG INGIN BERHEMAT',
    heading: 'Makanan baik,',
    headingTail: 'tanpa harus membayar lebih.',
    note: 'Temukan pilihan makanan yang sesuai kebutuhanmu.',
    steps: [
      {
        title: 'Temukan',
        description: 'Jelajahi makanan surplus dari UMKM di sekitarmu.',
        detail: 'Cari berdasarkan kategori dan lokasi.',
      },
      {
        title: 'Pilih',
        description: 'Bandingkan menu, harga, stok, dan waktu tersedia.',
        detail: 'Semua informasi sebelum kamu memesan.',
      },
      {
        title: 'Nikmati',
        description: 'Pesan untuk diantar atau ambil langsung di toko.',
        detail: 'Lebih hemat, makanan tetap bermanfaat.',
      },
    ],
    cta: {
      label: 'Temukan makanan',
      href: '/home',
    },
  },
  umkm: {
    label: 'UMKM',
    eyebrow: 'UNTUK USAHA KULINER',
    heading: 'Lebih banyak manfaat,',
    headingTail: 'dari makanan yang tersisa.',
    note: 'Bawa makanan surplus usahamu ke lebih banyak pembeli.',
    steps: [
      {
        title: 'Bergabung',
        description: 'Daftarkan usaha dan lengkapi informasi tokomu.',
        detail: 'Mulai dengan profil usaha yang jelas.',
      },
      {
        title: 'Tampilkan',
        description: 'Unggah makanan surplus beserta harga dan stok.',
        detail: 'Atur informasi sesuai ketersediaan.',
      },
      {
        title: 'Terhubung',
        description: 'Jangkau calon pembeli dan pantau pesanan masuk.',
        detail: 'Kelola pesanan melalui dashboard.',
      },
    ],
    cta: {
      label: 'Daftarkan usaha',
      href: '/auth/register/penjual',
    },
  },
};

const PATH_KEYS = Object.keys(PATHS) as PathKey[];

/* Panel berganti saat tab berubah: fade pendek + geser sedikit ke atas. */
const panelVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

const listVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.08,
      staggerChildren: 0.09,
    },
  },
};

const stepVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * "Cara kerja ReBites" — dua alur (pembeli & UMKM) dengan tiga langkah
 * masing-masing. Tab memakai pola ARIA tabs (roving tabindex + panah),
 * dan panel di-remount per `active` supaya transisi konten berjalan
 * halus tanpa AnimatePresence.
 */
export function HowItWorksSection() {
  const [active, setActive] = useState<PathKey>('pembeli');
  const shouldReduceMotion = useReducedMotion();
  const tabRefs = useRef<Record<PathKey, HTMLButtonElement | null>>({
    pembeli: null,
    umkm: null,
  });
  const path = PATHS[active];

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const count = PATH_KEYS.length;
    let next = index;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = (index + 1) % count;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (index - 1 + count) % count;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const key = PATH_KEYS[next];
    setActive(key);
    tabRefs.current[key]?.focus();
  };

  return (
    <section
      id="cara-kerja"
      aria-labelledby="how-heading"
      className="grain-overlay bg-primary text-primary-foreground"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        {/* Section heading */}
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-16">
          <Reveal>
            <div>
              <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
                Cara kerja ReBites
              </p>
              <h2
                id="how-heading"
                className="mt-4 text-balance font-display text-[clamp(1.75rem,3.4vw,2.85rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-white"
              >
                Dua peran, tiga langkah.
              </h2>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <p className="max-w-xl text-[15px] leading-[1.8] text-white/75 lg:pb-1">
              ReBites menghubungkan makanan surplus yang masih layak konsumsi
              dengan orang yang membutuhkannya. Pilih peranmu, lalu mulai dengan
              cara yang sederhana.
            </p>
          </Reveal>
        </div>

        {/* Audience switch */}
        <Reveal delay={0.08}>
          <div className="mt-10 flex flex-col gap-4 border-t border-white/15 pt-6 sm:mt-12 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
              Pilih peranmu
            </p>

            <div
              role="tablist"
              aria-label="Pilih alur penggunaan ReBites"
              className="grid w-full grid-cols-2 gap-1 rounded-full border border-white/15 p-1 sm:w-auto"
            >
              {PATH_KEYS.map((key, index) => {
                const selected = active === key;

                return (
                  <button
                    key={key}
                    ref={(el) => {
                      tabRefs.current[key] = el;
                    }}
                    id={`cara-tab-${key}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls="cara-panel"
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActive(key)}
                    onKeyDown={(event) => handleTabKeyDown(event, index)}
                    className={cn(
                      'relative isolate min-h-11 rounded-full px-5 py-2.5 font-secondary text-sm font-semibold transition-colors duration-200 sm:px-6',
                      selected
                        ? 'text-primary'
                        : 'text-white/80 hover:text-white',
                      FOCUS_RING_ON_GREEN,
                    )}
                  >
                    {selected && (
                      <motion.span
                        layoutId={
                          shouldReduceMotion ? undefined : 'rebites-audience-tab'
                        }
                        transition={{
                          type: 'spring',
                          stiffness: 380,
                          damping: 32,
                        }}
                        className="absolute inset-0 -z-10 rounded-full bg-white"
                      />
                    )}
                    {PATHS[key].label}
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* Steps */}
        <motion.div
          key={active}
          role="tabpanel"
          id="cara-panel"
          aria-labelledby={`cara-tab-${active}`}
          variants={shouldReduceMotion ? undefined : panelVariants}
          initial={shouldReduceMotion ? false : 'hidden'}
          whileInView={shouldReduceMotion ? undefined : 'visible'}
          viewport={{ once: true, amount: 0.2 }}
          className="mt-8 sm:mt-10"
        >
          <div>
            <p className="font-secondary text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
              {path.eyebrow}
            </p>
            <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {path.heading}{' '}
              <span className="font-light text-white/75">{path.headingTail}</span>
            </h3>
          </div>

          <motion.ol
            variants={shouldReduceMotion ? undefined : listVariants}
            className="mt-8 grid gap-9 sm:mt-12 sm:grid-cols-3 sm:gap-6 lg:gap-12"
          >
            {path.steps.map((step, index) => (
              <motion.li
                key={step.title}
                variants={shouldReduceMotion ? undefined : stepVariants}
                className="list-none"
              >
                <span className="font-display text-xs font-semibold tabular-nums tracking-[0.16em] text-white/70">
                  {String(index + 1).padStart(2, '0')}
                </span>

                <h4 className="mt-4 font-display text-xl font-semibold tracking-tight text-white">
                  {step.title}
                </h4>

                <p className="mt-3 text-sm leading-[1.75] text-white/80">
                  {step.description}
                </p>

                <p className="mt-3 text-xs leading-[1.7] text-white/70">
                  {step.detail}
                </p>
              </motion.li>
            ))}
          </motion.ol>

          {/* CTA */}
          <div className="mt-12 flex flex-col gap-5 border-t border-white/15 pt-7 sm:mt-14 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:pt-8">
            <p className="max-w-md text-sm leading-[1.75] text-white/75">
              {path.note}
            </p>

            <Link
              href={path.cta.href}
              className={cn(
                'group inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full bg-white px-7 font-secondary text-sm font-semibold text-primary transition-colors duration-200 hover:bg-white/90 sm:w-auto',
                FOCUS_RING_ON_GREEN,
              )}
            >
              {path.cta.label}
              <ArrowRight
                size={16}
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:translate-x-1"
              />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
