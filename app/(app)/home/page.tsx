"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { BuyerShell } from "@/app/components/shared/buyer-shell";
import { Hero } from "@/app/components/buyer/home/Hero";
import { UrgentDealsSection } from "@/app/components/buyer/home/UrgentDealsSection";
import { FlashSaleSection } from "@/app/components/buyer/home/FlashSaleSection";
import { CategorySection } from "@/app/components/buyer/home/CategorySection";
import { VendorSection } from "@/app/components/buyer/home/VendorSection";
import { SiteFooter } from "@/app/components/shared/app-footer";
import { Reveal } from "@/app/components/shared/reveal";
import { MagneticButton } from "@/app/components/shared/magnetic-button";
import { ProductDetailModal } from "@/app/components/shared/ProductDetailModalLazy";
import { StoreClosedModal } from "@/app/components/shared/StoreClosedModal";
import { useStoreClosedModal } from "@/lib/store-closed-modal-store";
import { useProductDetail } from "@/app/components/buyer/detail-product/use-product-detail";
import {
  SUBSCRIPTION_PLANS,
  getYearlyMultiplier,
  getYearlyPerMonth,
} from "@/lib/subscription-plans";
import { useCurrentUser } from "@/lib/current-user";
import { RequireAuth } from "@/app/components/auth/require-auth";
import { getSellerStoreSettings } from "@/lib/store-settings-storage";
import { scrollToId } from "@/lib/scroll";

type Billing = "monthly" | "yearly";

function HomePageContent() {
  const { userId } = useCurrentUser();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const storeClosedModal = useStoreClosedModal();
  const [billing, setBilling] = useState<Billing>("monthly");
  const [hasStore, setHasStore] = useState(false);

  // Status toko penjual menentukan CTA langganan: pemilik toko diarahkan ke
  // halaman pembayaran, calon penjual ke pendaftaran (metrik dari sisi
  // pengembangan develop, dipertahankan di section desain style).
  useEffect(() => {
    let mounted = true;
    (async () => {
      const settings = await getSellerStoreSettings();
      if (mounted) setHasStore(!!settings);
    })();
    return () => {
      mounted = false;
    };
  }, []);

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

                      <p className="mt-1 flex min-h-[2rem] flex-wrap items-center gap-x-2 gap-y-1 font-sans text-xs text-muted-foreground">
                        <span>{subLine}</span>
                        {yearlyMode && yearlyMultiplier !== null && (
                          <span className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-primary">
                            Bayar {yearlyMultiplier} bulan
                          </span>
                        )}
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
