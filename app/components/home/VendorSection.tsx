"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCatalog } from "@/lib/catalog";
import { VendorCard } from "@/app/components/home/VendorCard";
import { SELLER_VENDOR_SLUG } from "@/lib/product-storage";
import { useSellerPlan } from "@/lib/seller-plan";
import { isVendorReallyOpen } from "@/lib/store-status";

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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-secondary text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
              Toko lokal
            </p>
            <h2 className="mt-2 font-sans text-lg font-bold tracking-tight text-foreground sm:text-[22px] lg:text-[26px]">
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

        {loading && (
          <div className="mt-6 flex h-40 items-center justify-center text-sm text-muted-foreground">
            Memuat toko...
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
              "inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/40 px-6 font-sans text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white",
              FOCUS_RING,
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
