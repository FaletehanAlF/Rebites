"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { BuyerShell } from "@/app/components/shared/buyer-shell";
import { RequireAuth } from "@/app/components/auth/require-auth";
import { AnimatedRupiah } from "@/app/components/subscription/animated-rupiah";
import { cn } from "@/lib/utils";
import { SUBSCRIPTION_PLANS, getYearlyMultiplier, getYearlyPerMonth, type BillingCycle, } from "@/lib/subscription-plans";
import { useCurrentUser } from "@/lib/current-user";
import { getSellerStoreSettings } from "@/lib/store-settings-storage";
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const BILLING_OPTIONS: {
    key: BillingCycle;
    label: string;
}[] = [
    { key: "monthly", label: "Bulanan" },
    { key: "yearly", label: "Tahunan" },
];
function LanggananView() {
    const { userId } = useCurrentUser();
    const [billing, setBilling] = useState<BillingCycle>("monthly");
    const [hasStore, setHasStore] = useState(false);
    useEffect(() => {
        let mounted = true;
        (async () => {
            const settings = await getSellerStoreSettings();
            if (mounted)
                setHasStore(!!settings);
        })();
        return () => {
            mounted = false;
        };
    }, [userId]);
    return (<BuyerShell>
      <main className="bg-background pb-20 lg:pb-12">
        <div className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
            <h1 className="mt-0 font-display text-2xl font-semibold tracking-[-0.01em] text-foreground">
              Langganan
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Paket penjual ReBites. Pilih paket yang sesuai kebutuhan usaha Anda,
              dibayar bulanan atau tahunan.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div role="group" aria-label="Siklus pembayaran" className="inline-flex items-center rounded-full border border-border bg-white p-1">
            {BILLING_OPTIONS.map((option) => {
                const active = billing === option.key;
                return (<button key={option.key} type="button" aria-pressed={active} onClick={() => setBilling(option.key)} className={cn("inline-flex min-h-[44px] items-center rounded-full px-5 font-sans text-xs font-semibold transition-colors duration-150", active
                        ? "bg-primary text-white"
                        : "text-muted-foreground hover:text-primary", FOCUS_RING)}>
                  {option.label}
                </button>);
            })}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
            {SUBSCRIPTION_PLANS.map((plan) => {
                const yearlyMode = billing === "yearly";
                const priceValue = yearlyMode ? plan.yearly : plan.monthly;
                const yearlyMultiplier = getYearlyMultiplier(plan);
                const yearlyPerMonth = getYearlyPerMonth(plan);
                const subLine = plan.monthly <= 0
                    ? "Tidak perlu langganan"
                    : yearlyMode
                        ? yearlyPerMonth !== null
                            ? `Setara Rp${yearlyPerMonth.toLocaleString("id-ID")} / bulan`
                            : `Total Rp${plan.yearly.toLocaleString("id-ID")} / tahun`
                        : `atau Rp${plan.yearly.toLocaleString("id-ID")} / tahun`;
                const href = userId && hasStore
                    ? `/langganan/pembayaran?plan=${plan.slug}&billing=${billing}`
                    : `/auth/register/penjual?plan=${plan.slug}&billing=${billing}`;
                return (<article key={plan.slug} className={cn("relative flex h-full flex-col rounded-2xl border bg-white p-6", plan.popular
                        ? "border-primary/45"
                        : "border-border")}>
                  {plan.popular && (<span className="absolute right-6 top-6 rounded-full bg-primary px-2.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
                      Populer
                    </span>)}

                  <h2 className="font-sans text-base font-bold tracking-tight text-foreground sm:text-[17px]">
                    ReBites {plan.name}
                  </h2>
                  <p className="mt-1.5 min-h-[2.5rem] max-w-[260px] font-sans text-xs leading-relaxed text-muted-foreground">
                    {plan.tagline}
                  </p>

                  <div className="mt-5 flex items-baseline gap-1.5 text-foreground">
                    {priceValue === 0 ? (<span className="font-sans text-[1.75rem] font-bold leading-none tracking-tight sm:text-[2rem]">
                        Gratis
                      </span>) : (<AnimatedRupiah value={priceValue} className="font-sans text-[1.75rem] font-bold leading-none tracking-tight tabular-nums sm:text-[2rem]"/>)}
                    <span className="font-sans text-xs text-muted-foreground">
                      /{yearlyMode ? "tahun" : "bulan"}
                    </span>
                  </div>

                  <p className="mt-1.5 flex min-h-[1.25rem] flex-wrap items-center gap-x-2 gap-y-1 font-sans text-[11px] text-muted-foreground">
                    <span>{subLine}</span>
                    {yearlyMode && yearlyMultiplier ? (<span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-primary">
                        Bayar {yearlyMultiplier} bulan
                      </span>) : null}
                  </p>

                  <ul className="mt-5 space-y-2.5 border-t border-border pt-5">
                    {plan.features.map((feature) => (<li key={feature} className="flex items-start gap-2 font-sans text-[13px] leading-snug text-foreground/80">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden/>
                        <span>{feature}</span>
                      </li>))}
                  </ul>

                  <div className="mt-auto pt-6">
                    <Link href={href} className={cn("inline-flex min-h-[44px] w-full items-center justify-center rounded-full px-5 font-sans text-sm font-semibold transition-colors duration-150", plan.popular
                        ? "bg-primary text-white hover:bg-primary-dark"
                        : "border border-primary/40 text-primary hover:bg-primary hover:text-white", FOCUS_RING)}>
                      {plan.cta}
                    </Link>
                  </div>
                </article>);
            })}
          </div>
        </div>

      </main>
    </BuyerShell>);
}
export default function LanggananPage() {
    return (<RequireAuth>
      <LanggananView />
    </RequireAuth>);
}
