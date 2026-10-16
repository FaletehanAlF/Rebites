"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Heart, MapPin, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/data";
import { useCatalog } from "@/lib/catalog";
import { useCountdown, formatCountdown } from "@/hooks/buyer/use-countdown";
import { SmartImage } from "@/app/components/shared/SmartImage";
import { useLikedFoods } from "@/hooks/buyer/use-liked-foods";
import { Marquee } from "@/app/components/shared/marquee";
import type { UrgentItem, UrgentSlot } from "@/lib/types";
import {
  FLASH_SELLER_STORE_HREF,
  getActiveFlashSaleProducts,
  type FlashSaleCardItem,
} from "@/lib/flash-sale";
import { PRODUCTS_UPDATED_EVENT } from "@/lib/product-storage";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white";

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
  if (h >= 9 && h < 12) return "09-12";
  if (h >= 12 && h < 15) return "12-15";
  if (h >= 15 && h < 18) return "15-18";
  if (h >= 18 && h < 21) return "18-21";
  return null;
}

function useSlotRotation() {
  const [tick, setTick] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<UrgentSlot | null>(null);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 20_000);
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

function SectionCountdown({
  deadlineIso,
  label,
}: {
  deadlineIso: string;
  label: string;
}) {
  const remaining = useCountdown(deadlineIso);
  const text = remaining === null ? "00:00:00" : formatCountdown(remaining);
  const [h, m, s] = text.split(":");

  return (
    <div
      id="flashSale"
      className="rounded-2xl bg-white px-5 py-3.5 shadow-sm"
    >
      <div className="flex items-center gap-2.5">
        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
          {label}
        </p>
      </div>

      <div className="mt-1 flex items-baseline gap-1">
        <span className="min-w-[2ch] text-center font-sans text-2xl font-bold tabular-nums leading-none text-sale sm:text-3xl">
          {h}
        </span>
        <span
          aria-hidden
          className="w-[1ch] text-center font-sans text-2xl font-bold leading-none text-sale sm:text-3xl"
        >
          :
        </span>
        <span className="min-w-[2ch] text-center font-sans text-2xl font-bold tabular-nums leading-none text-sale sm:text-3xl">
          {m}
        </span>
        <span
          aria-hidden
          className="w-[1ch] text-center font-sans text-2xl font-bold leading-none text-sale sm:text-3xl"
        >
          :
        </span>
        <span className="min-w-[2ch] text-center font-sans text-2xl font-bold tabular-nums leading-none text-sale sm:text-3xl">
          {s}
        </span>
      </div>

      <div className="mt-1 flex gap-1 font-sans text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">
        <span className="min-w-[2ch] text-center">Jam</span>
        <span aria-hidden className="w-[1ch]" />
        <span className="min-w-[2ch] text-center">Menit</span>
        <span aria-hidden className="w-[1ch]" />
        <span className="min-w-[2ch] text-center">Detik</span>
      </div>
    </div>
  );
}

