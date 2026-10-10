import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { Reveal } from '@/app/components/shared/reveal';
import { SectionHeading } from '@/app/components/landing/SectionHeading';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription-plans';
import { formatRupiah } from '@/lib/data';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Pratinjau membership di halaman landing.
 *
 * Daftar paket diambil langsung dari `lib/subscription-plans.ts` — sumber
 * yang sama dengan halaman pembayaran langganan — sehingga harga dan
 * manfaat di sini tidak bisa menyimpang dari produk yang sebenarnya.
 * Section ini hanya pratinjau; keputusan pembelian terjadi di
 * `/langganan/pembayaran?plan=…`.
 */
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

        <ul className="mt-10 grid gap-4 sm:mt-12 sm:gap-5 lg:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan, index) => (
            <Reveal
              key={plan.slug}
              as="li"
              delay={index * 0.06}
              className="h-full"
            >
              <div
                className={`flex h-full flex-col rounded-2xl border p-6 sm:p-7 ${
                  plan.popular ? 'border-primary' : 'border-border'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-lg font-semibold tracking-tight text-primary">
                    ReBites {plan.name}
                  </h3>
                  {plan.popular && (
                    <span className="rounded-full bg-accent px-2.5 py-0.5 font-secondary text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                      Populer
                    </span>
                  )}
                </div>

                <p className="mt-2 text-sm leading-[1.7] text-muted-foreground">
                  {plan.tagline}
                </p>

                <p className="mt-5 flex items-baseline gap-1.5">
                  <span className="font-display text-3xl font-bold tabular-nums tracking-tight text-primary">
                    {plan.monthly === 0 ? 'Gratis' : formatRupiah(plan.monthly)}
                  </span>
                  {plan.monthly > 0 && (
                    <span className="font-secondary text-xs text-muted-foreground">
                      /bulan
                    </span>
                  )}
                </p>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-sm leading-[1.7] text-muted-foreground"
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-primary"
                      >
                        <Check className="h-3 w-3" strokeWidth={3.25} />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/langganan/pembayaran?plan=${plan.slug}`}
                  className={`group mt-7 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-7 font-secondary text-sm font-semibold transition-colors duration-300 ${
                    plan.popular
                      ? 'bg-primary text-white hover:bg-primary-dark'
                      : 'border border-border bg-white text-primary hover:border-primary'
                  } ${FOCUS_RING}`}
                >
                  {plan.cta}
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden
                  />
                </Link>
              </div>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={0.05}>
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            Harga ditampilkan per bulan; penagihan tahunan tersedia saat
            pembayaran. Pembeli tidak perlu berlangganan.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
