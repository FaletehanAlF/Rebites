"use client";

<<<<<<< HEAD
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { BuyerShell } from "@/app/components/shared/buyer-shell";
import { Hero } from "@/app/components/home/Hero";
import { UrgentDealsSection } from "@/app/components/home/UrgentDealsSection";
import { FlashSaleSection } from "@/app/components/home/FlashSaleSection";
import { CategorySection } from "@/app/components/home/CategorySection";
import { VendorSection } from "@/app/components/home/VendorSection";
import { SiteFooter } from "@/app/components/site-footer";
=======
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { ProfileNavbar } from "@/app/components/shared/navbar";
import { MobileNavbar } from "@/app/components/shared/MobileNavbar";
import { MobileBottomNav } from "@/app/components/shared/MobileBottomNav";
import { Hero } from "@/app/components/buyer/home/Hero";
import { UrgentDealsSection } from "@/app/components/buyer/home/UrgentDealsSection";
import { FlashSaleSection } from "@/app/components/buyer/home/FlashSaleSection";
import { CategorySection } from "@/app/components/buyer/home/CategorySection";
import { VendorSection } from "@/app/components/buyer/home/VendorSection";
import { SiteFooter } from "@/app/components/shared/app-footer";
import { Reveal } from "@/app/components/shared/reveal";
import { MagneticButton } from "@/app/components/shared/magnetic-button";
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34
import { ProductDetailModal } from "@/app/components/shared/ProductDetailModalLazy";
import { StoreClosedModal } from "@/app/components/shared/StoreClosedModal";
import { AnimatedRupiah } from "@/app/components/subscription/animated-rupiah";
import { useStoreClosedModal } from "@/lib/store-closed-modal-store";
<<<<<<< HEAD
import { useProductDetail } from "@/app/components/detail-product/use-product-detail";
import {
  SUBSCRIPTION_PLANS,
  getYearlyMultiplier,
  getYearlyPerMonth,
} from "@/lib/subscription-plans";
=======
import { useProductDetail } from "@/app/components/buyer/detail-product/use-product-detail";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34
import { useCurrentUser } from "@/lib/current-user";
import { RequireAuth } from "@/app/components/auth/require-auth";
import { getSellerStoreSettings } from "@/lib/store-settings-storage";
import { scrollToId } from "@/lib/scroll";
import { cn } from "@/lib/utils";

type Billing = "monthly" | "yearly";

const BILLING_OPTIONS: { key: Billing; label: string }[] = [
  { key: "monthly", label: "Bulanan" },
  { key: "yearly", label: "Tahunan" },
];

/** Transisi harga: cepat, tanpa overshoot, hanya opacity + geser kecil. */
const PRICE_MOTION = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1] as const,
};

