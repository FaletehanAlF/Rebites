"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Heart, MapPin, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/data";
import { useCatalog } from "@/lib/catalog";
import { useCountdown, formatCountdown } from "@/hooks/buyer/use-countdown";
import { SmartImage } from "@/app/components/shared/SmartImage";
<<<<<<< HEAD:app/components/home/FlashSaleSection.tsx
import { useLikedFoods } from "@/hooks/use-liked-foods";
=======
import { useLikedFoods } from "@/hooks/buyer/use-liked-foods";
import { Marquee } from "@/app/components/shared/marquee";
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34:app/components/buyer/home/FlashSaleSection.tsx
import type { UrgentItem, UrgentSlot } from "@/lib/types";
import {
  getActiveFlashSaleProducts,
  type FlashSaleCardItem,
} from "@/lib/flash-sale";
import { PRODUCTS_UPDATED_EVENT } from "@/lib/product-storage";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-primary";

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
<<<<<<< HEAD:app/components/home/FlashSaleSection.tsx
    <div className="rounded-xl bg-white px-4 py-3 shadow-sm">
      <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
        {label}
      </p>
=======
    <div
      id="flashSale"
      className="rounded-2xl bg-white px-5 py-3.5 shadow-sm"
    >
      <div className="flex items-center gap-2.5">
        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
          {label}
        </p>
      </div>
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34:app/components/buyer/home/FlashSaleSection.tsx

      <div
        className="mt-1 flex items-baseline gap-1 font-sans text-2xl font-bold tabular-nums leading-none text-sale"
        aria-live="off"
      >
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
}: {
  item: UrgentItem;
  startsAtIso: string;
  endsAtIso: string;
  onViewDetail?: (id: string) => void;
}) {
  // Semua kartu produk memakai popup yang sama (ProductDetailModal lewat
  // onViewDetail). Kartu flash sale tidak lagi punya halaman detail sendiri.
  const openDetail = () => onViewDetail?.(item.id);

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
<<<<<<< HEAD:app/components/home/FlashSaleSection.tsx
        "group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white outline-none transition-colors duration-150",
        isActive
          ? "cursor-pointer hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
          : "cursor-default",
=======
        "group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white outline-none transition-colors duration-300",
        isActive
          ? "cursor-pointer hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          : "cursor-default opacity-95",
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34:app/components/buyer/home/FlashSaleSection.tsx
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <SmartImage
          src={item.image}
          alt={`Foto ${item.name} dari ${item.vendorName}`}
          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
          className={cn(
            !isActive && "brightness-[0.85] saturate-[0.7]",
          )}
        />

        {!isActive && (
<<<<<<< HEAD:app/components/home/FlashSaleSection.tsx
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-foreground/30">
=======
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-foreground/40">
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34:app/components/buyer/home/FlashSaleSection.tsx
            <span className="rounded-full bg-white px-4 py-1.5 font-sans text-xs font-bold uppercase tracking-[0.14em] text-foreground shadow">
              Akan Datang
            </span>
          </div>
        )}

        <div className="absolute left-3 top-3 z-20 rounded-full bg-sale px-2.5 py-1 text-[11px] font-bold leading-none text-white">
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
<<<<<<< HEAD:app/components/home/FlashSaleSection.tsx
            "absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white text-muted-foreground shadow-sm transition-colors hover:text-sale",
            liked && isActive && "text-sale",
=======
            "absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-muted-foreground shadow-sm transition-colors hover:bg-white hover:text-sale",
            liked && isActive && "bg-white text-sale",
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34:app/components/buyer/home/FlashSaleSection.tsx
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
          {item.rating != null && (
            <span className="flex items-center gap-1 font-medium text-foreground">
              <Star className="h-3.5 w-3.5 fill-primary text-primary" />
              {item.rating.toFixed(1)}
            </span>
          )}
          {item.distanceKm != null && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              {item.distanceKm} km
            </span>
          )}
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
                {/* Lebar statis dari data stok: cukup dirender, tidak dianimasikan. */}
                <div
                  className="h-full rounded-full bg-sale"
                  style={{ width: `${stockPct}%` }}
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
            "mt-4 inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
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

/**
 * Flash sale per slot waktu.
 *
 * Latar hijau solid (tanpa gradient, tanpa grain overlay) menjadi satu-satunya
 * blok warna pekat di beranda, sehingga bagian lain bisa memakai permukaan
 * putih yang tenang. Pita marquee berjalan dan kilau melintas di setiap kartu
 * dihapus: keduanya berjalan terus-menerus tanpa memberi informasi.
 */
