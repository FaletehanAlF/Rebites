"use client";

<<<<<<< HEAD:app/components/home/VendorSection.tsx
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCatalog } from "@/lib/catalog";
import { VendorCard } from "@/app/components/home/VendorCard";
import { SELLER_VENDOR_SLUG } from "@/lib/product-storage";
import { useSellerPlan } from "@/lib/seller-plan";
import { isVendorReallyOpen } from "@/lib/store-status";
=======
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useCatalog } from '@/lib/catalog';
import { VendorCard } from '@/app/components/buyer/home/VendorCard';
import { SELLER_VENDOR_SLUG } from '@/lib/product-storage';
import { useSellerPlan } from '@/lib/seller-plan';
import { isVendorReallyOpen } from '@/lib/store-status';
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34:app/components/buyer/home/VendorSection.tsx

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Grid toko pembuka.
 *
 * Rail geser dengan tombol panah diganti grid: jumlah toko yang tampil
 * sekaligus lebih banyak, tidak ada lagi kartu terpotong di tepi layar, dan
 * tidak ada lagi pengukuran lebar untuk menentukan langkah geser.
 */
export function VendorSection() {
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

  return (
    <section
      id="umkm"
      data-nav="neutral"
      className="scroll-mt-20 bg-background py-10 sm:py-12 lg:py-14"
    >
<<<<<<< HEAD:app/components/home/VendorSection.tsx
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-secondary text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
              Toko lokal
            </p>
            <h2 className="mt-2 font-sans text-lg font-bold tracking-tight text-foreground sm:text-[22px] lg:text-[26px]">
=======
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-sans text-lg font-semibold tracking-tight text-foreground sm:text-[22px] lg:text-[28px]">
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34:app/components/buyer/home/VendorSection.tsx
              Rekomendasi toko buat kamu
            </h2>
            <p className="mt-1 max-w-md font-sans text-xs text-muted-foreground sm:text-sm">
              Toko lokal yang rutin menyelamatkan makanan surplusnya setiap hari.
              Dukung mereka.
            </p>
          </div>

          <Link
            href="/toko"
            className={cn(
              "hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 font-sans text-[13px] font-semibold text-primary transition-colors duration-150 hover:border-primary/40 hover:bg-accent sm:inline-flex",
              FOCUS_RING,
            )}
          >
            Lihat semua toko
          </Link>
        </div>

<<<<<<< HEAD:app/components/home/VendorSection.tsx
        {loading && (
          <div className="mt-6 flex h-40 items-center justify-center text-sm text-muted-foreground">
            Memuat toko...
=======
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
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34:app/components/buyer/home/VendorSection.tsx
          </div>
        )}

        {!loading && sortedVendors.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
            <p className="font-sans text-sm font-semibold text-foreground">
              Belum ada toko yang buka
            </p>
            <p className="mt-1 font-sans text-xs text-muted-foreground">
              Coba lagi nanti saat jam jual toko di sekitarmu sudah aktif.
            </p>
          </div>
        )}

        {!loading && sortedVendors.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {sortedVendors.map((vendor) => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                badgeLabel={
                  plan.priorityListing && vendor.id === SELLER_VENDOR_SLUG
                    ? "Prioritas"
                    : undefined
                }
              />
            ))}
          </div>
        )}

        {/* Katalog UMKM lengkap ada di /toko; beranda hanya menampilkan
            sekumpulan toko pilihan. */}
        <div className="mt-8 flex justify-center">
          <Link
            href="/toko"
            className={cn(
<<<<<<< HEAD:app/components/home/VendorSection.tsx
              "inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/40 px-6 font-sans text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white",
              FOCUS_RING,
=======
              'absolute -right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-foreground transition-all duration-200 hover:bg-primary-dark hover:text-white active:scale-[0.95] sm:-right-5 sm:h-11 sm:w-11',
              !canRight && 'cursor-default opacity-35 hover:bg-white hover:text-foreground',
              FOCUS_RING
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34:app/components/buyer/home/VendorSection.tsx
            )}
          >
            Lihat Semua UMKM
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
