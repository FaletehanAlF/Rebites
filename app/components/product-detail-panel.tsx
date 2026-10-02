"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock,
  Star,
  Utensils,
} from "lucide-react";
import { formatRupiah } from "@/lib/data";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export type FeaturedFood = {
  name: string;
  image: string;
  merchant: string;
  category: string;
  hours: string;
  price: number;
  originalPrice: number;
  badge?: string;
  rating: number;
  reviewCount: number;
  description: string;
  stockLabel?: string;
};

type BuyState = "idle" | "loading" | "done";

const BUY_LABELS: Record<BuyState, string> = {
  idle: "Beli Sekarang",
  loading: "Menambahkan…",
  done: "Berhasil Ditambahkan",
};

function RichText({ text }: { text: string }) {
  const [before, after] = text.split("ReBites");
  if (after === undefined) return <>{text}</>;
  return (
    <>
      {before}
      <strong className="font-semibold text-primary">ReBites</strong>
      {after}
    </>
  );
}

export function ProductDetailPanel({ food }: { food: FeaturedFood }) {
  const [buyState, setBuyState] = useState<BuyState>("idle");
  const router = useRouter();

  const savings = Math.max(0, food.originalPrice - food.price);

  const handleBuy = () => {
    if (buyState !== "idle") return;
    setBuyState("loading");
    window.setTimeout(() => router.push("/auth/login"), 450);
  };

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* A ,  Label kategori */}
      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/40 bg-white px-4 py-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-primary shadow-[0_10px_22px_-16px_rgba(192,138,62,0.8)]">
        <Star className="h-3.5 w-3.5 fill-primary text-primary" />
        {food.badge ?? "Menu Favorit"}
      </span>

      {/* B ,  Judul produk (satu baris) */}
      <h3 className="truncate font-display font-light leading-[1.08] tracking-[-0.02em] text-foreground whitespace-nowrap [font-size:clamp(1.85rem,3.2vw,2.6rem)]">
        {food.name}
      </h3>

      {/* Nama toko */}
      <p className="font-sans text-[13px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {food.merchant}
      </p>

      {/* E ,  Badge kategori & jam buka (di bawah nama) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-white px-3 py-1.5 font-sans text-xs font-semibold text-muted-foreground">
          <Utensils className="h-3.5 w-3.5 text-primary" />
          {food.category}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-white px-3 py-1.5 font-sans text-xs font-semibold text-muted-foreground">
          <Clock className="h-3.5 w-3.5 text-primary" />
          Buka {food.hours}
        </span>
      </div>

      {/* C ,  Stok, rating & ulasan */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2" aria-label={`Rating ${food.rating} dari 5`}>
        {food.stockLabel && (
          <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 font-sans text-[11px] font-semibold text-primary">
            {food.stockLabel}
          </span>
        )}

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, s) => (
              <Star key={s} className="h-4 w-4 fill-primary text-primary" />
            ))}
          </div>
          <span className="font-sans text-sm font-bold text-foreground">
            {food.rating.toFixed(1)}
          </span>
          <span className="font-sans text-sm text-muted-foreground">
            ({food.reviewCount} ulasan)
          </span>
        </div>
      </div>

      {/* D ,  Deskripsi */}
      <p className="max-w-md font-sans text-[15px] leading-[1.6] text-muted-foreground">
        <RichText text={food.description} />
      </p>

      <span
        aria-hidden
        className="h-px w-full bg-gradient-to-r from-primary/50 via-primary/20 to-transparent"
      />

      {/* F ,  Blok harga */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="flex flex-col">
          <span className="font-sans text-sm text-muted-foreground line-through">
            {formatRupiah(food.originalPrice)}
          </span>
          <span className="mt-0.5 font-display text-[2.15rem] font-bold leading-none tracking-tight text-primary sm:text-[2.5rem]">
            {formatRupiah(food.price)}
          </span>
        </div>
        <span className="mb-1 inline-flex items-center rounded-full bg-sale px-2.5 py-1 font-sans text-xs font-bold text-white shadow-[0_8px_18px_-8px_rgba(229,57,53,0.6)]">
          -{formatRupiah(savings)}
        </span>
      </div>

      {/* G + H ,  Quantity selector & CTA */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <motion.button
          type="button"
          onClick={handleBuy}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          aria-label="Beli sekarang"
          className={
            FOCUS_RING +
            " group inline-flex h-[52px] w-full items-center justify-center gap-3 rounded-full bg-primary px-8 sm:w-auto sm:min-w-[220px] sm:flex-1 font-sans text-[15px] font-bold text-white shadow-[0_18px_32px_-18px_rgba(27,77,50,0.85)] transition-colors duration-300 hover:bg-primary"
          }
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={buyState}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {BUY_LABELS[buyState]}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );
}