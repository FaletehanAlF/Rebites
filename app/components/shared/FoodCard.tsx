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
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
export function FoodCard({ item, onViewDetail, forceUnavailable = false, }: {
    item: FoodItem & {
        stock?: number | null;
    };
    onViewDetail?: (id: string) => void;
    forceUnavailable?: boolean;
}) {
    const { isLiked, toggle } = useLikedFoods();
    const liked = isLiked(item.id);
    const numericStock = typeof item.stock === "number" && Number.isFinite(item.stock)
        ? item.stock
        : null;
    const isOutOfStock = numericStock != null ? numericStock <= 0 : item.stockLabel === "Habis";
    const displayStockLabel = isOutOfStock && item.stockLabel !== "Habis" ? "Habis" : item.stockLabel;
    const isUnavailable = forceUnavailable || isOutOfStock;
    const { user, loading: authLoading } = useCurrentUser();
    const router = useRouter();
    const handleOpen = () => {
        if (isUnavailable)
            return;
        if (!isStoreOpen(item.availableFrom, item.availableTo)) {
            openStoreClosedModal(item.availableFrom, item.availableTo);
            return;
        }
        if (authLoading)
            return;
        if (!user) {
            toast({
                title: "Silakan login terlebih dahulu",
                description: "Anda harus login untuk melihat detail produk dan memesan.",
                variant: "default",
            });
            router.push(`/auth/login?redirect=${encodeURIComponent(`/detail/product?id=${item.id}`)}`);
            return;
        }
        if (onViewDetail) {
            onViewDetail(item.id);
            return;
        }
        router.push(`/detail/product?id=${encodeURIComponent(item.rawId ?? item.id)}`);
    };
    return (<article role="button" tabIndex={0} aria-label={`Lihat detail ${item.name}`} onClick={handleOpen} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleOpen();
            }
        }} className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-white outline-none transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_18px_36px_-28px_rgba(27,77,50,0.5)] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:hover:-translate-y-1">

      

      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted">

        <SmartImage src={item.image} alt={`Foto ${item.name} dari ${item.vendorName}`} sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 80vw" className={cn("transition-transform duration-500 group-hover:scale-105", isUnavailable && "grayscale-[40%]")}/>

        {isUnavailable && (<div className="absolute inset-0 z-10 flex items-center justify-center bg-foreground/40 p-2 text-center">

            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold leading-none text-foreground shadow-lg sm:px-3 sm:py-1 sm:text-xs">

              {isOutOfStock ? "Stok Habis" : "Tidak Tersedia"}

            </span>

          </div>)}

        {item.discountPercent > 0 && (<div className="absolute left-2 top-2 z-20 rounded-full bg-sale px-2 py-0.5 text-[10px] font-bold leading-none text-white shadow-md sm:left-3 sm:top-3 sm:px-2.5 sm:py-1 sm:text-[11px]">

            Hemat {item.discountPercent}%

          </div>)}

        <button type="button" aria-label={liked ? "Hapus dari favorit" : "Tambah ke favorit"} aria-pressed={liked} onClick={(e) => {
            e.stopPropagation();
            toggle(item.id);
        }} className={cn("absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-muted-foreground shadow-md backdrop-blur-sm transition-colors hover:bg-white hover:text-sale sm:right-3 sm:top-3 sm:h-8 sm:w-8", liked && "bg-white text-sale", FOCUS_RING)}>

          <Heart className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", liked && "text-sale")}/>

        </button>

      </div>



      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">

        <h3 className="line-clamp-2 font-sans text-[13.5px] font-bold leading-snug text-foreground sm:text-[15px]">

          {item.name}

        </h3>

        <p className="mt-0.5 line-clamp-1 font-sans text-[11px] text-muted-foreground sm:text-[12.5px]">{item.vendorName}</p>



        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground sm:mt-2 sm:gap-2 sm:text-xs">

          {item.rating != null && (<span className="inline-flex items-center gap-1 font-medium text-foreground">

              <Star className="h-3 w-3 fill-primary text-primary sm:h-3.5 sm:w-3.5"/>

              {item.rating.toFixed(1)}

            </span>)}

          {item.distanceKm != null && (<span className="inline-flex items-center gap-1">

              <MapPin className="h-3 w-3 text-muted-foreground sm:h-3.5 sm:w-3.5"/>

              {item.distanceKm} km

            </span>)}

          <span className="inline-flex items-center gap-1">

            <Clock className="h-3 w-3 text-muted-foreground sm:h-3.5 sm:w-3.5"/>

            {item.availableFrom} {item.availableTo}

          </span>

        </div>



        

        <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-2.5">

          <span className="inline-flex w-fit rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium leading-none text-muted-foreground sm:px-3 sm:py-1 sm:text-[11px]">

            {displayStockLabel}

          </span>

        </div>



        

        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 pt-2 sm:pt-3">
          <div className="flex flex-wrap items-baseline gap-1 sm:gap-1.5">
            {item.originalPrice > item.discountedPrice && (<span className="text-[11px] leading-none text-muted-foreground line-through sm:text-xs">
                {formatRupiah(item.originalPrice)}
              </span>)}
            <span className="text-[15px] font-bold leading-none text-primary sm:text-[16px]">
              {formatRupiah(item.discountedPrice)}
            </span>
          </div>

          {isUnavailable && (<span className="rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-semibold leading-none text-muted-foreground">
              {isOutOfStock ? "Habis" : "Tutup"}
            </span>)}
        </div>
      </div>

    </article>);
}
