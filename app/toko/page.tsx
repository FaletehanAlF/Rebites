"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Store } from "lucide-react";
import { useCatalog } from "@/lib/catalog";
import { MobileNavbar } from "@/app/components/shared/MobileNavbar";
import { MobileBottomNav } from "@/app/components/shared/MobileBottomNav";
import { VendorCard } from "@/app/components/home/VendorCard";
import { useSellerPlan } from "@/lib/seller-plan";
import { SELLER_VENDOR_SLUG } from "@/lib/product-storage";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function TokoPage() {
  const { vendors, loading } = useCatalog();
  const { plan } = useSellerPlan();

  const sortedVendors = plan.priorityListing
    ? [...vendors].sort(
        (a, b) =>
          Number(b.id === SELLER_VENDOR_SLUG) -
          Number(a.id === SELLER_VENDOR_SLUG),
      )
    : vendors;

  return (
    <div className="min-h-screen bg-secondary">
      <div className="lg:hidden">
        <MobileNavbar />
      </div>

      <main className="pb-24 pt-[120px] sm:pt-[140px] lg:pb-10 lg:pl-0 lg:pt-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="hidden lg:block">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-primary">
              Semua Toko
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Jelajahi toko UMKM yang menyelamatkan makanan surplus.
            </p>
          </div>

          <div className="mt-4 lg:hidden">
            <h1 className="font-display text-lg font-bold tracking-tight text-primary">
              Semua Toko
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Jelajahi toko UMKM yang menyelamatkan makanan surplus.
            </p>
          </div>

          {loading ? (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  aria-hidden
                  className="h-72 animate-pulse rounded-2xl bg-white shadow-sm"
                />
              ))}
            </div>
          ) : sortedVendors.length === 0 ? (
            <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white px-6 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Store className="h-6 w-6" />
              </span>
              <p className="mt-4 font-sans text-sm font-bold text-foreground">
                Belum ada toko tersedia
              </p>
              <p className="mt-1 max-w-xs font-secondary text-xs text-muted-foreground">
                Toko UMKM akan muncul di sini setelah terdaftar.
              </p>
            </div>
          ) : (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.06 } },
              }}
              className="mt-5 grid grid-cols-1 gap-4 sm:mt-6 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4"
            >
              {sortedVendors.map((vendor) => (
                <motion.div
                  key={vendor.id}
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.4, ease: EASE },
                    },
                  }}
                >
                  <VendorCard
                    vendor={vendor}
                    badgeLabel={
                      plan.priorityListing && vendor.id === SELLER_VENDOR_SLUG
                        ? "Prioritas"
                        : undefined
                    }
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