export function FlashSaleSection({
  onViewDetail,
}: {
  onViewDetail?: (id: string) => void;
}) {
  const { realSlot, setSelectedSlot, activeSlot } = useSlotRotation();
  const reducedMotion = useReducedMotion();

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

  // Dependensi sengaja HANYA `realSlot`. Sebelumnya efek ini bergantung pada
  // `tick` (penanda 20 detik), sehingga setiap 20 detik daftar dikosongkan ke
  // `[]` lalu diisi ulang -> kartu dilepas, Gambar berpindah kembali ke
  // keadaan "belum dimuat", dan foto terlihat berkedip/hilang. Slot yang
  // berganti tetap tertangkap lewat `activeSlot` di bawah.
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
  }, [realSlot]);

  const staticSlotItems: FlashSaleCardItem[] = activeSlot
    ? urgentItems.filter((i) => i.slot === activeSlot)
    : [];
  const dynamicSlotItems = sellerFlashItems.filter(
    (item) => item.slot === activeSlot,
  );
  /**
   * Katalog publik (`urgentItems`, dari tabel products.slot/expires_at) dan
   * daftar flash sale penjual membaca BARIS YANG SAMA dengan `id` yang sama,
   * tetapi bentuk kartunya berbeda: katalog memakai harga surplus + stok
   * tersedia, sedangkan flash sale memakai harga flash + status jadwal.
   *
   * Sebelumnya katalog menang (union), sehingga produk yang baru dijadikan
   * flash sale tetap tampil dengan harga normal dan tanpa badge diskon — baru
   * "berubah" setelah refresh halaman. Sekarang entri katalog dibuang bila id
   * yang sama sudah ada di daftar flash sale.
   */
  const dynamicIds = new Set(dynamicSlotItems.map((item) => item.id));
  const visibleItems: FlashSaleCardItem[] = [
    ...staticSlotItems.filter((item) => !dynamicIds.has(item.id)),
    ...dynamicSlotItems,
  ];

  return (
    <section
      id="flashSale"
      data-nav="green"
<<<<<<< HEAD:app/components/home/FlashSaleSection.tsx
      className="scroll-mt-20 bg-primary py-10 sm:py-12 lg:py-14"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
=======
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
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34:app/components/buyer/home/FlashSaleSection.tsx
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sale" aria-hidden />
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.22em] text-white sm:text-[11px]">
                Flash sale
              </span>
            </div>

<<<<<<< HEAD:app/components/home/FlashSaleSection.tsx
            <h2 className="mt-2.5 font-sans text-lg font-bold tracking-tight text-white sm:text-[22px] lg:text-[26px]">
              Segera beli
=======
            <h2 className="mt-3 font-sans text-[22px] font-semibold tracking-tight text-white sm:text-[28px]">
              Segera <span className="text-white">Beli</span>
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34:app/components/buyer/home/FlashSaleSection.tsx
            </h2>

            <p className="mt-1.5 max-w-md font-sans text-xs leading-relaxed text-white/80 sm:text-sm">
              Makanan surplus pilihan dengan harga lebih hemat. Jangan lewatkan
              sebelum stoknya habis.
            </p>
          </div>

          <div className="shrink-0">
            {slotEndIso ? (
              <SectionCountdown deadlineIso={slotEndIso} label="Berakhir dalam" />
            ) : (
              <SectionCountdown
                deadlineIso={nextStartIso}
                label="Dimulai dalam"
              />
            )}
          </div>
        </div>

        {/*
          Slot waktu memakai grid 2×2 di ponsel: empat tombol selebar penuh
          dalam satu baris tidak muat dan sebelumnya terpotong di layar sempit.
        */}
        <div className="mt-6 grid grid-cols-2 gap-2 sm:mt-8 sm:grid-cols-4 sm:gap-3">
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
                  "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left font-sans transition-colors duration-150 sm:px-4",
                  isActive
<<<<<<< HEAD:app/components/home/FlashSaleSection.tsx
                    ? "border-white bg-white text-primary"
                    : "border-white/30 bg-transparent text-white hover:border-white/70",
=======
                    ? "border-transparent bg-primary text-white hover:bg-white hover:text-primary"
                    : "border-white/60 bg-white text-primary hover:bg-primary-dark hover:text-white",
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34:app/components/buyer/home/FlashSaleSection.tsx
                  FOCUS_RING,
                )}
              >
                <span className="flex flex-col leading-tight">
                  <span className="text-[13px] font-bold tabular-nums sm:text-sm">
                    {slot.range}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-[0.14em]",
                      isActive ? "text-primary/60" : "text-white/70",
                    )}
                  >
                    {slot.name}
                  </span>
                </span>

                {isReal && (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-sale"
                    title="Slot aktif sekarang"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-5 sm:mt-6">
          {catalogLoading && visibleItems.length === 0 && (
            <div className="flex h-40 items-center justify-center text-sm text-white/80">
              Memuat flash sale...
            </div>
          )}

          {visibleItems.length > 0 && (
            /*
             * Kartu bergeser masuk saat slot berganti. Hanya opacity + translate
             * (compositor), tanpa stagger panjang sehingga interaksi tidak
             * tertahan. `initial={false}` membuat hasil render awal — termasuk
             * kembali dari halaman lain — tidak beranimasi ulang.
             */
            <motion.div
              key={activeSlot ?? "none"}
              initial={reducedMotion ? false : { opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
            >
              {visibleItems.map((item) => (
                <UrgentCard
                  key={item.id}
                  item={item}
                  startsAtIso={item.startsAt ?? slotStartIso!}
                  endsAtIso={item.endsAt ?? slotEndIso!}
                  onViewDetail={onViewDetail}
                />
              ))}
            </motion.div>
<<<<<<< HEAD:app/components/home/FlashSaleSection.tsx
          )}

          {!catalogLoading && visibleItems.length === 0 && (
            <div className="rounded-2xl border border-white/20 bg-white/10 px-6 py-10 text-center">
              <h3 className="font-sans text-lg font-bold text-white sm:text-xl">
                {activeSlot
                  ? "Belum ada menu di slot ini"
                  : "Flash sale dimulai pukul 09.00 WIB"}
=======
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
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34:app/components/buyer/home/FlashSaleSection.tsx
              </h3>
              {/*
                Hitungan waktu sengaja tidak diulang di sini: header section
                sudah menampilkan angka yang sama ("Berakhir dalam" saat slot
                aktif, "Dimulai dalam" di luar slot). Dua salinan angka identik
                pada satu layar hanya menambah kebisingan.
              */}
              <p className="mx-auto mt-2 max-w-sm font-sans text-xs leading-relaxed text-white/75 sm:text-sm">
                {activeSlot
                  ? "Coba pilih slot waktu lain atau kembali lagi nanti."
                  : "Jangan sampai kelewatan — nantikan harga spesialnya."}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
