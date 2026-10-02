'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Reveal } from '@/app/components/shared/reveal';
import { MagneticButton } from '@/app/components/shared/magnetic-button';
import { SectionShell } from '@/app/components/section-shell';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription-plans';

export function SubscriptionSection() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <SectionShell
      id="langganan"
      dataNav="neutral"
      tone="neutral"
      className="flex min-h-[100svh] flex-col pt-20 pb-16 lg:pt-20 lg:pb-20"
    >
      <div className="mx-auto max-w-3xl text-center">
        <Reveal delay={0.1}>
          <h2 className="mt-6 font-display text-[clamp(2rem,4.5vw,3.5rem)] font-light leading-[1.02] tracking-[-0.02em] text-primary-dark">
            Kembangkan usaha bersama <span className="text-primary">ReBites.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.15}>
          <p className="mx-auto mt-5 max-w-xl font-sans text-sm leading-relaxed text-muted-foreground">
            Pilih paket penjual sesuai kebutuhan usaha Anda untuk mengelola
            produk, memantau penjualan, dan menjangkau lebih banyak pelanggan
            melalui ReBites.
          </p>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="mt-8 flex justify-center">
            <div className="relative inline-flex items-center rounded-full border border-border bg-white p-1">
              {[
                { key: 'monthly', label: 'Bulanan' },
                { key: 'yearly', label: 'Tahunan' },
              ].map((mode) => {
                const active = billing === mode.key;

                return (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => setBilling(mode.key as 'monthly' | 'yearly')}
                    className={`relative z-10 flex items-center gap-2 rounded-full px-5 py-2 font-sans text-xs font-medium tracking-tight transition-colors duration-300 ${
                      active
                        ? 'text-primary-foreground'
                        : 'text-muted-foreground hover:text-primary'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="billing-pill"
                        className="absolute inset-0 rounded-full bg-primary"
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                      />
                    )}

                    <span className="relative z-10">{mode.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>

      <div className="mx-auto mt-14 grid max-w-[1080px] gap-5 lg:mt-16 lg:grid-cols-3">
        {SUBSCRIPTION_PLANS.map((plan, i) => {
          const yearlyMode = billing === 'yearly';

          const priceValue = yearlyMode ? plan.yearly : plan.monthly;

          const priceLabel =
            priceValue === 0
              ? 'Gratis'
              : `Rp${priceValue.toLocaleString('id-ID')}`;

          const priceSuffix =
            priceValue === 0 ? '' : yearlyMode ? '/tahun' : '/bulan';

          const subLine =
            plan.monthly === 0
              ? 'Tidak Perlu Langganan'
              : yearlyMode
                ? `Setara Rp${Math.round(plan.yearly / 12).toLocaleString(
                    'id-ID',
                  )} / bulan`
                : `atau Rp${plan.yearly.toLocaleString('id-ID')} / tahun`;

          return (
            <Reveal key={plan.name} delay={i * 0.1} className="h-full">
              <div className="relative flex h-full flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-background p-8 shadow-[0_10px_30px_-24px_rgba(34,81,56,0.3)] transition-all duration-300 hover:-translate-y-1 hover:border-primary lg:p-9">
                {plan.popular && (
                  <div className="absolute right-5 top-5 rounded-full bg-primary px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                    Paling Populer
                  </div>
                )}

                <div className="relative flex items-center justify-between">
                  <span className="font-sans text-sm italic tracking-[0.2em] text-primary">
                    0{i + 1}
                  </span>
                </div>

                <h3 className="mt-4 font-sans text-2xl font-bold tracking-tight text-primary">
                  ReBites {plan.name}
                </h3>

                <p className="mt-2 min-h-[2.5rem] max-w-[250px] font-sans text-xs leading-relaxed italic text-muted-foreground">
                  {plan.tagline}
                </p>

                <div className="mt-6 flex min-h-[3.5rem] items-end gap-2 text-primary">
                  <div className="relative flex h-[3.5rem] shrink-0 flex-col items-start">
                    <div className="mt-auto overflow-hidden">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={priceLabel}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -16 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          className="block whitespace-nowrap font-sans text-[clamp(2.4rem,3vw,3rem)] font-light leading-[3rem] tracking-tight tabular-nums"
                        >
                          {priceLabel}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                  </div>

                  {priceSuffix && (
                    <span className="mb-1 shrink-0 whitespace-nowrap font-sans text-sm text-muted-foreground">
                      {priceSuffix}
                    </span>
                  )}
                </div>

                <p className="mt-1 min-h-[2rem] font-sans text-xs text-muted-foreground">
                  {subLine}
                </p>

                <div className="relative mt-7 pt-7 text-foreground/75">
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-px"
                    style={{
                      background:
                        'repeating-linear-gradient(90deg, currentColor 0 5px, transparent 5px 10px)',
                      opacity: 0.35,
                    }}
                  />
                  <span
                    aria-hidden
                    className="absolute left-1/2 top-0 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rotate-45 bg-primary/50"
                  />

                  <ul className="space-y-3">
                    {plan.features.map((feature, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-3 font-sans text-sm"
                      >
                        <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-primary/30 text-primary">
                          <svg viewBox="0 0 10 10" className="h-2 w-2" aria-hidden>
                            <path
                              d="M2 5.2l2 2 3.8-4"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              fill="none"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>

                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="relative mt-auto pt-8">
                  <MagneticButton
                    href={`/auth/register?plan=${plan.slug}&billing=${billing}`}
                    variant="outline"
                    className="group w-full bg-white"
                  >
                    {plan.cta}

                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </MagneticButton>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </SectionShell>
  );
}

export default SubscriptionSection;