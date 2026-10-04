"use client";

import { motion } from "framer-motion";
import { Flame, Star } from "lucide-react";
import { SmartImage } from "@/app/components/SmartImage";
import { formatRupiah } from "@/lib/data";
import { cn } from "@/lib/utils";

export type FloatingDish = {
  name: string;
  merchant: string;
  image: string;
  price: number;
  originalPrice: number;
  rating: string;
  meta: string;
  metaTone?: "stock" | "flash";
};

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function FloatingDishCard({
  dish,
  className,
  delay = 0,
  drift = 10,
  duration = 7,
  priority = false,
}: {
  dish: FloatingDish;
  className?: string;
  delay?: number;
  drift?: number;
  duration?: number;
  priority?: boolean;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={cn("pointer-events-auto w-52 sm:w-60", className)}
    >
      <motion.div
        animate={{ y: [0, -drift, 0] }}
        transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
        className="overflow-hidden rounded-3xl border border-white/60 bg-white/85 shadow-[0_24px_48px_-24px_rgba(27,77,50,0.45)] backdrop-blur-xl"
      >
        <div className="relative h-28 w-full sm:h-32">
          <SmartImage
            src={dish.image}
            alt={dish.name}
            sizes="(min-width: 1280px) 240px, 208px"
            priority={priority}
          />
          <span
            className={cn(
              "absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-inter text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow",
              dish.metaTone === "flash" ? "bg-sale" : "bg-primary",
            )}
          >
            {dish.metaTone === "flash" ? (
              <Flame className="h-3 w-3" aria-hidden />
            ) : null}
            {dish.meta}
          </span>
        </div>

        <div className="p-3.5 sm:p-4">
          <p className="font-display text-sm font-semibold leading-snug text-forest-dark">
            {dish.name}
          </p>
          <p className="mt-0.5 truncate font-inter text-[11px] text-muted-foreground">
            {dish.merchant}
          </p>

          <div className="mt-2.5 flex items-end justify-between gap-2">
            <div className="leading-none">
              <p className="font-inter text-[11px] text-muted-foreground line-through">
                {formatRupiah(dish.originalPrice)}
              </p>
              <p className="mt-1 font-display text-base font-bold text-primary">
                {formatRupiah(dish.price)}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-cream-100 px-2 py-1 font-inter text-[11px] font-semibold text-primary">
              <Star className="h-3 w-3 fill-caramel text-caramel" aria-hidden />
              {dish.rating}
            </span>
          </div>
        </div>
      </motion.div>
    </motion.article>
  );
}
