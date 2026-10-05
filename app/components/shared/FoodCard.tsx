"use client";

import { Clock, Heart, MapPin, Star } from "lucide-react";
import { formatRupiah } from "@/lib/data";
import { SmartImage } from "@/app/components/shared/SmartImage";
import type { FoodItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLikedFoods } from "@/hooks/use-liked-foods";
import { isStoreOpen } from "@/lib/store-hours";
import { openStoreClosedModal } from "@/lib/store-closed-modal-store";
import { useCurrentUser } from "@/lib/current-user";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50";

export function FoodCard({
  item,
  onViewDetail,
  forceUnavailable = false,
}: {
  item: FoodItem;
  onViewDetail?: (id: string) => void;
  /** Dipakai Detail Toko: paksa kartu jadi tidak tersedia (stok habis / jam jual habis). */
  forceUnavailable?: boolean;
}) {
  const { isLiked, toggle } = useLikedFoods();
  const liked = isLiked(item.id);
  const isUnavailable = forceUnavailable || item.stockLabel === "Habis";
  const { user, loading: authLoading } = useCurrentUser();
  const router = useRouter();

  const handleOpen = () => {
    if (isUnavailable) return;
    if (!isStoreOpen(item.availableFrom, item.availableTo)) {
      openStoreClosedModal(item.availableFrom, item.availableTo);
      return;
    }
    if (authLoading) return;
    if (!user) {
      toast({
        title: "Silakan login terlebih dahulu",
        description: "Anda harus login untuk melihat detail produk dan memesan.",
        variant: "default",
      });
      router.push(`/auth/login?redirect=/detail/produk/${item.id}`);
      return;
    }
    onViewDetail?.(item.id);
  };

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
      className="group flex cursor-pointer overflow-hidden rounded-2xl border border-zinc-200 bg-white outline-none transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg hover:shadow-primary/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 sm:flex-col sm:h-full sm:hover:-translate-y-1"
    >
      {/* Image: fixed 96x96 di mobile (horizontal), aspect 4/3 di desktop (vertical) */}
      <div className="relative h-28 w-28 shrink-0 overflow-hidden bg-sage-100 sm:h-auto sm:w-full sm:aspect-[4/3]">
        <SmartImage
          src={item.image}
          alt={`Foto ${item.name} dari ${item.vendorName}`}
          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 112px"
          className={cn(
            "transition-transform duration-500 group-hover:scale-105",
            isUnavailable && "grayscale-[40%]",
          )}
        />
        {isUnavailable && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-charcoal-900/40 p-2 text-center">
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold leading-none text-charcoal-900 shadow-lg sm:px-3 sm:py-1 sm:text-xs">
              {item.stockLabel === "Habis" ? "Stok Habis" : "Tidak Tersedia"}
            </span>
          </div>
        )}
        {item.discountPercent > 0 && (
          <div className="absolute left-2 top-2 z-20 rounded-full bg-sale px-2 py-0.5 text-[10px] font-bold leading-none text-white shadow-md sm:left-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-[11px]">
            Hemat {item.discountPercent}%
          </div>
        )}
        <button
          type="button"
          aria-label={liked ? "Hapus dari favorit" : "Tambah ke favorit"}
          aria-pressed={liked}
          onClick={(e) => {
            e.stopPropagation();
            toggle(item.id);
          }}
          className={cn(
            "absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-zinc-500 shadow-md backdrop-blur-sm transition-colors hover:bg-white hover:text-sale sm:right-3 sm:top-3 sm:h-8 sm:w-8",
            liked && "bg-white text-sale",
            FOCUS_RING,
          )}
        >
          <Heart className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", liked && "fill-sale text-sale")} />
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
        <h3 className="line-clamp-1 font-sans text-[13px] font-bold leading-snug text-charcoal-900 sm:text-[15px] sm:line-clamp-2">
          {item.name}
        </h3>
        <p className="mt-0.5 line-clamp-1 font-sans text-[11px] text-charcoal-500 sm:text-[13px]">{item.vendorName}</p>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-charcoal-500 sm:mt-2 sm:gap-2 sm:text-xs">
          {item.rating != null && (
            <span className="inline-flex items-center gap-1 font-medium text-charcoal-900">
              <Star className="h-3 w-3 fill-caramel text-caramel sm:h-3.5 sm:w-3.5" />
              {item.rating.toFixed(1)}
            </span>
          )}
          {item.distanceKm != null && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 text-sage-500 sm:h-3.5 sm:w-3.5" />
              {item.distanceKm} km
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 text-sage-500 sm:h-3.5 sm:w-3.5" />
            {item.availableFrom} {item.availableTo}
          </span>
        </div>

        {/* Mobile: stock pill terlihat, Desktop: sama */}
        <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-2.5">
          <span className="inline-flex w-fit rounded-full bg-cream-100 px-2.5 py-1 text-[10px] font-medium leading-none text-charcoal-600 sm:px-3 sm:py-1 sm:text-[11px]">
            {item.stockLabel}
          </span>
        </div>

        {/* Harga + CTA: mobile row, desktop column full-width button */}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2 sm:mt-3 sm:flex-col sm:items-stretch sm:justify-start sm:gap-2">
          <div className="flex flex-col gap-0.5 sm:gap-1">
            <div className="flex flex-wrap items-baseline gap-1 sm:gap-1.5">
              {item.originalPrice > item.discountedPrice && (
                <span className="text-[11px] leading-none text-charcoal-500 line-through sm:text-xs">
                  {formatRupiah(item.originalPrice)}
                </span>
              )}
              <span className="text-[14px] font-bold leading-none text-primary sm:text-[16px]">
                {formatRupiah(item.discountedPrice)}
              </span>
            </div>
          </div>

          {isUnavailable ? (
            <div className="inline-flex shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-[11px] font-semibold leading-none text-zinc-400 sm:mt-3 sm:w-full sm:px-4 sm:py-2.5 sm:text-sm">
              {item.stockLabel === "Habis" ? "Habis" : "Tutup"}
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleOpen();
              }}
              className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-full bg-primary px-3.5 py-1.5 text-[11px] font-semibold leading-none text-white shadow-sm transition-colors hover:bg-caramel focus-visible:ring-2 focus-visible:ring-caramel focus-visible:ring-offset-2 sm:mt-3 sm:w-full sm:px-4 sm:py-2.5 sm:text-sm",
                FOCUS_RING,
              )}
            >
              Lihat Detail
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