function UrgentCard({
  item,
  startsAtIso,
  endsAtIso,
  onViewDetail,
  detailHref,
}: {
  item: UrgentItem;
  startsAtIso: string;
  endsAtIso: string;
  onViewDetail?: (id: string) => void;

  detailHref?: string;
}) {
  const router = useRouter();
  const openDetail = () => {
    if (detailHref) {
      router.push(detailHref);
      return;
    }
    onViewDetail?.(item.id);
  };

  const remainingToStart = useCountdown(startsAtIso);
  const remainingToEnd = useCountdown(endsAtIso);
  const isEnded = remainingToEnd === 0;
  const isUpcoming = !isEnded && (remainingToStart ?? 0) > 0;
  const isActive = !isEnded && !isUpcoming;

  const stockCount = parseStockCount(item.stockLabel);
  const stockPct =
    stockCount === null ? null : Math.max(10, Math.min(95, stockCount * 10));
  const { isLiked, toggle } = useLikedFoods();
  const liked = isLiked(item.id);

  return (
    <article
      role={isActive ? "button" : undefined}
      tabIndex={isActive ? 0 : undefined}
      aria-label={isActive ? `Lihat detail ${item.name}` : undefined}
      onClick={isActive ? () => openDetail() : undefined}
      onKeyDown={
        isActive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openDetail();
              }
            }
          : undefined
      }
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white outline-none transition-colors duration-300",
        isActive
          ? "cursor-pointer hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          : "cursor-default opacity-95",
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <SmartImage
          src={item.image}
          alt={`Foto ${item.name} dari ${item.vendorName}`}
          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
          className={cn(
            "transition-transform duration-500",
            isActive && "group-hover:scale-105",
            !isActive &&
              "scale-105 blur-[1.5px] brightness-[0.85] saturate-[0.7]",
          )}
        />

        {!isActive && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-foreground/40">
            <span className="rounded-full bg-white px-4 py-1.5 font-sans text-xs font-bold uppercase tracking-[0.14em] text-foreground shadow">
              Akan Datang
            </span>
          </div>
        )}

        <div className="absolute left-3 top-3 z-20 rounded-full bg-sale px-2.5 py-1 text-[11px] font-bold leading-none text-white shadow-md">
          Hemat {item.discountPercent}%
        </div>

        <button
          type="button"
          aria-label={liked ? "Hapus dari favorit" : "Tambah ke favorit"}
          aria-pressed={liked}
          disabled={!isActive}
          onClick={(e) => {
            e.stopPropagation();
            if (isActive) toggle(item.id);
          }}
          className={cn(
            "absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-muted-foreground shadow-sm transition-colors hover:bg-white hover:text-sale",
            liked && isActive && "bg-white text-sale",
            !isActive && "opacity-60",
          )}
        >
          <Heart
            className={cn(
              "h-4 w-4",
              liked && isActive && "fill-sale text-sale",
            )}
          />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-1 font-sans text-[15px] font-semibold leading-snug text-foreground">
          {item.name}
        </h3>
        <p className="mt-0.5 line-clamp-1 font-sans text-[13px] text-muted-foreground">
          {item.vendorName}
        </p>

        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-medium text-foreground">
            <Star className="h-3.5 w-3.5 fill-primary text-primary" />
            {item.rating.toFixed(1)}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            {item.distanceKm} km
          </span>
        </div>

        {isActive &&
          (stockPct === null ? (
            <span className="mt-2.5 w-fit rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {item.stockLabel}
            </span>
          ) : (
            <div className="mt-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-destructive">
                  Sisa {stockCount}
                </span>
                <span className="text-destructive">Buru!</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-sale"
                  initial={{ width: 0 }}
                  whileInView={{ width: `${stockPct}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>
          ))}

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-xs text-muted-foreground line-through">
            {formatRupiah(item.originalPrice)}
          </span>
          <span className="text-[16px] font-bold leading-none text-primary">
            {formatRupiah(item.discountedPrice)}
          </span>
        </div>

        <button
          type="button"
          disabled={!isActive}
          onClick={(e) => {
            e.stopPropagation();
            if (isActive) openDetail();
          }}
          className={cn(
            "mt-4 inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            isActive
              ? "bg-primary text-white hover:bg-primary-dark"
              : "cursor-not-allowed bg-muted text-muted-foreground",
          )}
        >
          {isActive ? "Lihat Detail" : "Akan Datang"}
        </button>
      </div>
    </article>
  );
}

export function FlashSaleSection({
  onViewDetail,
}: {
  onViewDetail?: (id: string) => void;
}) {
  const { realSlot, setSelectedSlot, activeSlot, tick } = useSlotRotation();

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

  const [sellerFlashItems, setSellerFlashItems] = useState<FlashSaleCardItem[]>(
    [],
  );
  const { urgentItems, loading: catalogLoading } = useCatalog();

  useEffect(() => {
    let mounted = true;
    const load = () => {
      getActiveFlashSaleProducts().then((items) => {
        if (mounted) setSellerFlashItems(items);
      });
    };
    load();
    window.addEventListener(PRODUCTS_UPDATED_EVENT, load);
    return () => {
      mounted = false;
      window.removeEventListener(PRODUCTS_UPDATED_EVENT, load);
    };
  }, [tick]);

  const staticSlotItems: FlashSaleCardItem[] = activeSlot
    ? urgentItems.filter((i) => i.slot === activeSlot)
    : [];
  const dynamicSlotItems = sellerFlashItems.filter(
    (item) => item.slot === activeSlot,
  );
  const staticIds = new Set(staticSlotItems.map((item) => item.id));
  const visibleItems: FlashSaleCardItem[] = [
    ...staticSlotItems,
    ...dynamicSlotItems.filter((item) => !staticIds.has(item.id)),
  ];
  const dynamicIds = new Set(dynamicSlotItems.map((item) => item.id));

  return (
    <section
      id="flash-sale"
      data-nav="green"
      className="relative overflow-hidden bg-primary"
    >
      <div className="relative bg-primary py-3">
        <Marquee pauseOnHover>
          {[
            "SELAMATKAN MAKANAN",
            "HARGA LEBIH HEMAT",
            "SURPLUS, BUKAN SISA",
            "LAYAK KONSUMSI",
            "DISKON HINGGA 50%",
            "LEBIH HEMAT, LEBIH BERMAKNA",
          ].map((t, i) => (
            <span
              key={i}
              className="mx-6 flex items-center gap-3 font-sans text-lg font-medium tracking-tight text-white lg:text-xl"
            >
              {t}
            </span>
          ))}
        </Marquee>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sale" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sale" />
              </span>
              <span className="font-sans text-xs font-bold uppercase tracking-[0.3em] text-white">
                Flash Sale
              </span>
            </div>

            <h2 className="mt-3 font-sans text-[22px] font-semibold tracking-tight text-white sm:text-[28px]">
              Segera <span className="text-white">Beli</span>
            </h2>

            <p className="mt-2 max-w-md font-sans text-sm text-white/80">
              Nikmati makanan surplus pilihan dengan harga lebih hemat. Jangan
              lewatkan sebelum stoknya habis!
            </p>
          </div>

          <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center">
            {slotEndIso ? (
              <SectionCountdown
                deadlineIso={slotEndIso}
                label="Berakhir dalam"
              />
            ) : (
              <SectionCountdown
                deadlineIso={nextStartIso}
                label="Flash sale dimulai dalam"
              />
            )}
          </div>
        </div>

        <div className="relative mt-6 flex flex-wrap items-center justify-center gap-2 sm:mt-9 md:flex-nowrap md:gap-8">
          {SLOTS.map((slot) => {
            const isReal = realSlot === slot.key;
            const isActive = activeSlot === slot.key;
            return (
              <button
                key={slot.key}
                type="button"
                aria-pressed={isActive}
                onClick={() =>
                  setSelectedSlot((prev) =>
                    prev === slot.key ? null : slot.key,
                  )
                }
                className={cn(
                  "group relative flex items-center gap-1.5 rounded-full border px-3 py-2 sm:gap-2.5 sm:px-4 sm:py-2.5 md:px-6 md:py-3.5 font-sans transition-all duration-300",
                  isActive
                    ? "border-transparent bg-primary text-white hover:bg-white hover:text-primary"
                    : "border-white/60 bg-white text-primary hover:bg-primary-dark hover:text-white",
                  FOCUS_RING,
                )}
              >
                <span className="flex flex-col items-start leading-tight">
                  <span className="text-sm font-bold tabular-nums">
                    {slot.range}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-[0.18em]",
                      isActive
                        ? "text-white/70 group-hover:text-primary"
                        : "text-primary/60 group-hover:text-white",
                    )}
                  >
                    {slot.name}
                  </span>
                </span>
                {isReal && (
                  <span
                    className="relative flex h-2 w-2 shrink-0"
                    title="Slot aktif sekarang"
                  >
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sale opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-sale" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative mt-10">
          {visibleItems.length > 0 ? (
            <motion.div
              key={activeSlot}
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.07 } },
              }}                  className="grid grid-flow-col auto-cols-[75%] snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4 sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 sm:gap-5 sm:overflow-visible sm:pb-0 lg:grid-cols-3 xl:grid-cols-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {visibleItems.map((item) => (
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
                  <UrgentCard
                    item={item}
                    startsAtIso={item.startsAt ?? slotStartIso!}
                    endsAtIso={item.endsAt ?? slotEndIso!}
                    onViewDetail={onViewDetail}
                    detailHref={
                      dynamicIds.has(item.id)
                        ? `${FLASH_SELLER_STORE_HREF}#menu-surplus`
                        : undefined
                    }
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl border border-white/20 bg-white/10 p-10 text-center sm:p-14"
            >
              <p className="mt-5 font-sans text-xs font-bold uppercase tracking-[0.3em] text-white">
                Flash Sale
              </p>
              <h3 className="mt-3 font-sans text-3xl font-semibold text-white sm:text-4xl">
                Flash sale dimulai pukul 09.00 WIB
              </h3>
              <p className="mx-auto mt-3 max-w-md font-sans text-sm text-white/75">
                Jangan sampai kelewatan!
              </p>
              <div className="mt-7 flex justify-center">
                <SectionCountdown
                  deadlineIso={nextStartIso}
                  label="Dimulai dalam"
                />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
