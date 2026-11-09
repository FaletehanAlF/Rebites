"use client";
import { useCallback, useRef } from "react";
import { ArrowRight, Star } from "lucide-react";
import type { FoodItem } from "@/lib/types";
import { FoodCard } from "@/app/components/shared/FoodCard";
export function categorySectionId(category: string): string {
    return `cat-${category.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-")}`;
}
export function CategoryRow({ title, items, onSelect, featuredIds, isItemUnavailable, }: {
    title: string;
    items: FoodItem[];
    onSelect: (id: string) => void;
    featuredIds?: Set<string>;
    isItemUnavailable?: (item: FoodItem) => boolean | undefined;
}) {
    const rowRef = useRef<HTMLDivElement>(null);
    const canScroll = items.length > 4;
    const scrollByPage = useCallback((direction: 1 | -1) => {
        const el = rowRef.current;
        if (!el)
            return;
        el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" });
    }, []);
    return (<section id={categorySectionId(title)} className="scroll-mt-[148px]">

      <h3 className="font-display text-xl font-medium tracking-tight text-primary sm:text-2xl">

        {title}

        <span className="ml-2 align-middle font-sans text-xs font-normal text-muted-foreground">

          {items.length} menu

        </span>

      </h3>



      <div className="relative mt-4">

        {canScroll && (<button type="button" onClick={() => scrollByPage(-1)} aria-label={`Geser menu ${title} sebelumnya`} className="absolute -left-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-primary shadow-[0_10px_30px_-24px_rgba(34,81,56,0.3)] transition-all duration-300 hover:border-primary hover:bg-primary-dark hover:text-white sm:flex">

            <ArrowRight className="h-4 w-4 rotate-180"/>

          </button>)}



        {canScroll && (<button type="button" onClick={() => scrollByPage(1)} aria-label={`Geser menu ${title} berikutnya`} className="absolute -right-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-primary shadow-[0_10px_30px_-24px_rgba(34,81,56,0.3)] transition-all duration-300 hover:border-primary hover:bg-primary-dark hover:text-white sm:flex">

            <ArrowRight className="h-4 w-4"/>

          </button>)}



        <div ref={rowRef} className="grid snap-x snap-mandatory auto-cols-[calc((100%-1rem)/2)] grid-flow-col gap-4 overflow-x-auto scroll-smooth pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:auto-cols-[calc((100%-2rem)/3)] lg:auto-cols-[calc((100%-3rem)/4)] [&::-webkit-scrollbar]:hidden">

          {items.map((item) => (<div key={item.id} className="relative snap-start">

              {featuredIds?.has(item.id) && (<span className="absolute left-3 top-12 z-20 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground shadow-sm">

                  <Star className="h-3 w-3 fill-current"/>

                  Unggulan

                </span>)}

              <FoodCard item={item} onViewDetail={() => onSelect(item.id)} forceUnavailable={isItemUnavailable?.(item) ?? false}/>

            </div>))}

        </div>

      </div>

    </section>);
}
