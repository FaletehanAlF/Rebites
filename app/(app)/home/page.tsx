"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { BuyerShell } from "@/app/components/shared/buyer-shell";
import { Hero } from "@/app/components/home/Hero";
import { UrgentDealsSection } from "@/app/components/home/UrgentDealsSection";
import { FlashSaleSection } from "@/app/components/home/FlashSaleSection";
import { CategorySection } from "@/app/components/home/CategorySection";
import { VendorSection } from "@/app/components/home/VendorSection";
import { AppFooter } from "@/app/components/shared/app-footer";
import { StoreClosedModal } from "@/app/components/shared/StoreClosedModal";
import { AnimatedRupiah } from "@/app/components/subscription/animated-rupiah";
import { useStoreClosedModal } from "@/lib/store-closed-modal-store";
import { SUBSCRIPTION_PLANS, getYearlyMultiplier, getYearlyPerMonth, } from "@/lib/subscription-plans";
import { useCurrentUser } from "@/lib/current-user";
import { RequireAuth } from "@/app/components/auth/require-auth";
import { getSellerStoreSettings } from "@/lib/store-settings-storage";
import { scrollToId } from "@/lib/scroll";
import { cn } from "@/lib/utils";
type Billing = "monthly" | "yearly";
const BILLING_OPTIONS: {
    key: Billing;
    label: string;
}[] = [
    { key: "monthly", label: "Bulanan" },
    { key: "yearly", label: "Tahunan" },
];
const PRICE_MOTION = {
    duration: 0.22,
    ease: [0.22, 1, 0.36, 1] as const,
};
function BillingToggle({ billing, onChange, }: {
    billing: Billing;
    onChange: (next: Billing) => void;
}) {
    const reducedMotion = useReducedMotion();
    return (<div role="group" aria-label="Siklus pembayaran" className="relative mt-6 inline-flex items-center rounded-full border border-border bg-white p-1">
      {BILLING_OPTIONS.map((option) => {
            const active = billing === option.key;
            return (<button key={option.key} type="button" aria-pressed={active} onClick={() => onChange(option.key)} className={cn("relative z-10 rounded-full px-5 py-2 font-sans text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2", active ? "text-white" : "text-muted-foreground hover:text-primary")}>
            
            {active && (<motion.span layoutId="billing-pill" aria-hidden className="absolute inset-0 -z-10 rounded-full bg-primary" transition={reducedMotion
                        ? { duration: 0 }
                        : { type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] }}/>)}
            {option.label}
          </button>);
        })}
    </div>);
}
function SubscriptionSection({ userId }: {
    userId: string | null;
}) {
    const [billing, setBilling] = useState<Billing>("monthly");
    const [hasStore, setHasStore] = useState(false);
    const gridRef = useRef<HTMLDivElement>(null);
    const [gridHeight, setGridHeight] = useState<number | null>(null);
    const reducedMotion = useReducedMotion();
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
    useEffect(() => {
        const el = gridRef.current;
        if (!el || typeof ResizeObserver === "undefined")
            return;
        const observer = new ResizeObserver(() => {
            setGridHeight((prev) => Math.max(prev ?? 0, el.scrollHeight));
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    return (<section id="langganan" data-nav="neutral" className="scroll-mt-20 py-10 sm:py-12 lg:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-secondary text-[10px] font-semibold uppercase tracking-[0.22em] text-primary sm:text-[11px]">
            Untuk penjual
          </p>
          <h2 className="mt-2 font-sans text-lg font-bold leading-tight tracking-tight text-foreground sm:text-[22px] lg:text-[26px]">
            Kembangkan usaha bersama ReBites
          </h2>
          <p className="mx-auto mt-2 max-w-xl font-sans text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Pilih paket penjual yang sesuai kebutuhan usaha Anda.
          </p>

          <BillingToggle billing={billing} onChange={setBilling}/>
        </div>

        <div ref={gridRef} style={gridHeight ? { minHeight: gridHeight } : undefined} className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const yearlyMode = billing === "yearly";
            const priceValue = yearlyMode ? plan.yearly : plan.monthly;
            const priceSuffix = priceValue === 0 ? "" : yearlyMode ? "/tahun" : "/bulan";
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
            return (<div key={plan.name} className={cn("relative flex h-full flex-col rounded-2xl border bg-white p-5 sm:p-6", plan.popular
                    ? "border-primary/45"
                    : "border-border")}>
                {plan.popular && (<span className="absolute right-5 top-5 rounded-full bg-primary px-2.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
                    Populer
                  </span>)}

                <h3 className="font-sans text-base font-bold tracking-tight text-foreground sm:text-[17px]">
                  ReBites {plan.name}
                </h3>
                <p className="mt-1.5 min-h-[2.5rem] max-w-[260px] font-sans text-xs leading-relaxed text-muted-foreground">
                  {plan.tagline}
                </p>

                <div className="mt-4 flex items-baseline gap-1.5 text-foreground">
                  {priceValue === 0 ? (<span className="font-sans text-[1.75rem] font-bold leading-none tracking-tight sm:text-[2rem]">
                      Gratis
                    </span>) : (<AnimatedRupiah value={priceValue} className="font-sans text-[1.75rem] font-bold leading-none tracking-tight tabular-nums sm:text-[2rem]"/>)}
                  
                  <span className="relative inline-block h-[1.1em] min-w-[3.25rem] overflow-hidden font-sans text-xs text-muted-foreground">
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span key={priceSuffix || "free"} initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reducedMotion ? 0 : -6, position: "absolute", left: 0, top: 0 }} transition={reducedMotion ? { duration: 0 } : PRICE_MOTION} className="whitespace-nowrap">
                        {priceSuffix}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                </div>

                
                <p className="mt-1 flex min-h-[1.25rem] flex-wrap items-center gap-x-2 gap-y-1 font-sans text-[11px] text-muted-foreground">
                  <span>{subLine}</span>
                  <AnimatePresence initial={false}>
                    {yearlyMode && yearlyMultiplier ? (<motion.span key="saving" initial={{ opacity: 0, x: reducedMotion ? 0 : -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reducedMotion ? 0 : -6 }} transition={reducedMotion ? { duration: 0 } : PRICE_MOTION} className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-primary">
                        Bayar {yearlyMultiplier} bulan
                      </motion.span>) : null}
                  </AnimatePresence>
                </p>

                <ul className="mt-5 space-y-2.5 border-t border-border pt-5">
                  {plan.features.map((feature) => (<li key={feature} className="flex items-start gap-2 font-sans text-[13px] leading-snug text-foreground/80">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden/>
                      <span>{feature}</span>
                    </li>))}
                </ul>

                <a href={href} className={cn("group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 font-sans text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2", plan.popular
                    ? "bg-primary text-white hover:bg-primary-dark"
                    : "border border-primary/40 text-primary hover:bg-primary hover:text-white")}>
                  {plan.cta}
                  <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden/>
                </a>
              </div>);
        })}
        </div>
      </div>
    </section>);
}
function HomePageContent() {
    const { userId } = useCurrentUser();
    const router = useRouter();
    const storeClosedModal = useStoreClosedModal();
    const handleViewDetail = useCallback((id: string) => {
        router.push(`/detail/product?id=${encodeURIComponent(id)}`);
    }, [router]);
    useEffect(() => {
        const scrollToHash = () => {
            const id = window.location.hash.replace(/^#/, "");
            if (!id)
                return;
            scrollToId(id);
        };
        const timer = window.setTimeout(scrollToHash, 0);
        window.addEventListener("hashchange", scrollToHash);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener("hashchange", scrollToHash);
        };
    }, []);
    return (<BuyerShell>
      <main className="bg-secondary pb-20 lg:pb-0">
        <Hero />
        <CategorySection />
        <UrgentDealsSection from="home" onViewDetail={handleViewDetail}/>
        <FlashSaleSection onViewDetail={handleViewDetail}/>
        <VendorSection />
        <SubscriptionSection userId={userId}/>
        <AppFooter hasMobileBottomNav />
      </main>

      <StoreClosedModal isOpen={storeClosedModal.isOpen} onClose={storeClosedModal.close} availableFrom={storeClosedModal.availableFrom} availableTo={storeClosedModal.availableTo}/>
    </BuyerShell>);
}
export default function HomePage() {
    return (<RequireAuth>
      <HomePageContent />
    </RequireAuth>);
}
