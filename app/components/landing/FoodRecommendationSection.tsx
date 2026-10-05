"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCatalog } from "@/lib/catalog";
import type { FoodItem } from "@/lib/types";
import { FoodCard } from "@/app/components/shared/FoodCard";
import { SoftBlob } from "@/app/components/shared/ornaments";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50";

type FoodFilter = "semua" | "diskon-terbesar" | "segera-habis" | "terdekat";

const FILTERS: { key: FoodFilter; label: string }[] = [
  { key: "semua", label: "Semua" },
  { key: "diskon-terbesar", label: "Diskon Terbesar" },
  { key: "segera-habis", label: "Segera Habis" },
  { key: "terdekat", label: "Terdekat" },
];

const MAX_ITEMS = 8;

function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getDailySeed(): number {
  
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return hashStringToInt(dateStr);
}

function getDailyOffset(seed: number, length: number, pageSize: number): number {
  if (length <= pageSize) return 0;
  const maxStart = length - pageSize;
  return seed % (maxStart + 1);
}

export function FoodRecommendationSection({ onViewDetail }: { onViewDetail?: (id: string) => void }) {
  const { foodItems, loading, error } = useCatalog();
  const [activeFilter, setActiveFilter] = useState<FoodFilter>("semua");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

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
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows, foodItems.length, activeFilter]);

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
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }, []);

  const items = useMemo(() => {
    let list = [...foodItems];

    switch (activeFilter) {
      case "diskon-terbesar":
        list.sort((a, b) => b.discountPercent - a.discountPercent);
        break;
      case "segera-habis":
        list = list.filter((item) => item.expiresAt);
        list.sort(
          (a, b) =>
            new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime(),
        );
        break;
      case "terdekat":
        list.sort(
          (a, b) =>
            (a.distanceKm ?? Number.MAX_SAFE_INTEGER) -
            (b.distanceKm ?? Number.MAX_SAFE_INTEGER),
        );
        break;
      default:
        list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }

    const dailySeed = getDailySeed();
    const filterSeed = dailySeed ^ hashStringToInt(activeFilter);
    const offset = getDailyOffset(filterSeed, list.length, MAX_ITEMS);
    return list.slice(offset, offset + MAX_ITEMS);
  }, [activeFilter, foodItems]);

  const scrollToVendors = () => {
    document.getElementById("umkm")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="rekomendasiMakanan"
      data-nav="cream"
      className="relative overflow-hidden scroll-mt-24 bg-cream-50 py-16 lg:py-20"
    >
      <SoftBlob className="-left-24 top-1/3 h-80 w-80 bg-sage-100/60" />
      <SoftBlob className="-right-24 bottom-0 h-96 w-96 bg-primary/5" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-sans text-[22px] font-bold tracking-tight text-charcoal-900 sm:text-[28px]">
              Menu unggulan hari ini
            </h2>
            <p className="mt-1.5 max-w-md font-sans text-sm text-charcoal-500">
              Pilihan makanan surplus dengan rating terbaik dari UMKM terdekat.
            </p>
          </div>
        </div>

        <div
          role="group"
          aria-label="Filter rekomendasi makanan"
          className="mt-8 flex flex-wrap items-center gap-2"
        >
          {FILTERS.map((filter) => {
            const isActive = activeFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveFilter(filter.key)}
                className={cn(
                  "rounded-full border px-4 py-2 font-sans text-sm font-semibold transition-all duration-200",
                  isActive
                    ? "border-transparent bg-caramel text-white shadow-md shadow-caramel/25 hover:bg-caramel"
                    : "border-sage-100 bg-white text-charcoal-500 hover:border-caramel/30 hover:text-caramel",
                  FOCUS_RING,
                )}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => scrollByStep(-1)}
            disabled={!canLeft}
            aria-label="Geser rekomendasi makanan ke kiri"
            className={cn(
              "absolute -left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-sage-100 bg-white text-charcoal-900 shadow-md shadow-primary/5 transition-all duration-200 hover:bg-caramel hover:text-white active:scale-[0.95] sm:-left-5 sm:h-11 sm:w-11",
              !canLeft &&
                "cursor-default opacity-35 hover:bg-white hover:text-charcoal-900",
              FOCUS_RING,
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div
            key={activeFilter}
            ref={scrollRef}
            className="mt-10 grid snap-x snap-mandatory auto-cols-[85%] grid-flow-col gap-5 overflow-x-auto scroll-smooth pb-6 sm:auto-cols-[calc((100%-1.25rem)/2)] lg:auto-cols-[calc((100%-3.75rem)/4)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {loading && (
              <div className="flex h-56 items-center justify-center text-sm text-charcoal-500 col-span-full">
                Memuat rekomendasi...
              </div>
            )}
            {!loading && error && (
              <div className="flex h-56 items-center justify-center text-sm text-red-600 col-span-full">
                Gagal memuat katalog: {error}
              </div>
            )}
            {!loading && !error && items.length === 0 && (
              <div className="flex h-56 items-center justify-center text-sm text-charcoal-500 col-span-full">
                Belum ada menu tersedia.
              </div>
            )}
            {!loading && !error && items.length > 0 && (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: {},
                  visible: { transition: { staggerChildren: 0.06 } },
                }}
                className="contents"
              >
                {items.map((item) => (
                  <motion.div
                    key={item.id}
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
                    <FoodCard item={item} onViewDetail={onViewDetail} />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </div>

          <button
            type="button"
            onClick={() => scrollByStep(1)}
            disabled={!canRight}
            aria-label="Geser rekomendasi makanan ke kanan"
            className={cn(
              "absolute -right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-sage-100 bg-white text-charcoal-900 shadow-md shadow-primary/5 transition-all duration-200 hover:bg-caramel hover:text-white active:scale-[0.95] sm:-right-5 sm:h-11 sm:w-11",
              !canRight &&
                "cursor-default opacity-35 hover:bg-white hover:text-charcoal-900",
              FOCUS_RING,
            )}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  );
}
