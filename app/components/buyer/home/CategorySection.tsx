"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Apple,
  Beef,
  CakeSlice,
  Cookie,
  CupSoda,
  IceCreamCone,
  Sandwich,
  Soup,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIES } from "@/lib/categories";
import { fetchCategoryCounts } from "@/lib/catalog";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "makanan-berat": Beef,
  jajanan: Cookie,
  japanese: Soup,
  "roti-kue": CakeSlice,
  "makanan-cepat-saji": Sandwich,
  dessert: IceCreamCone,
  "buah-sayur": Apple,
  minuman: CupSoda,
};

export function CategorySection() {
  
  const [counts, setCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    let active = true;
    fetchCategoryCounts().then((result) => {
      if (active) setCounts(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const visibleCategories = counts
    ? CATEGORIES.filter((category) => (counts[category.name] ?? 0) > 0)
    : CATEGORIES;

  if (counts && visibleCategories.length === 0) {
    return null;
  }

  return (
    <section
      id="kategori"
      data-nav="neutral"
      className="relative scroll-mt-20 bg-secondary py-10 lg:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div>
          <h2 className="font-sans text-lg font-semibold tracking-tight text-foreground sm:text-[22px] lg:text-[28px]">
            Jelajahi Kategori
          </h2>
          <p className="mt-1 max-w-md font-sans text-xs text-muted-foreground sm:text-sm">
            Temukan berbagai makanan sesuai seleramu yang masih layak dinikmati
          </p>
        </div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.04 } },
          }}
          className="mt-5 flex gap-2 overflow-x-auto pb-3 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-3 lg:mt-8 lg:grid lg:grid-cols-8 lg:gap-4 lg:overflow-visible [&::-webkit-scrollbar]:hidden"
        >
          {visibleCategories.map((category) => {
            const Icon = CATEGORY_ICONS[category.id] ?? UtensilsCrossed;
            return (
              <motion.div
                key={category.id}
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
                  },
                }}
                className="min-w-[100px] snap-start sm:min-w-[148px] lg:min-w-0"
              >
                <Link
                  href={`/makanan/${category.id}`}
                  aria-label={`Lihat makanan kategori ${category.name}`}
                  className={cn(
                    "group flex h-[90px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 py-4 text-center transition-colors duration-300 hover:border-primary/40 sm:h-[110px] sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-6 lg:h-[132px]",
                    FOCUS_RING,
                  )}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-primary transition-colors group-hover:bg-primary group-hover:text-white sm:h-10 sm:w-10">
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </span>
                  <span className="font-sans text-[11px] font-semibold leading-tight text-foreground sm:text-[13px]">
                    {category.name}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
