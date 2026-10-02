"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCatalog } from "@/lib/catalog";
import { FoodCard } from "@/app/components/shared/FoodCard";
import { SearchFilterBar } from "@/app/components/shared/SearchFilterBar";
import { SoftBlob } from "@/app/components/shared/ornaments";
import type { FilterKey } from "@/lib/types";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-primary";

const MAX_ITEMS = 8;

const SPARKLES = [
  { top: "12%", left: "5%" },
  { top: "22%", right: "9%" },
  { top: "52%", left: "2%" },
  { bottom: "14%", right: "16%" },
  { bottom: "8%", left: "22%" },
];

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

export function UrgentDealsSection({
  onViewDetail,
  from = "landing",
}: {
  onViewDetail?: (id: string) => void;
  from?: "landing" | "home";
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState<FilterKey>("terdekat");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const { foodItems, loading } = useCatalog();

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
  }, [updateArrows, foodItems.length]);

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
    const sorted = [...foodItems].sort((a, b) => b.rating - a.rating);
    const dailySeed = getDailySeed();
    const offset = getDailyOffset(dailySeed, sorted.length, MAX_ITEMS);
    return sorted.slice(offset, offset + MAX_ITEMS);
  }, [foodItems]);

  return (
    <section
      id="rekomendasi"
      data-nav="green"
      className="grain-overlay relative flex min-h-screen scroll-mt-20 flex-col justify-center overflow-hidden bg-primary py-10 sm:py-16 lg:py-20"
    >
      <SoftBlob className="-left-24 top-1/4 h-80 w-80 bg-white/10" />
      <SoftBlob className="-right-24 bottom-0 h-96 w-96 bg-primary/15" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-white/[0.06] blur-3xl" />

      {SPARKLES.map((pos, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="pointer-events-none absolute"
          style={pos}
          animate={{
            y: [0, -12, 0],
            rotate: [0, 45, 0],
            opacity: [0.25, 0.9, 0.25],
          }}
          transition={{
            duration: 4.5 + i * 0.6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.5,
          }}
        >
            <span className="block h-2.5 w-2.5 bg-white/50" style={{ clipPath: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)" }} />
          </motion.span>
      ))}

      <div className="relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sale" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sale" />
              </span>
              <span className="font-sans text-xs font-bold uppercase tracking-[0.3em] text-white/90">
                Rekomendasi Untukmu
              </span>
            </div>

            <h2 className="mt-3 font-sans text-[22px] font-bold tracking-tight text-white sm:text-[28px]">
              Menu <span className="text-primary">unggulan</span> hari ini
            </h2>
            <p className="mt-2 max-w-xl font-sans text-sm text-white/70">
              Pilihan makanan surplus dengan rating terbaik dari UMKM terdekat.
            </p>
          </div>
        </div>

        <div className="mb-6 mt-5 sm:mb-10 sm:mt-8 lg:mt-10">
          <SearchFilterBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSearchSubmit={() => undefined}
            activeFilter={searchFilter}
            onFilterChange={setSearchFilter}
            showLocation={false}
            showInlineResults
            onSelectResult={onViewDetail}
            variant="glass"
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => scrollByStep(-1)}
            disabled={!canLeft}
            aria-label="Geser rekomendasi makanan ke kiri"
            className={cn(
              "absolute -left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white text-foreground shadow-xl shadow-black/20 transition-all duration-200 hover:bg-primary-dark hover:text-white active:scale-[0.95] sm:-left-5 sm:h-11 sm:w-11",
              !canLeft &&
                "cursor-default opacity-35 hover:bg-white hover:text-foreground",
              FOCUS_RING,
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div
            ref={scrollRef}
            className="mt-2 grid snap-x snap-mandatory auto-cols-[80%] grid-flow-col gap-4 overflow-x-auto scroll-smooth pb-4 sm:auto-cols-[calc((100%-1.25rem)/2)] sm:gap-5 sm:pb-6 lg:auto-cols-[calc((100%-3.75rem)/4)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {loading && (
              <div className="flex h-56 items-center justify-center text-sm text-white/70 col-span-full">
                Memuat menu...
              </div>
            )}
            {!loading && items.length === 0 && (
              <div className="flex h-56 items-center justify-center text-sm text-white/70 col-span-full">
                Belum ada menu tersedia.
              </div>
            )}
            {!loading && items.length > 0 && (
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
              "absolute -right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white text-foreground shadow-xl shadow-black/20 transition-all duration-200 hover:bg-primary-dark hover:text-white active:scale-[0.95] sm:-right-5 sm:h-11 sm:w-11",
              !canRight &&
                "cursor-default opacity-35 hover:bg-white hover:text-foreground",
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
