"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCatalog } from "@/lib/catalog";
import { FoodCard } from "@/app/components/shared/FoodCard";
import { FoodCardSkeleton } from "@/app/components/shared/FoodCardSkeleton";
import { cn } from "@/lib/utils";
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
export function UrgentDealsSection({ onViewDetail, }: {
    onViewDetail?: (id: string) => void;
    from?: "landing" | "home";
}) {
    const { foodItems, loading } = useCatalog();
    const railRef = useRef<HTMLDivElement>(null);
    const items = [...foodItems].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    const hasMore = items.length > 4;
    const scrollByRail = (dir: 1 | -1) => {
        const el = railRef.current;
        if (!el) return;
        el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: "smooth" });
    };
    useEffect(() => {
        const el = railRef.current;
        if (!el) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            const active = document.activeElement;
            if (active && el.contains(active)) {
                event.preventDefault();
                scrollByRail(event.key === "ArrowRight" ? 1 : -1);
            }
        };
        el.addEventListener("keydown", onKey);
        return () => el.removeEventListener("keydown", onKey);
    }, []);
    return (<section id="rekomendasi" data-nav="neutral" className="scroll-mt-20 py-10 sm:py-12 lg:py-14">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-sans text-lg font-bold tracking-tight text-foreground sm:text-[22px] lg:text-[26px]">
              Menu unggulan hari ini
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {hasMore && (<>
                <button type="button" onClick={() => scrollByRail(-1)} aria-label="Geser menu ke kiri" className={cn("flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-primary transition-colors duration-150 hover:border-primary/40 hover:bg-accent", FOCUS_RING)}>
                  <ChevronLeft className="h-5 w-5" aria-hidden/>
                </button>
                <button type="button" onClick={() => scrollByRail(1)} aria-label="Geser menu ke kanan" className={cn("flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-primary transition-colors duration-150 hover:border-primary/40 hover:bg-accent", FOCUS_RING)}>
                  <ChevronRight className="h-5 w-5" aria-hidden/>
                </button>
              </>)}
            <Link href="/makanan" className={cn("hidden shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 font-sans text-[13px] font-semibold text-primary transition-colors duration-150 hover:border-primary/40 hover:bg-accent sm:inline-flex", FOCUS_RING)}>
              Lihat semua makanan
            </Link>
          </div>
        </div>

        {loading && (<div role="status" aria-label="Memuat menu" className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (<FoodCardSkeleton key={index}/>))}
          </div>)}

        {!loading && items.length === 0 && (<div className="mt-6 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
            <p className="font-sans text-sm font-semibold text-foreground">
              Belum ada menu tersedia
            </p>
            <p className="mt-1 font-sans text-xs text-muted-foreground">
              Menu surplus akan muncul di sini begitu penjual menambahkannya.
            </p>
          </div>)}

        {!loading && items.length > 0 && (<div ref={railRef} className="mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:gap-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((item) => (<div key={item.id} className="h-full w-[calc(50%-0.375rem)] shrink-0 snap-start sm:w-[calc(25%-0.75rem)]">
                <FoodCard item={item} onViewDetail={onViewDetail}/>
              </div>))}
          </div>)}
      </div>
    </section>);
}
