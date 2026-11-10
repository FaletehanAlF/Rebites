"use client";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Heart, MapPin, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/data";
import { useCatalog } from "@/lib/catalog";
import { useCountdown, formatCountdown } from "@/hooks/buyer/use-countdown";
import { SmartImage } from "@/app/components/shared/SmartImage";
import { FoodCardSkeleton } from "@/app/components/shared/FoodCardSkeleton";
import { useLikedFoods } from "@/hooks/buyer/use-liked-foods";
import type { UrgentItem, UrgentSlot } from "@/lib/types";
import { getActiveFlashSaleProducts, FLASH_SLOTS, formatFlashScheduleLabel, type FlashSaleCardItem, } from "@/lib/flash-sale";
import { matchesFlashStatus, type FlashStatusFilter } from "@/lib/flash-sale-status";
import { PRODUCTS_UPDATED_EVENT } from "@/lib/product-storage";
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const WIB_OFFSET_MS = 7 * 3600 * 1000;
const SLOTS: {
    key: UrgentSlot;
    start: number;
    end: number;
    range: string;
    name: string;
}[] = [
    { key: "09-12", start: 9, end: 12, range: "09.00–12.00", name: "Pagi" },
    { key: "12-15", start: 12, end: 15, range: "12.00–15.00", name: "Siang" },
    { key: "15-18", start: 15, end: 18, range: "15.00–18.00", name: "Sore" },
    { key: "18-21", start: 18, end: 21, range: "18.00–21.00", name: "Malam" },
];
function getWibParts() {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return {
        year: Number(get("year")),
        month: Number(get("month")),
        day: Number(get("day")),
        hour: Number(get("hour")) % 24,
        minute: Number(get("minute")),
        second: Number(get("second")),
    };
}
function wibEpochOfToday(h: number, min = 0, sec = 0) {
    const p = getWibParts();
    return Date.UTC(p.year, p.month - 1, p.day, h, min, sec) - WIB_OFFSET_MS;
}
function nextStartEpoch() {
    const p = getWibParts();
    const secondsToday = p.hour * 3600 + p.minute * 60 + p.second;
    const dayOffset = secondsToday < 9 * 3600 ? 0 : 1;
    return wibEpochOfToday(9) + dayOffset * 24 * 3600 * 1000;
}
function getSlotFromHour(h: number): UrgentSlot | null {
    if (h >= 9 && h < 12)
        return "09-12";
    if (h >= 12 && h < 15)
        return "12-15";
    if (h >= 15 && h < 18)
        return "15-18";
    if (h >= 18 && h < 21)
        return "18-21";
    return null;
}
function useSlotRotation() {
    const [tick, setTick] = useState(0);
    const [selectedSlot, setSelectedSlot] = useState<UrgentSlot | null>(null);
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 20000);
        return () => clearInterval(id);
    }, []);
    void tick;
    const realSlot = getSlotFromHour(getWibParts().hour);
    const activeSlot = selectedSlot ?? realSlot;
    return { realSlot, selectedSlot, setSelectedSlot, activeSlot, tick };
}
function parseStockCount(label: string) {
    const match = label.match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
}
function SectionCountdown({ deadlineIso, label, }: {
    deadlineIso: string;
    label: string;
}) {
    const remaining = useCountdown(deadlineIso);
    const text = remaining === null ? "00:00:00" : formatCountdown(remaining);
    const [h, m, s] = text.split(":");
    return (<div className="rounded-xl border border-border bg-white px-4 py-3 shadow-sm">

      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-primary">

        {label}

      </p>



      <div className="mt-1 flex items-baseline gap-1 font-sans text-2xl font-bold tabular-nums leading-none text-sale" aria-live="off">

        <span className="min-w-[2ch] text-center">{h}</span>

        <span aria-hidden className="w-[1ch] text-center">

          :

        </span>

        <span className="min-w-[2ch] text-center">{m}</span>

        <span aria-hidden className="w-[1ch] text-center">

          :

        </span>

        <span className="min-w-[2ch] text-center">{s}</span>

      </div>



      <div className="mt-1 flex gap-1 font-sans text-[9px] font-semibold uppercase tracking-[0.14em] text-primary/70">

        <span className="min-w-[2ch] text-center">Jam</span>

        <span aria-hidden className="w-[1ch]"/>

        <span className="min-w-[2ch] text-center">Menit</span>

        <span aria-hidden className="w-[1ch]"/>

        <span className="min-w-[2ch] text-center">Detik</span>

      </div>

    </div>);
}
function UrgentCard({ item, startsAtIso, endsAtIso, onViewDetail, }: {
    item: FlashSaleCardItem;
    startsAtIso: string;
    endsAtIso: string;
    onViewDetail?: (id: string) => void;
}) {
    const openDetail = () => onViewDetail?.(item.id);
    const remainingToStart = useCountdown(startsAtIso);
    const remainingToEnd = useCountdown(endsAtIso);
    const isEnded = remainingToEnd === 0;
    const isUpcoming = !isEnded && (remainingToStart ?? 0) > 0;
    const isActive = !isEnded && !isUpcoming;
    const stockCount = parseStockCount(item.stockLabel);
    const stockPct = stockCount === null ? null : Math.max(10, Math.min(95, stockCount * 10));
    const { isLiked, toggle } = useLikedFoods();
    const liked = isLiked(item.id);
    return (<article role={isActive ? "button" : undefined} tabIndex={isActive ? 0 : undefined} aria-label={isActive ? `Lihat detail ${item.name}` : undefined} onClick={isActive ? () => openDetail() : undefined} onKeyDown={isActive
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openDetail();
                }
            }
            : undefined} className={cn("group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white outline-none transition-colors duration-150", isActive
            ? "cursor-pointer hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            : "cursor-default")}>

      <div className="relative aspect-[4/3] overflow-hidden bg-muted">

        <SmartImage src={item.image} alt={`Foto ${item.name} dari ${item.vendorName}`} sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw" className={cn(!isActive && "brightness-[0.85] saturate-[0.7]")}/>



        {!isActive && (<div className="absolute inset-0 z-10 flex items-center justify-center bg-foreground/40">

            <span className="rounded-full bg-white/95 px-4 py-1.5 font-sans text-[11px] font-extrabold uppercase tracking-[0.18em] text-foreground shadow-lg shadow-black/10">

              Akan Datang

            </span>

          </div>)}



        <div className="absolute left-3 top-3 z-20 rounded-full bg-sale px-2.5 py-1 text-[11px] font-bold leading-none text-white">

          Hemat {item.discountPercent}%

        </div>



        <button type="button" aria-label={liked ? "Hapus dari favorit" : "Tambah ke favorit"} aria-pressed={liked} disabled={!isActive} onClick={(e) => {
            e.stopPropagation();
            if (isActive)
                toggle(item.id);
        }} className={cn("absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white text-muted-foreground shadow-sm transition-colors hover:text-sale", liked && isActive && "text-sale", !isActive && "opacity-60")}>

          <Heart className={cn("h-4 w-4", liked && isActive && "text-sale")}/>

        </button>

      </div>



      <div className="flex flex-1 flex-col p-4">

        <h3 className="line-clamp-1 font-sans text-[15px] font-bold leading-snug text-foreground">

          {item.name}

        </h3>

        <p className="mt-0.5 line-clamp-1 font-sans text-[13px] text-muted-foreground">

          {item.vendorName}

        </p>



        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">

          {item.rating != null && (<span className="flex items-center gap-1 font-medium text-foreground">

              <Star className="h-3.5 w-3.5 fill-primary text-primary"/>

              {item.rating.toFixed(1)}

            </span>)}

          {item.distanceKm != null && (<span className="flex items-center gap-1">

              <MapPin className="h-3.5 w-3.5 text-muted-foreground"/>

              {item.distanceKm} km

            </span>)}

        </div>



        {isActive &&
            (stockPct === null ? (<span className="mt-2.5 w-fit rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">

              {item.stockLabel}

            </span>) : (<div className="mt-2.5">

              <div className="flex items-center justify-between text-xs">

                <span className="font-bold text-sale">

                  Sisa {stockCount}

                </span>

                <span className="font-bold text-sale">Buru!</span>

              </div>

              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">

                

                <div className="h-full rounded-full bg-sale" style={{ width: `${stockPct}%` }}/>

              </div>

            </div>))}



        {!isActive && item.startsAt && (<div className="mt-1.5 rounded-md bg-white px-2 py-0.5 text-[10px] font-extrabold text-foreground shadow-sm">

            {formatFlashScheduleLabel(item.startsAt)}

          </div>)}



        <div className="mt-3 flex items-baseline gap-2">

          <span className="text-xs text-muted-foreground line-through">

            {formatRupiah(item.originalPrice)}

          </span>

          <span className="text-[16px] font-bold leading-none text-primary">

            {formatRupiah(item.discountedPrice)}

          </span>

        </div>



        <button type="button" disabled={!isActive} onClick={(e) => {
            e.stopPropagation();
            if (isActive)
                openDetail();
        }} className={cn("mt-4 inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2", isActive
            ? "bg-primary text-white hover:bg-primary-dark"
            : "cursor-not-allowed bg-muted text-muted-foreground")}>

          {isActive ? "Lihat Detail" : "Akan Datang"}

        </button>

      </div>

    </article>);
}
export function FlashSaleSection({
  onViewDetail,
}: {
  onViewDetail?: (id: string) => void;
}) {
    const { realSlot, setSelectedSlot, activeSlot } = useSlotRotation();
    const reducedMotion = useReducedMotion();
    const [statusFilter, setStatusFilter] = useState<FlashStatusFilter>('Semua');
    const activeSlotDef = activeSlot
        ? (SLOTS.find((s) => s.key === activeSlot) ?? null)
        : null;
    const slotStartIso = activeSlotDef
        ? new Date(wibEpochOfToday(activeSlotDef.start)).toISOString()
        : null;
    const slotEndIso = activeSlotDef
        ? new Date(wibEpochOfToday(activeSlotDef.end)).toISOString()
        : null;
    const nextStartIso = new Date(nextStartEpoch()).toISOString();
    const [sellerFlashItems, setSellerFlashItems] = useState<FlashSaleCardItem[]>([]);
    const { urgentItems, loading: catalogLoading, error: catalogError, refresh: refreshCatalog } = useCatalog();
    useEffect(() => {
        let mounted = true;
        const load = () => {
            getActiveFlashSaleProducts().then((items) => {
                if (mounted)
                    setSellerFlashItems(items);
            });
        };
        load();
        window.addEventListener(PRODUCTS_UPDATED_EVENT, load);
        return () => {
            mounted = false;
            window.removeEventListener(PRODUCTS_UPDATED_EVENT, load);
        };
    }, [realSlot]);
    const staticSlotItems: FlashSaleCardItem[] = activeSlot
        ? urgentItems.filter((i) => i.slot === activeSlot)
        : [];
    const dynamicSlotItems = sellerFlashItems.filter((item) => item.slot === activeSlot);
    const dynamicIds = new Set(dynamicSlotItems.map((item) => item.id));
    let baseVisible: FlashSaleCardItem[] = [
        ...staticSlotItems.filter((item) => !dynamicIds.has(item.id)),
        ...dynamicSlotItems,
    ];
    if (statusFilter !== 'Semua') {
        baseVisible = baseVisible.filter((item) => matchesFlashStatus(item, statusFilter, { startIso: slotStartIso, endIso: slotEndIso }));
    }
    const visibleItems: FlashSaleCardItem[] = baseVisible;
    return (<section id="flashSale" data-nav="neutral" className="scroll-mt-20 py-10 sm:py-12 lg:py-14">

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">


          <div>

            

            <span className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-sale sm:text-[11px]">

              Flash Sale

            </span>



            <h2 className="mt-2.5 font-sans text-lg font-bold tracking-tight text-foreground sm:text-[22px] lg:text-[26px]">

              Segera beli

            </h2>



            <p className="mt-1.5 max-w-md font-sans text-xs leading-relaxed text-muted-foreground sm:text-sm">

              Harga lebih hemat, berganti setiap slot waktu.

            </p>

          </div>



          <div className="flex shrink-0 flex-col items-end gap-3">
            {slotEndIso ? (<SectionCountdown deadlineIso={slotEndIso} label="Berakhir dalam"/>) : (<SectionCountdown deadlineIso={nextStartIso} label="Dimulai dalam"/>)}
          </div>
        </div>



        

        <div className="mt-6 grid grid-cols-2 gap-2 sm:mt-8 sm:grid-cols-4 sm:gap-3">

          {SLOTS.map((slot) => {
            const isReal = realSlot === slot.key;
            const isActive = activeSlot === slot.key;
            return (<button key={slot.key} type="button" aria-pressed={isActive} onClick={() => setSelectedSlot((prev) => prev === slot.key ? null : slot.key)} className={cn("flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left font-sans transition-colors duration-150 sm:px-4", isActive
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-white text-foreground hover:border-primary/40", FOCUS_RING)}>

                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 leading-tight">
                  <span className="text-[13px] font-bold tabular-nums sm:text-sm">
                    {slot.range}
                  </span>
                  <span className={cn("text-[10px] font-bold uppercase tracking-[0.14em]", isActive ? "text-white/80" : "text-muted-foreground")}>
                    {slot.name}
                  </span>
                </span>


                {isReal && (<span className={cn("h-2 w-2 shrink-0 rounded-full", isActive ? "bg-white" : "bg-sale")} title="Slot aktif sekarang" aria-hidden/>)}

              </button>);
        })}

        </div>



        

        <div className="mt-4 flex flex-wrap gap-1.5 sm:mt-5">

          {(['Semua', 'Berlangsung', 'Akan Datang'] as FlashStatusFilter[]).map((f) => (<button key={f} type="button" onClick={() => setStatusFilter(f)} className={cn('rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors duration-150', statusFilter === f
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-white text-foreground hover:border-primary/40 hover:text-primary')}>

              {f}

            </button>))}

        </div>



        <div className="mt-5 sm:mt-6">

          {catalogLoading && visibleItems.length === 0 && (<div role="status" aria-label="Memuat flash sale" className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">

              {Array.from({ length: 4 }).map((_, index) => (<FoodCardSkeleton key={index}/>))}

            </div>)}



          {visibleItems.length > 0 && (<motion.div key={activeSlot ?? "none"} initial={reducedMotion ? false : { opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={reducedMotion ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }} className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">

              {visibleItems.map((item) => (<UrgentCard key={item.id} item={item} startsAtIso={item.startsAt ?? slotStartIso!} endsAtIso={item.endsAt ?? slotEndIso!} onViewDetail={onViewDetail}/>))}

            </motion.div>)}



          {!catalogLoading && catalogError && (<div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/[0.06] px-6 py-10 text-center">
              <h3 className="font-sans text-lg font-bold text-foreground sm:text-xl">
                Gagal memuat flash sale
              </h3>
              <p className="mx-auto mt-2 max-w-sm font-sans text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {catalogError}
              </p>
              <button type="button" onClick={() => void refreshCatalog()} className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-6 font-sans text-sm font-semibold text-white transition-colors hover:bg-primary-dark">
                Coba lagi
              </button>
            </div>)}

          {!catalogLoading && !catalogError && visibleItems.length === 0 && (<div className="rounded-2xl border border-border bg-white px-6 py-10 text-center">

              <h3 className="font-sans text-lg font-bold text-foreground sm:text-xl">

                {activeSlot
                ? "Belum ada menu di slot ini"
                : "Flash sale dimulai pukul 09.00 WIB"}

              </h3>

              

              <p className="mx-auto mt-2 max-w-sm font-sans text-xs leading-relaxed text-muted-foreground sm:text-sm">

                {activeSlot
                ? "Coba pilih slot waktu lain atau kembali lagi nanti."
                : "Jangan sampai kelewatan — nantikan harga spesialnya."}

              </p>

            </div>)}

        </div>

      </div>

    </section>);
}
