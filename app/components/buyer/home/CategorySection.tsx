"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
      className="relative scroll-mt-20 bg-white py-10 sm:py-12 lg:py-14"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div>
          <h2 className="font-sans text-lg font-semibold tracking-tight text-foreground sm:text-[22px] lg:text-[28px]">
            Jelajahi Kategori
          </h2>
          <p className="mt-1 max-w-md font-sans text-xs text-muted-foreground sm:text-sm">
            Temukan berbagai makanan sesuai seleramu yang masih layak dinikmati.
          </p>
        </div>

        {/*
          Dua kolom di ponsel supaya tetap terbaca tanpa geser mendatar, empat
          kolom di tablet, delapan kolom hanya di layar lebar (lg masih sempit
          karena sidebar pembeli memakan 260px).
        */}
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:mt-6 xl:grid-cols-8">
          {visibleCategories.map((category) => {
            const Icon = CATEGORY_ICONS[category.id] ?? UtensilsCrossed;
            return (
              <Link
                key={category.id}
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
            );
          })}
        </div>
      </div>
    </section>
  );
}
