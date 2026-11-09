import Link from 'next/link';
import { ArrowRight, Check, MessageCircle } from 'lucide-react';
import { Reveal } from '@/app/components/shared/reveal';
import { SectionHeading } from '@/app/components/landing/SectionHeading';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription-plans';
import { formatRupiah } from '@/lib/data';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

// Kartu Max gelap: ganti ring fokus ke hijau + offset gelap (kontras).
const FOCUS_RING_MAX =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#245C43] focus-visible:ring-offset-2 focus-visible:ring-offset-[#202820]';

export function MembershipSection() {
  return (
    <section
      id="langganan"
      aria-labelledby="membership-heading"
      className="border-t border-border bg-white"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <SectionHeading
          id="membership-heading"
          heading="Paket Langganan untuk Kebutuhan Usahamu."
          description="Setiap paket menentukan seberapa banyak produk yang bisa ditampilkan. Pembeli tidak dikenakan biaya langganan — cukup buat akun dan mulai memesan."
        />

        <ul className="mt-10 grid gap-4 sm:mt-12 sm:gap-5 lg:grid-cols-3 lg:items-stretch lg:gap-6">
          {SUBSCRIPTION_PLANS.map((plan, index) => {
            const featured = plan.popular;

            return (
              <Reveal
                key={plan.slug}
                as="li"
                delay={index * 0.06}
                className="flex h-full flex-col"
              >
                <div
                  className={`relative flex h-full flex-1 flex-col overflow-hidden rounded-2xl border p-6 sm:p-7 ${featured
                    ? 'border-[#202820] bg-white text-black'
                    : 'border-border bg-white'
                    }`}
                >
                  {featured && (
                    <>
                      <div
                        aria-hidden
                        className="absolute inset-x-0 top-0 h-1.5 bg-[#245C43]"
                      />
                    </>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className={`font-display text-lg font-semibold tracking-tight ${featured ? 'text-black' : 'text-foreground'
                        }`}
                    >
                      ReBites {plan.name}
                    </h3>
                    {featured && (
                      <span className="rounded-full bg-[#245C43] px-2.5 py-0.5 font-secondary text-[11px] font-bold text-[#ffffff]">
                        Populer
                      </span>
                    )}
                  </div>

                  <p
                    className={`mt-2 min-h-[3rem] text-sm leading-[1.7] ${featured ? 'text-black/75' : 'text-muted-foreground'
                      }`}
                  >
                    {plan.tagline}
                  </p>

                  <p className="mt-5 flex items-baseline gap-1.5">
                    <span
                      className={`font-display font-bold tabular-nums tracking-tight ${featured
                        ? 'text-4xl text-[#000000] sm:text-[2.5rem]'
                        : 'text-3xl text-primary'
                        }`}
                    >
                      {plan.monthly === 0 ? 'Gratis' : formatRupiah(plan.monthly)}
                    </span>
                    {plan.monthly > 0 && (
                      <span
                        className={`font-secondary text-xs ${featured ? 'text-black/70' : 'text-muted-foreground'
                          }`}
                      >
                        /bulan
                      </span>
                    )}
                  </p>

                  <ul
                    className={`mt-6 flex-1 space-y-2.5 pb-10 ${featured ? 'border-t border-border pt-6' : ''
                      }`}
                  >
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className={`flex items-start gap-2.5 text-sm leading-[1.7] ${featured ? 'text-black' : 'text-muted-foreground'
                          }`}
                      >
                        <span
                          aria-hidden
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center ${featured ? 'text-[#245C43]' : 'rounded-full bg-accent text-primary'
                            }`}
                        >
                          <Check
                            className={featured ? 'h-4 w-4' : 'h-3 w-3'}
                            strokeWidth={3.25}
                          />
                        </span>
                        {feature}
                      </li>
                    ))}

                  </ul>

                  <Link
                    href={`/langganan/pembayaran?plan=${plan.slug}`}
                    className={`group mt-auto inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-full px-7 font-secondary text-sm font-semibold transition-colors duration-300 ${featured
                      ? `bg-[#245C43] text-[#ffffff] ${FOCUS_RING_MAX}`
                      : `border border-border bg-white text-primary hover:border-primary ${FOCUS_RING}`
                      }`}
                  >
                    {plan.cta}
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                      aria-hidden
                    />
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </ul>
        <Reveal delay={0.08}>
          <div className="mt-10 flex flex-col items-center gap-3 text-center sm:mt-12">
            <p className="text-sm text-muted-foreground">
              Masih punya pertanyaan tentang paket langganan?
            </p>

            <Link
              href="/hubungi-kami"
              className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-[#245C43] px-6 py-3 font-secondary text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#1D4B36] ${FOCUS_RING}`}
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Hubungi Kami
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                aria-hidden
              />
            </Link>
          </div>
        </Reveal>

      </div>
    </section>
  );
}