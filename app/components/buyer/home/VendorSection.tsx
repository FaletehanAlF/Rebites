'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useCatalog } from '@/lib/catalog';
import { VendorCard } from '@/app/components/buyer/home/VendorCard';
import { SELLER_VENDOR_SLUG } from '@/lib/product-storage';
import { useSellerPlan } from '@/lib/seller-plan';
import { isVendorReallyOpen } from '@/lib/store-status';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export function VendorSection() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const { plan } = useSellerPlan();
  const { vendors, loading } = useCatalog();

  // Logic buka/tutup: isOpen (toggle penjual) DAN isOpenNow(openHours) harus true
  const sortedVendors = useMemo(() => {
    const openOnly = vendors.filter((v) => isVendorReallyOpen(v));
    if (!plan.priorityListing) return openOnly;
    return [...openOnly].sort(
      (a, b) => Number(b.id === SELLER_VENDOR_SLUG) - Number(a.id === SELLER_VENDOR_SLUG)
    );
  }, [vendors, plan.priorityListing]);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, [updateArrows, sortedVendors.length]);

  const scrollByStep = useCallback((dir: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const gap = 20;
    const vw = window.innerWidth;
    let step: number;
    if (vw >= 1024) {
      const visible = 4;
      const itemWidth = (el.clientWidth - gap * (visible - 1)) / visible;
      step = itemWidth + gap;
    } else if (vw >= 640) {
      const visible = 2;
      const itemWidth = (el.clientWidth - gap) / visible;
      step = itemWidth + gap;
    } else {
      const itemWidth = el.clientWidth * 0.85;
      step = itemWidth + gap;
    }
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  }, []);

  return (      <section
      id="umkm"
      data-nav="neutral"
      className="relative overflow-hidden scroll-mt-20 bg-secondary pb-10 pt-10 sm:pb-16 sm:pt-16 lg:pb-20 lg:pt-20"
    >
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-sans text-lg font-semibold tracking-tight text-foreground sm:text-[22px] lg:text-[28px]">
              Rekomendasi toko buat kamu
            </h2>
            <p className="mt-1 max-w-md font-sans text-xs text-muted-foreground sm:text-sm">
              Toko lokal yang rutin menyelamatkan makanan surplusnya setiap hari. Dukung mereka.
            </p>
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => scrollByStep(-1)}
            disabled={!canLeft}
            aria-label="Geser rekomendasi ke kiri"
            className={cn(
              'absolute -left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-foreground transition-all duration-200 hover:bg-primary-dark hover:text-white active:scale-[0.95] sm:-left-5 sm:h-11 sm:w-11',
              !canLeft && 'cursor-default opacity-35 hover:bg-white hover:text-foreground',
              FOCUS_RING
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div ref={scrollRef} className="mt-10 grid snap-x snap-mandatory auto-cols-[85%] grid-flow-col gap-5 overflow-x-auto scroll-smooth pb-6 sm:auto-cols-[calc((100%-1.25rem)/2)] lg:auto-cols-[calc((100%-3.75rem)/4)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {loading && (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                Memuat toko...
              </div>
            )}
            {!loading && sortedVendors.length === 0 && (
              <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                Belum ada toko yang buka saat ini.
              </div>
            )}
            {!loading && sortedVendors.length > 0 && (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.06 } },
                }}
                className="contents"
              >
                {sortedVendors.map((vendor) => (
                  <motion.div
                    key={vendor.id}
                    variants={{
                      hidden: { opacity: 0, y: 24 },
                      visible: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
                      },
                    }}
                    className="min-w-0 snap-start"
                  >
                    <VendorCard
                      vendor={vendor}
                      badgeLabel={
                        plan.priorityListing && vendor.id === SELLER_VENDOR_SLUG
                          ? 'Prioritas'
                          : undefined
                      }
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>

          <button
            type="button"
            onClick={() => scrollByStep(1)}
            disabled={!canRight}
            aria-label="Geser rekomendasi ke kanan"
            className={cn(
              'absolute -right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-foreground transition-all duration-200 hover:bg-primary-dark hover:text-white active:scale-[0.95] sm:-right-5 sm:h-11 sm:w-11',
              !canRight && 'cursor-default opacity-35 hover:bg-white hover:text-foreground',
              FOCUS_RING
            )}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
