"use client";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCatalog } from "@/lib/catalog";
import { VendorCard } from "@/app/components/buyer/home/VendorCard";
import { VendorCardSkeleton } from "@/app/components/shared/VendorCardSkeleton";
import { useSwipePager } from "@/lib/use-swipe-pager";
import { SELLER_VENDOR_SLUG } from "@/lib/product-storage";
import { useSellerPlan } from "@/lib/seller-plan";
import { orderVendorsOpenFirst } from "@/lib/store-status";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const ITEMS_PER_PAGE = 4;

export function VendorSection() {
    const { plan } = useSellerPlan();
    const { vendors, loading, error: catalogError, refresh: refreshCatalog } = useCatalog();
    const reducedMotion = useReducedMotion();
    const [page, setPage] = useState(1);
    const [direction, setDirection] = useState<1 | -1>(1);
    const sortedVendors = useMemo(() => orderVendorsOpenFirst(vendors, plan.priorityListing ? SELLER_VENDOR_SLUG : null), [vendors, plan.priorityListing]);
    const pageCount = Math.max(1, Math.ceil(sortedVendors.length / ITEMS_PER_PAGE));
    useEffect(() => {
        setPage((current) => Math.min(Math.max(1, current), pageCount));
    }, [pageCount]);
    const pageItems = useMemo(() => sortedVendors.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE), [sortedVendors, page]);
    const goToPage = (next: number) => {
        const clamped = Math.min(Math.max(1, next), pageCount);
        if (clamped === page)
            return;
        setDirection(clamped > page ? 1 : -1);
        setPage(clamped);
    };
    const pager = useSwipePager({ page, pageCount, onPageChange: goToPage });
    return (<section id="umkm" data-nav="neutral" className="scroll-mt-20 py-10 sm:py-12 lg:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-sans text-lg font-bold tracking-tight text-foreground sm:text-[22px] lg:text-[26px]">
              Rekomendasi toko buat kamu
            </h2>
            <p className="mt-1 max-w-md font-sans text-xs text-muted-foreground sm:text-sm">
              Toko yang sedang tutup tetap tampil, jadi jam bukanya bisa kamu
              cek dulu.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            
            {!loading && sortedVendors.length > ITEMS_PER_PAGE && (<>
                <button type="button" onClick={() => goToPage(page - 1)} disabled={page <= 1} aria-label="Halaman toko sebelumnya" className={cn("flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-primary transition-colors duration-150 hover:border-primary/40 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-white", FOCUS_RING)}>
                  <ChevronLeft className="h-5 w-5" aria-hidden/>
                </button>
                <button type="button" onClick={() => goToPage(page + 1)} disabled={page >= pageCount} aria-label="Halaman toko berikutnya" className={cn("flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-primary transition-colors duration-150 hover:border-primary/40 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-white", FOCUS_RING)}>
                  <ChevronRight className="h-5 w-5" aria-hidden/>
                </button>
              </>)}
          </div>
        </div>

        {loading && (<div role="status" aria-label="Memuat toko" className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (<VendorCardSkeleton key={index}/>))}
          </div>)}

        {!loading && catalogError && (<div role="alert" className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/[0.06] px-6 py-10 text-center">
            <p className="font-sans text-sm font-semibold text-foreground">
              Gagal memuat daftar toko
            </p>
            <p className="mt-1 font-sans text-xs text-muted-foreground">
              {catalogError}
            </p>
            <button type="button" onClick={() => void refreshCatalog()} className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 font-sans text-sm font-semibold text-white transition-colors hover:bg-primary-dark">
              Coba lagi
            </button>
          </div>)}

        {!loading && !catalogError && sortedVendors.length === 0 && (<div className="mt-6 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
            <p className="font-sans text-sm font-semibold text-foreground">
              Belum ada toko
            </p>
            <p className="mt-1 font-sans text-xs text-muted-foreground">
              Toko UMKM akan muncul di sini setelah pemiliknya mendaftar.
            </p>
          </div>)}

        {!loading && !catalogError && sortedVendors.length > 0 && (<>
            
            <div
              className="relative mt-6 cursor-grab touch-pan-y select-none overflow-hidden active:cursor-grabbing"
              onPointerDown={pager.onPointerDown}
              onPointerUp={pager.onPointerUp}
              onPointerCancel={pager.onPointerCancel}
              onWheel={pager.onWheel}
              onClickCapture={pager.onClickCapture}
            >
              <AnimatePresence initial={false} mode="popLayout" custom={direction}>
                <motion.div key={page} custom={direction} variants={{
                enter: (dir: number) => ({ opacity: 0, x: 40 * dir }),
                center: { opacity: 1, x: 0 },
                exit: (dir: number) => ({ opacity: 0, x: -40 * dir }),
            }} initial="enter" animate="center" exit="exit" transition={reducedMotion
                ? { duration: 0 }
                : { duration: 0.3, ease: [0.22, 1, 0.36, 1] }} className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
                  {pageItems.map((vendor) => (<VendorCard key={vendor.id} vendor={vendor} badgeLabel={plan.priorityListing && vendor.id === SELLER_VENDOR_SLUG
                    ? "Prioritas"
                    : undefined}/>))}
                </motion.div>
              </AnimatePresence>
            </div>

            
            {pageCount > 1 && (<nav aria-label="Halaman toko" className="mt-6 flex flex-wrap items-center justify-start gap-2">
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => {
                    const active = pageNumber === page;
                    return (<button key={pageNumber} type="button" onClick={() => goToPage(pageNumber)} aria-current={active ? "page" : undefined} aria-label={`Ke halaman toko ${pageNumber}`} className={cn("flex h-11 w-11 items-center justify-center rounded-full font-sans text-sm font-semibold tabular-nums transition-colors duration-150", active
                            ? "bg-primary text-white"
                            : "border border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-primary", FOCUS_RING)}>
                        {pageNumber}
                      </button>);
                })}
              </nav>)}
          </>)}
      </div>
    </section>);
}
