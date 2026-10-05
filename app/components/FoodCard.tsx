"use client";

import { Clock, Heart, MapPin, Star } from "lucide-react";
import { formatRupiah } from "@/lib/data";
import { SmartImage } from "@/app/components/SmartImage";
import type { FoodItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLikedFoods } from "@/hooks/use-liked-foods";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50";

export function FoodCard({ item, onViewDetail }: { item: FoodItem; onViewDetail?: (id: string) => void }) {
  const { isLiked, toggle } = useLikedFoods();
  const liked = isLiked(item.id);
  const handleOpen = () => onViewDetail?.(item.id);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`Lihat detail ${item.name}`}
      onClick={handleOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleOpen();
        }
      }}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white outline-none transition-all duration-300 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-lg hover:shadow-primary/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-sage-100">
        <SmartImage
          src={item.image}
          alt={`Foto ${item.name} dari ${item.vendorName}`}
          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="transition-transform duration-500 group-hover:scale-105"
        />
        {/* Badge - top left - reference style */}
        {item.discountPercent > 0 && (
          <div className="absolute left-3 top-3 z-20 rounded-full bg-sale px-2.5 py-1 text-[11px] font-bold leading-none text-white shadow-md">
            Hemat {item.discountPercent}%
          </div>
        )}
        {/* Wishlist heart - top right */}
        <button
          type="button"
          aria-label={liked ? "Hapus dari favorit" : "Tambah ke favorit"}
          aria-pressed={liked}
          onClick={(e) => {
            e.stopPropagation();
            toggle(item.id);
          }}
          className={cn(
            "absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-zinc-500 shadow-md backdrop-blur-sm transition-colors hover:bg-white hover:text-sale",
            liked && "bg-white text-sale",
            FOCUS_RING,
          )}
        >
          <Heart className={cn("h-4 w-4", liked && "fill-sale text-sale")} />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-1 font-sans text-[15px] font-bold leading-snug text-charcoal-900">
          {item.name}
        </h3>
        <p className="mt-0.5 line-clamp-1 font-sans text-[13px] text-charcoal-500">{item.vendorName}</p>

        <div className="mt-2 flex items-center gap-3 text-xs text-charcoal-500">
          {item.rating != null && (
            <span className="flex items-center gap-1 font-medium text-charcoal-900">
              <Star className="h-3.5 w-3.5 fill-caramel text-caramel" />
              {item.rating.toFixed(1)}
            </span>
          )}
          {item.distanceKm != null && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-sage-500" />
              {item.distanceKm} km
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-sage-500" />
            {item.availableFrom}–{item.availableTo}
          </span>
        </div>

        <span className="mt-2.5 w-fit rounded-full bg-secondary-100 px-3 py-1 text-[11px] font-medium text-charcoal-600">
          {item.stockLabel}
        </span>

        <div className="mt-3 flex items-baseline gap-2">
          {item.originalPrice > item.discountedPrice && (
            <span className="text-xs text-charcoal-500 line-through">
              {formatRupiah(item.originalPrice)}
            </span>
          )}
          <span className="text-[16px] font-bold leading-none text-primary">
            {formatRupiah(item.discountedPrice)}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpen();
          }}
          className={cn(
            "mt-4 inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-caramel focus-visible:ring-2 focus-visible:ring-caramel focus-visible:ring-offset-2",
            FOCUS_RING,
          )}
        >
          Lihat Detail
        </button>
      </div>
    </article>
  );
}
