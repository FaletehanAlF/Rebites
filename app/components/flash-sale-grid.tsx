"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/app/components/shared/reveal";
import { SmartImage } from "@/app/components/shared/SmartImage";
import { formatRupiah } from "@/lib/data";
import { useCatalog } from "@/lib/catalog";
import { useCountdown, formatCountdown } from "@/lib/useCountdown";
import { cn } from "@/lib/utils";
import type { UrgentSlot, UrgentItem } from "@/lib/types";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

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

// `Intl.DateTimeFormat` relatif mahal untuk dibuat (ratusan mikrodetik hingga
// ms). Versi lama membangun 1 instance baru tiap `getWibParts()` dan
// `getWibParts()` dipanggil 4x per render — melekatkan 4 konstruksi tiap
// render, dan FlashSaleGrid sempat me-render tiap detik karena countdown.
const WIB_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

type WibParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getWibParts(): WibParts {
  const parts = WIB_FORMATTER.formatToParts(new Date());
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

function wibEpochOfToday(p: WibParts, h: number, min = 0, sec = 0) {
  return Date.UTC(p.year, p.month - 1, p.day, h, min, sec) - WIB_OFFSET_MS;
}

function nextStartEpoch(p: WibParts) {
  const secondsToday = p.hour * 3600 + p.minute * 60 + p.second;
  const dayOffset = secondsToday < 9 * 3600 ? 0 : 1;
  return wibEpochOfToday(p, 9) + dayOffset * 24 * 3600 * 1000;
}

function getSlotFromHour(h: number): UrgentSlot | null {
  if (h >= 9 && h < 12) return "09-12";
  if (h >= 12 && h < 15) return "12-15";
  if (h >= 15 && h < 18) return "15-18";
  if (h >= 18 && h < 21) return "18-21";
  return null;
}

type GridItem = {
  id: string;
  name: string;
  category: string;
  vendorName: string;
  image: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  stockLabel: string;
};

const FALLBACK_GRID: GridItem[] = [
  {
    id: "grid-salmon",
    name: "Salmon Salad Bites",
    category: "Salad",
    vendorName: "Fresh Kitchen",
    image:
      "https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=600",
    price: 25000,
    originalPrice: 32000,
    discountPercent: 22,
    stockLabel: "12 porsi tersisa",
  },
  {
    id: "grid-fried",
    name: "Fried Rice Bites",
    category: "Nasi",
    vendorName: "Kampung Rasa",
    image:
      "https://images.pexels.com/photos/234731/pexels-photo-234731.jpeg?auto=compress&cs=tinysrgb&w=600",
    price: 28000,
    originalPrice: 35000,
    discountPercent: 20,
    stockLabel: "9 porsi tersisa",
  },
  {
    id: "grid-grilled",
    name: "Grilled Chicken Bites",
    category: "Panggang",
    vendorName: "Dapur Mang Ujang",
    image:
      "https://images.pexels.com/photos/6752433/pexels-photo-6752433.jpeg?auto=compress&cs=tinysrgb&w=600",
    price: 32000,
    originalPrice: 40000,
    discountPercent: 20,
    stockLabel: "15 porsi tersisa",
  },
  {
    id: "grid-bowl",
    name: "Rice Bowl Bites",
    category: "Bowl",
    vendorName: "Dapur Ibu Sri",
    image:
      "https://images.pexels.com/photos/699953/pexels-photo-699953.jpeg?auto=compress&cs=tinysrgb&w=600",
    price: 35000,
    originalPrice: 45000,
    discountPercent: 22,
    stockLabel: "7 porsi tersisa",
  },
];

function urgentToGridItem(f: UrgentItem): GridItem {
  const discountPercent =
    f.discountPercent > 0
      ? f.discountPercent
      : f.originalPrice > 0
        ? Math.round((1 - f.discountedPrice / f.originalPrice) * 100)
        : 20;
  const originalPrice =
    f.originalPrice > 0 && f.originalPrice > f.discountedPrice
      ? f.originalPrice
      : Math.round(
          f.discountedPrice / (1 - Math.min(0.6, discountPercent / 100)),
        );
  return {
    id: f.id,
    name: f.name,
    category: f.category,
    vendorName: f.vendorName,
    image: f.image,
    price: f.discountedPrice,
    originalPrice,
    discountPercent,
    stockLabel: f.stockLabel,
  };
}

function parseStockCount(label: string) {
  const match = label.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/**
 * Menjadi `true` tepat saat deadline terlewati — hanya satu kali setState.
 *
 * Dulu section ini memakai `useCountdown` langsung, sehingga seluruh header,
 * tombol slot, dan 4 kartu ikut me-render setiap detik hanya untuk sebuah
 * boolean. Countdown per detiknya sekarang dimiliki `CountdownBox`.
 */
function useDeadlineReached(deadlineIso: string | null): boolean {
  const [reached, setReached] = useState(false);

  useEffect(() => {
    if (!deadlineIso) {
      setReached(false);
      return;
    }

    const deadline = new Date(deadlineIso).getTime();
    if (Number.isNaN(deadline)) {
      setReached(true);
      return;
    }

    const check = () => {
      if (Date.now() < deadline) return false;
      setReached(true);
      return true;
    };

    if (check()) return;
    setReached(false);

    const id = window.setInterval(() => {
      if (check()) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [deadlineIso]);

  return reached;
}

function CountdownBox({
  label,
  range,
  deadlineIso,
}: {
  label: string;
  range: string;
  deadlineIso: string;
}) {
  // Satu-satunya bagian section ini yang layak me-render tiap detik.
  const remaining = useCountdown(deadlineIso);
  const [h, m, s] = formatCountdown(remaining ?? 0).split(":");
  return (
    <div className="inline-flex flex-col gap-1.5 rounded-2xl border border-border bg-white px-5 py-3.5 shadow-[0_18px_40px_-28px_rgba(30,43,32,0.4)]">
      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-sale">
        {label}
      </p>
      <p className="font-sans text-[11px] font-semibold tabular-nums text-primary-dark">
        {range}
      </p>
      <div className="flex items-baseline gap-1">
        {[h, m, s].map((part, i) => (
          <span
            key={`${part}-${i}`}
            className={cn(
              "flex items-baseline gap-1",
              i > 0 && "ml-0.5",
            )}
          >
            {i > 0 && (
              <span
                aria-hidden
                className="font-sans text-2xl font-bold leading-none text-sale"
              >
                :
              </span>
            )}
            <span className="min-w-[2ch] text-center font-sans text-2xl font-bold tabular-nums leading-none text-sale">
              {part}
            </span>
          </span>
        ))}
      </div>
      <div className="flex gap-1 font-sans text-[9px] font-semibold uppercase tracking-[0.18em] text-primary-dark/60">
        <span className="min-w-[2ch] text-center">Jam</span>
        <span aria-hidden className="w-[1ch]" />
        <span className="min-w-[2ch] text-center">Menit</span>
        <span aria-hidden className="w-[1ch]" />
        <span className="min-w-[2ch] text-center">Detik</span>
      </div>
    </div>
  );
}

function FlashSaleCard({
  item,
  mode,
  index,
}: {
  item: GridItem;
  mode: "live" | "past" | "future";
  index: number;
}) {
  const stockCount = parseStockCount(item.stockLabel);
  const stockPct =
    stockCount === null ? null : Math.max(8, Math.min(95, stockCount * 8));
  const savings = Math.max(0, item.originalPrice - item.price);
  const router = useRouter();
  const isLive = mode === "live";
  const status = mode === "past" ? "Tidak Tersedia" : "Akan Datang";
  const stockText =
    mode === "past" ? "Habis" : mode === "future" ? "Akan Datang" : `Sisa ${stockCount ?? "beberapa"} porsi`;

  return (
    <Reveal delay={0.08 * index} className="h-full">
      <article
        className={cn(
          "group relative flex h-full flex-col rounded-[24px] border bg-white pt-20 px-5 pb-5 transition-all duration-300",
          isLive
            ? "border-border/70 shadow-[0_12px_30px_-18px_rgba(46,42,34,0.3)] hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-[0_22px_44px_-20px_rgba(46,42,34,0.35)]"
            : "border-border/50 bg-white/80 shadow-[0_10px_24px_-18px_rgba(46,42,34,0.2)]",
        )}
      >
        <div
          className={cn(
            "absolute -top-10 left-6 h-[136px] w-[136px] overflow-hidden rounded-full border-[3px] border-white bg-secondary shadow-[0_12px_24px_-12px_rgba(46,42,34,0.4)]",
            !isLive && "grayscale-[0.4]",
          )}
        >
          <SmartImage
            src={item.image}
            alt={`Foto ${item.name}`}
            sizes="136px"
            className={cn(
              "h-full w-full object-cover transition-transform duration-500",
              isLive && "group-hover:scale-105",
              !isLive && "brightness-[0.92]",
            )}
          />
        </div>

        <div className="flex justify-end">
          <div className="flex flex-col items-end gap-0.5">
            <span className="font-sans text-xs text-muted-foreground line-through">
              {formatRupiah(item.originalPrice)}
            </span>
            <span className="font-sans text-lg font-bold tracking-tight text-primary">
              {formatRupiah(item.price)}
            </span>
            <span className="inline-flex rounded-full bg-sale px-2 py-0.5 font-sans text-[10px] font-bold text-white">
              Hemat {item.discountPercent}%
            </span>
          </div>
        </div>

        <h3 className="mt-3 font-sans text-[17px] font-bold leading-snug text-primary-dark">
          {item.name}
        </h3>
        <p className="mt-0.5 font-sans text-[13px] text-muted-foreground">
          {item.category} · {item.vendorName}
        </p>

        <div className="mt-3">
          <div className="flex items-center justify-between font-sans text-[11px]">
            <span className={cn("font-bold", isLive ? "text-sale" : "text-muted-foreground")}>
              {stockText}
            </span>
            {isLive && <span className="text-sale">Buru!</span>}
          </div>
          {stockPct !== null && (
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full rounded-full",
                  isLive ? "bg-sale" : "bg-muted-foreground",
                )}
                style={{ width: `${isLive ? stockPct : 0}%` }}
              />
            </div>
          )}
        </div>

        <p className="mb-5 mt-3 pr-24 font-sans text-[11px] font-semibold text-sale">
          Hemat {formatRupiah(savings)}
        </p>

        <button
          type="button"
          disabled={!isLive}
          aria-label={
            isLive
              ? `Tambah ${item.name} ke keranjang`
              : status
          }
          onClick={() => {
            if (isLive) router.push("/auth/login");
          }}
          className={cn(
            "absolute bottom-5 right-5 inline-flex h-10 items-center rounded-full px-4 font-sans text-[12px] font-bold uppercase tracking-wide shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white",
            isLive
              ? "bg-primary text-white hover:bg-primary-dark hover:scale-105"
              : "cursor-not-allowed bg-muted text-muted-foreground",
          )}
        >
          {isLive ? "Beli" : status}
        </button>
      </article>
    </Reveal>
  );
}

export function FlashSaleGrid() {
  const { urgentItems } = useCatalog();
  const [previewSlot, setPreviewSlot] = useState<UrgentSlot | null>(null);

  const wib = getWibParts();

  const realSlot = getSlotFromHour(wib.hour);
  const currentHour = wib.hour;
  const [, forceTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => forceTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const activeSlot = previewSlot ?? realSlot;
  const realSlotDef = SLOTS.find((s) => s.key === realSlot) ?? null;
  const slotEndIso = realSlotDef
    ? new Date(wibEpochOfToday(wib, realSlotDef.end)).toISOString()
    : null;
  const nextStartIso = new Date(nextStartEpoch(wib)).toISOString();
  const deadlineIso = slotEndIso ?? nextStartIso;

  const ended = useDeadlineReached(deadlineIso);
  const isWithinHours = realSlot !== null;

  const slotSource =
    urgentItems.length > 0
      ? urgentItems.filter((i) => i.slot === activeSlot)
      : [];
  const gridItems =
    slotSource.length > 0
      ? slotSource.map(urgentToGridItem).slice(0, 4)
      : FALLBACK_GRID;

  const slotMode = (key: UrgentSlot): "live" | "past" | "future" => {
    if (key === realSlot) return "live";
    const idx = SLOTS.findIndex((s) => s.key === key);
    if (!realSlot) return currentHour < 9 ? "future" : "past";
    const ridx = SLOTS.findIndex((s) => s.key === realSlot);
    return idx < ridx ? "past" : "future";
  };

  const cardMode: "live" | "past" | "future" =
    activeSlot && slotMode(activeSlot) === "live" && !ended
      ? "live"
      : activeSlot
        ? slotMode(activeSlot)
        : currentHour < 9
          ? "future"
          : "past";

  const countdownLabel = isWithinHours ? "Berakhir dalam" : "Dimulai dalam";
  const countdownRange = realSlotDef
    ? `${realSlotDef.range} WIB`
    : "09.00 WIB";

  return (
    <section
      id="flash-sale"
      data-nav="neutral"
      className="grain-overlay relative overflow-hidden bg-secondary py-16 lg:py-20"
    >
      <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mb-10 grid gap-6 lg:mb-12 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
            <Reveal delay={0.05}>
              <div className="flex items-center justify-center gap-2 lg:justify-start">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sale opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-sale" />
                </span>
                <span className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
                  Flash Sale
                </span>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <h2 className="mt-4 font-display text-[clamp(1.9rem,4vw,3rem)] font-light leading-[1.05] tracking-[-0.02em] text-primary-dark">
                Menu Flash Sale <span className="text-primary">ReBites</span>
              </h2>
            </Reveal>

            <Reveal delay={0.15}>
              <p className="mx-auto mt-4 max-w-xl font-sans text-sm leading-[1.8] text-muted-foreground lg:mx-0">
                Nikmati makanan surplus spesial selama jam flash sale. Stok
                terbatas, harga jauh lebih hemat.
              </p>
            </Reveal>
          </div>

          <div className="flex flex-col items-center gap-4 lg:items-end">
            <Reveal delay={0.1}>
              <CountdownBox
                label={countdownLabel}
                range={countdownRange}
                deadlineIso={deadlineIso}
              />
            </Reveal>

            <Reveal delay={0.15}>
              <Link
                href="/#rekomendasi"
                className="group inline-flex items-center gap-1.5 font-sans text-sm font-medium text-primary transition-colors hover:text-primary"
              >
                Lihat Semua Menu
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </Reveal>
          </div>
        </div>

        <Reveal delay={0.05}>
          <div className="mb-10 flex flex-wrap items-center justify-center gap-3 lg:mb-12">
            {SLOTS.map((slot) => {
              const mode = slotMode(slot.key);
              const isLiveBtn = mode === "live";
              const isActive = activeSlot === slot.key;
              const preview = () => {
                setPreviewSlot((prev) => (prev === slot.key ? null : slot.key));
              };
              return (
                <button
                  key={slot.key}
                  type="button"
                  aria-pressed={isActive}
                  onClick={preview}
                  className={cn(
                    "flex items-center gap-2.5 rounded-full border font-sans transition-all duration-300",
                    isActive
                      ? "cursor-pointer border-primary/50 bg-primary text-white shadow-[0_14px_30px_-18px_rgba(27,77,50,0.75)] hover:bg-primary/90"
                      : "cursor-pointer border-border bg-muted text-primary-foreground0 hover:border-border hover:bg-muted",
                    FOCUS_RING,
                  )}
                >
                  <span className="py-2.5 pl-4 text-xs font-bold tabular-nums">
                    {slot.range}
                  </span>
                  <span
                    className={cn(
                      "pr-4 text-[10px] font-semibold uppercase tracking-[0.16em]",
                      isActive ? "text-white/85" : "text-muted-foreground",
                    )}
                  >
                    {slot.name}
                  </span>
                  {isLiveBtn && (
                    <span
                      className="relative mr-3 flex h-2 w-2"
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
        </Reveal>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {gridItems.map((item, idx) => (
            <FlashSaleCard
              key={item.id}
              item={item}
              mode={cardMode}
              index={idx}
            />
          ))}
        </div>
      </div>
    </section>
  );
}