function BillingToggle({
  billing,
  onChange,
}: {
  billing: Billing;
  onChange: (next: Billing) => void;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <div
      role="group"
      aria-label="Siklus pembayaran"
      className="relative mt-6 inline-flex items-center rounded-full border border-border bg-white p-1"
    >
      {BILLING_OPTIONS.map((option) => {
        const active = billing === option.key;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.key)}
            className={cn(
              "relative z-10 rounded-full px-5 py-2 font-sans text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              active ? "text-white" : "text-muted-foreground hover:text-primary",
            )}
          >
            {/*
              Indikator aktif digambar sebagai satu elemen `layoutId` yang
              bergeser — hanya transform, bukan latar per tombol yang berganti
              mendadak. `layout` tidak dipakai agar dimensi tombol tidak
              dianimasikan (tidak ada reflow saat label berubah).
            */}
            {active && (
              <motion.span
                layoutId="billing-pill"
                aria-hidden
                className="absolute inset-0 -z-10 rounded-full bg-primary"
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] }
                }
              />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function SubscriptionSection({ userId }: { userId: string | null }) {
  const [billing, setBilling] = useState<Billing>("monthly");
  const [hasStore, setHasStore] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridHeight, setGridHeight] = useState<number | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const settings = await getSellerStoreSettings();
      if (mounted) setHasStore(!!settings);
    })();
    return () => {
      mounted = false;
    };
  }, [userId]);

  /*
   * Tinggi grid dikunci ke tinggi TERBESAR antara dua mode, bukan ke tinggi
   * mode yang sedang aktif. Baris tambahan teks (mis. "Hemat 2 bulan") membuat
   * kartu tahunan lebih tinggi; jika tinggi mengikuti mode aktif, halaman akan
   * melompat setiap kali pengguna menekan Tahunan lalu Bulanan.
   */
  useEffect(() => {
    const el = gridRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      setGridHeight((prev) => Math.max(prev ?? 0, el.scrollHeight));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="langganan"
      data-nav="neutral"
      className="scroll-mt-20 bg-secondary py-10 sm:py-12 lg:py-14"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-secondary text-[10px] font-semibold uppercase tracking-[0.22em] text-primary sm:text-[11px]">
            Untuk penjual
          </p>
          <h2 className="mt-2 font-sans text-lg font-bold leading-tight tracking-tight text-foreground sm:text-[22px] lg:text-[26px]">
            Kembangkan usaha bersama ReBites
          </h2>
          <p className="mx-auto mt-2 max-w-xl font-sans text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Pilih paket penjual yang sesuai kebutuhan usaha Anda. Kelola produk,
            pantau penjualan, dan jangkau lebih banyak pelanggan.
          </p>

          <BillingToggle billing={billing} onChange={setBilling} />
        </div>

        <div
          ref={gridRef}
          style={gridHeight ? { minHeight: gridHeight } : undefined}
          className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
        >
          {SUBSCRIPTION_PLANS.map((plan) => {
            const yearlyMode = billing === "yearly";
            const priceValue = yearlyMode ? plan.yearly : plan.monthly;
            const priceSuffix =
              priceValue === 0 ? "" : yearlyMode ? "/tahun" : "/bulan";
            const yearlyMultiplier = getYearlyMultiplier(plan);
            const yearlyPerMonth = getYearlyPerMonth(plan);
            const subLine =
              plan.monthly <= 0
                ? "Tidak perlu langganan"
                : yearlyMode
                  ? yearlyPerMonth !== null
                    ? `Setara Rp${yearlyPerMonth.toLocaleString("id-ID")} / bulan`
                    : `Total Rp${plan.yearly.toLocaleString("id-ID")} / tahun`
                  : `atau Rp${plan.yearly.toLocaleString("id-ID")} / tahun`;

            const href =
              userId && hasStore
                ? `/langganan/pembayaran?plan=${plan.slug}&billing=${billing}`
                : `/auth/register/penjual?plan=${plan.slug}&billing=${billing}`;

            return (
              <div
                key={plan.name}
                className={cn(
                  "relative flex h-full flex-col rounded-2xl border bg-white p-5 sm:p-6",
                  plan.popular
                    ? "border-primary/45"
                    : "border-border",
                )}
              >
                {plan.popular && (
                  <span className="absolute right-5 top-5 rounded-full bg-primary px-2.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-white">
                    Populer
                  </span>
                )}

                <h3 className="font-sans text-base font-bold tracking-tight text-foreground sm:text-[17px]">
                  ReBites {plan.name}
                </h3>
                <p className="mt-1.5 min-h-[2.5rem] max-w-[260px] font-sans text-xs leading-relaxed text-muted-foreground">
                  {plan.tagline}
                </p>

                <div className="mt-4 flex items-baseline gap-1.5 text-foreground">
                  {priceValue === 0 ? (
                    <span className="font-sans text-[1.75rem] font-bold leading-none tracking-tight sm:text-[2rem]">
                      Gratis
                    </span>
                  ) : (
                    <AnimatedRupiah
                      value={priceValue}
                      className="font-sans text-[1.75rem] font-bold leading-none tracking-tight tabular-nums sm:text-[2rem]"
                    />
                  )}
                  {/*
                    Label periode diganti dengan transisi geser + pudar yang
                    pendek, dan selalu ditumpuk di tempat yang sama (`overlay`)
                    supaya lebar area harga tidak ikut berubah saat teks
                    "/bulan" menjadi "/tahun".
                  */}
                  <span className="relative inline-block h-[1.1em] min-w-[3.25rem] overflow-hidden font-sans text-xs text-muted-foreground">
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span
                        key={priceSuffix || "free"}
                        initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: reducedMotion ? 0 : -6, position: "absolute", left: 0, top: 0 }}
                        transition={reducedMotion ? { duration: 0 } : PRICE_MOTION}
                        className="whitespace-nowrap"
                      >
                        {priceSuffix}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                </div>

                {/* Baris keterangan memakai tinggi minimum tetap: teks tahunan
                    lebih panjang daripada bulanan, dan tanpa kunci tinggi kartu
                    akan bergeser setiap pergantian mode. */}
                <p className="mt-1 flex min-h-[1.25rem] flex-wrap items-center gap-x-2 gap-y-1 font-sans text-[11px] text-muted-foreground">
                  <span>{subLine}</span>
                  <AnimatePresence initial={false}>
                    {yearlyMode && yearlyMultiplier ? (
                      <motion.span
                        key="saving"
                        initial={{ opacity: 0, x: reducedMotion ? 0 : -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: reducedMotion ? 0 : -6 }}
                        transition={reducedMotion ? { duration: 0 } : PRICE_MOTION}
                        className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-primary"
                      >
                        Bayar {yearlyMultiplier} bulan
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </p>

                <ul className="mt-5 space-y-2.5 border-t border-border pt-5">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 font-sans text-[13px] leading-snug text-foreground/80"
                    >
                      <Check
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary"
                        aria-hidden
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href={href}
                  className={cn(
                    "group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 font-sans text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    plan.popular
                      ? "bg-primary text-white hover:bg-primary-dark"
                      : "border border-primary/40 text-primary hover:bg-primary hover:text-white",
                  )}
                >
                  {plan.cta}
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HomePageContent() {
  const { userId } = useCurrentUser();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const storeClosedModal = useStoreClosedModal();

  const handleViewDetail = useCallback((id: string) => {
    setSelectedProductId(id);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedProductId(null);
  }, []);

  const selectedProduct = useProductDetail(selectedProductId);

  useEffect(() => {
    const scrollToHash = () => {
      const id = window.location.hash.replace(/^#/, "");
      if (!id) return;
      scrollToId(id);
    };

    const timer = window.setTimeout(scrollToHash, 0);
    window.addEventListener("hashchange", scrollToHash);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", scrollToHash);
    };
  }, []);

  return (
    <BuyerShell>
      <main className="bg-background pb-20 lg:pb-0">
        <Hero />
        <UrgentDealsSection from="home" onViewDetail={handleViewDetail} />
        <CategorySection />
        <FlashSaleSection onViewDetail={handleViewDetail} />
        <VendorSection />
<<<<<<< HEAD
        <SubscriptionSection userId={userId} />
=======

        <section
          id="langganan"
          data-nav="neutral"
          className="relative overflow-hidden bg-secondary py-10 sm:py-16 lg:py-20"
        >
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <Reveal delay={0.1}>
                <h2 className="mt-4 font-sans text-[clamp(1.5rem,4.5vw,3.5rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-primary sm:mt-6">
                  Kembangkan usaha bersama{" "}
                  <span className="text-primary">ReBites.</span>
                </h2>
              </Reveal>

              <Reveal delay={0.15}>
                <p className="mx-auto mt-5 max-w-xl font-sans text-sm leading-relaxed text-muted-foreground">
                  Pilih paket penjual yang sesuai dengan kebutuhan usaha Anda.
                  Kelola produk, pantau penjualan, dan dapatkan lebih banyak
                  kesempatan untuk menjangkau pelanggan melalui ReBites.
                </p>
              </Reveal>

              <Reveal delay={0.2}>
                <div className="mt-8 flex justify-center">
                  <div className="relative inline-flex items-center rounded-full border border-border bg-white p-1">
                    {[
                      { key: "monthly", label: "Bulanan" },
                      { key: "yearly", label: "Tahunan" },
                    ].map((mode) => {
                      const active = billing === mode.key;

                      return (
                        <button
                          key={mode.key}
                          type="button"
                          onClick={() =>
                            setBilling(mode.key as "monthly" | "yearly")
                          }
                          className={`relative z-10 flex items-center gap-2 rounded-full px-5 py-2 font-sans text-xs font-medium tracking-tight transition-colors duration-300 ${
                            active
                              ? "text-primary-foreground"
                              : "text-muted-foreground hover:text-primary"
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="billing-pill"
                              className="absolute inset-0 rounded-full bg-primary"
                              transition={{
                                type: "spring",
                                stiffness: 320,
                                damping: 28,
                              }}
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

            <div className="mx-auto mt-8 flex max-w-[1080px] gap-4 overflow-x-auto snap-x snap-mandatory pb-4 sm:mt-14 sm:gap-5 sm:overflow-visible sm:pb-0 sm:grid sm:grid-cols-1 lg:mt-16 lg:grid-cols-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SUBSCRIPTION_PLANS.map((plan, i) => {
                const yearlyMode = billing === "yearly";

                const priceValue = yearlyMode ? plan.yearly : plan.monthly;

                const priceLabel =
                  priceValue === 0
                    ? "Gratis"
                    : `Rp${priceValue.toLocaleString("id-ID")}`;

                const priceSuffix =
                  priceValue === 0 ? "" : yearlyMode ? "/tahun" : "/bulan";

                const subLine =
                  plan.monthly === 0
                    ? "Tidak Perlu Langganan"
                    : yearlyMode
                      ? `Setara Rp${Math.round(plan.yearly / 12).toLocaleString(
                          "id-ID",
                        )} / bulan`
                      : `atau Rp${plan.yearly.toLocaleString("id-ID")} / tahun`;

                return (
                  <Reveal key={plan.name} delay={i * 0.1} className="h-full min-w-[280px] snap-start sm:min-w-0">
                    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-background p-8 transition-colors duration-300 hover:border-primary/30 lg:p-9">
                      {plan.popular && (
                        <div className="absolute right-5 top-5 rounded-full bg-primary px-3 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                          Paling Populer
                        </div>
                      )}

                      <div className="relative flex items-center justify-between">
                        <span className="font-sans text-sm tracking-[0.2em] text-primary">
                          0{i + 1}
                        </span>
                      </div>

                      <h3 className="mt-4 font-sans text-2xl font-semibold tracking-tight text-primary">
                        ReBites {plan.name}
                      </h3>

                      <p className="mt-2 min-h-[2.5rem] max-w-[250px] font-sans text-xs leading-relaxed text-muted-foreground">
                        {plan.tagline}
                      </p>

                      <div className="mt-6 flex min-h-[3.5rem] items-end gap-2 text-primary">
                        <div className="relative flex h-[3.5rem] shrink-0 flex-col items-start">
                          <div className="mt-auto overflow-hidden">
                            <AnimatePresence mode="wait" initial={false}>
                              <motion.span
                                key={priceLabel}
                                initial={{
                                  opacity: 0,
                                  y: 16,
                                }}
                                animate={{
                                  opacity: 1,
                                  y: 0,
                                }}
                                exit={{
                                  opacity: 0,
                                  y: -16,
                                }}
                                transition={{
                                  duration: 0.3,
                                  ease: [0.22, 1, 0.36, 1],
                                }}
                                className="block whitespace-nowrap font-sans text-[clamp(2.4rem,3vw,3rem)] font-semibold leading-[3rem] tracking-tight tabular-nums"
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

                      <div className="relative mt-7 pt-7">
                        <span
                          aria-hidden
                          className="absolute inset-x-0 top-0 border-t border-dashed border-border"
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
                                <svg
                                  viewBox="0 0 10 10"
                                  className="h-2 w-2"
                                  aria-hidden
                                >
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
                          href={
                            userId && hasStore
                              ? `/langganan/pembayaran?plan=${plan.slug}&billing=${billing}`
                              : `/auth/register/penjual?plan=${plan.slug}&billing=${billing}`
                          }
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
          </div>
        </section>
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34
      </main>

      <SiteFooter hasMobileBottomNav />

      {/* Modal butuh AnimatePresence di sini agar animasi keluarnya sempat
          berjalan sebelum komponen dilepas dari pohon React. */}
      <AnimatePresence>
        {selectedProduct && (
          <ProductDetailModal
            product={selectedProduct}
            onClose={handleCloseModal}
          />
        )}
      </AnimatePresence>

      <StoreClosedModal
        isOpen={storeClosedModal.isOpen}
        onClose={storeClosedModal.close}
        availableFrom={storeClosedModal.availableFrom}
        availableTo={storeClosedModal.availableTo}
      />
    </BuyerShell>
  );
}

/**
 * `/home` mewajibkan sesi valid (kebutuhan aplikasi saat ini).
 * Selama status sesi diperiksa, konten TIDAK di-render (spinner dari
 * `RequireAuth`); tanpa sesi -> `replace` ke `/auth/login?redirect=/home`
 * agar kembali ke sini setelah login. Tidak ada mekanisme token baru:
 * memakai `useCurrentUser` yang sama seperti halaman terproteksi lain.
 */
export default function HomePage() {
  return (
    <RequireAuth>
      <HomePageContent />
    </RequireAuth>
  );
}
