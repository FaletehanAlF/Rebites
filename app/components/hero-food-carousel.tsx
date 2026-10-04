"use client";

import { useMemo, useState, useRef, useId, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Car, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import OptionWheel, { type OptionWheelApi } from "@/app/components/ui/korosel";
import { Reveal } from "@/app/components/reveal";
import { LeafSprig } from "@/app/components/ornaments";
import { useCatalog } from "@/lib/catalog";
import { SearchFilterBar } from "@/app/components/SearchFilterBar";
import type { FoodItem, FilterKey } from "@/lib/types";
import {
  ProductDetailPanel,
  type FeaturedFood,
} from "@/app/components/product-detail-panel";

const FOODS: FeaturedFood[] = [
  {
    name: "Ayam Geprek",
    image: "/makanan1.jpeg",
    merchant: "Warung Geprek Bu Ati",
    category: "Makanan Berat",
    hours: "09.00–21.00",
    price: 12000,
    originalPrice: 15000,
    badge: "Best Seller",
    rating: 4.9,
    reviewCount: 214,
    stockLabel: "12 porsi tersisa",
    description:
      "Ayam geprek renyah dengan sambal bawang khas yang menggugah selera, siap dinikmati dengan harga lebih hemat.",
  },
  {
    name: "Nasi Goreng Kampung",
    image: "/makanan2.jpeg",
    merchant: "Kampung Rasa",
    category: "Nasi Goreng",
    hours: "10.00–21.00",
    price: 15000,
    originalPrice: 18000,
    badge: "Best Seller",
    rating: 4.8,
    reviewCount: 168,
    stockLabel: "8 porsi tersisa",
    description:
      "Nasi goreng kampung dengan bumbu ulek segar dan telur mata sapi, menghadirkan cita rasa dapur rumahan.",
  },
  {
    name: "Soto Mie Bogor",
    image: "/makanan3.jpeg",
    merchant: "Soto Mie Mang Aji",
    category: "Soto Mie",
    hours: "08.00–16.00",
    price: 18000,
    originalPrice: 22000,
    badge: "Best Seller",
    rating: 4.8,
    reviewCount: 176,
    stockLabel: "10 porsi tersisa",
    description:
      "Soto mie Bogor dengan kuah bening yang gurih, lengkap dengan mie kuning dan risoles khas kota hujan.",
  },
  {
    name: "Sate Ayam Pak Tigiset",
    image: "/makanan4.jpeg",
    merchant: "Sate Pak Tigiset",
    category: "Sate Ayam",
    hours: "15.00–22.00",
    price: 20000,
    originalPrice: 25000,
    badge: "Best Seller",
    rating: 4.9,
    reviewCount: 240,
    stockLabel: "15 porsi tersisa",
    description:
      "Sate ayam empuk dengan bumbu kacang yang meresap sempurna, gurih di setiap tusuknya.",
  },
  {
    name: "Rendang Padang Karindang",
    image: "/makanan5.jpeg",
    merchant: "RM Padang Karindang",
    category: "Rendang",
    hours: "10.00–21.00",
    price: 25000,
    originalPrice: 30000,
    badge: "Best Seller",
    rating: 4.9,
    reviewCount: 300,
    stockLabel: "6 porsi tersisa",
    description:
      "Rendang padang dengan daging empuk dan bumbu yang meresap sempurna, menghadirkan kekayaan rasa nusantara.",
  },
  {
    name: "Pancong Boss Lumer",
    image: "/makanan6.jpeg",
    merchant: "Pancong Lumer Depok",
    category: "Jajanan",
    hours: "14.00–21.00",
    price: 10000,
    originalPrice: 13000,
    badge: "Best Seller",
    rating: 4.7,
    reviewCount: 132,
    stockLabel: "20 porsi tersisa",
    description:
      "Pancong kelapa manis gurih dengan topping cokelat yang lumer, jajanan klasik yang tetap menggoda.",
  },
  {
    name: "Martabak Gombret",
    image: "/makanan7.jpg",
    merchant: "Martabak Gombret 45",
    category: "Martabak",
    hours: "17.00–23.00",
    price: 22000,
    originalPrice: 28000,
    badge: "Best Seller",
    rating: 4.8,
    reviewCount: 190,
    stockLabel: "9 porsi tersisa",
    description:
      "Martabak gombret tebal dengan isian melimpah dan rasa manis yang pas di lidah.",
  },
  {
    name: "Bakso Spesial Mas Jono",
    image: "/makanan8.webp",
    merchant: "Bakso Jono",
    category: "Bakso",
    hours: "09.00–21.00",
    price: 18000,
    originalPrice: 23000,
    badge: "Best Seller",
    rating: 4.9,
    reviewCount: 256,
    stockLabel: "11 porsi tersisa",
    description:
      "Bakso sapi kenyal dengan kuah kaldu bening yang gurih, hangat dan mengenyangkan.",
  },
  {
    name: "Ketoprak Telor Sedap",
    image: "/makanan9.webp",
    merchant: "Ketoprak Sedap",
    category: "Ketoprak",
    hours: "08.00–17.00",
    price: 13000,
    originalPrice: 16000,
    badge: "Best Seller",
    rating: 4.7,
    reviewCount: 148,
    stockLabel: "14 porsi tersisa",
    description:
      "Ketoprak lengkap dengan lontong, bihun, tahu, dan telur, disiram sambal kacang yang gurih.",
  },
  {
    name: "Mie Ayam Balap 12",
    image: "/makanan10.webp",
    merchant: "Mie Ayam Balap 12",
    category: "Mie Ayam",
    hours: "10.00–22.00",
    price: 15000,
    originalPrice: 18000,
    badge: "Best Seller",
    rating: 4.8,
    reviewCount: 202,
    stockLabel: "18 porsi tersisa",
    description:
      "Mie ayam dengan topping ayam cincang melimpah dan kuah gurih yang hangat.",
  },
];

type PlateFood = FeaturedFood & { id?: string };

function foodItemToPlate(food: FoodItem): PlateFood {
  const reviewCount = Math.max(
    40,
    Math.round(food.rating * 42 + (food.distanceKm || 1) * 7),
  );
  return {
    id: food.id,
    name: food.name,
    image: food.image,
    merchant: food.vendorName,
    category: food.category,
    hours: `${food.availableFrom}–${food.availableTo}`,
    price: food.discountedPrice,
    originalPrice: food.originalPrice,
    badge: "Best Seller",
    rating: food.rating,
    reviewCount,
    stockLabel: food.stockLabel,
    description: `${food.name} dari ${food.vendorName}, menu berkualitas dengan harga yang terjangkau.`,
  };
}

export function HeroFoodCarousel() {
  const [foodIndex, setFoodIndex] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [plateSize, setPlateSize] = useState(320);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState<FilterKey>("terdekat");
  const wheelApi = useRef<OptionWheelApi | null>(null);
  const { foodItems } = useCatalog();

  const displayFoods: PlateFood[] = useMemo(
    () =>
      foodItems.length > 0
        ? foodItems.map(foodItemToPlate)
        : (FOODS as PlateFood[]),
    [foodItems],
  );

  const safeIndex = Math.min(
    foodIndex,
    Math.max(displayFoods.length - 1, 0),
  );
  const selected = displayFoods[safeIndex] ?? displayFoods[0];
  const discountPct = Math.max(
    0,
    Math.round((1 - selected.price / selected.originalPrice) * 100) || 0,
  );

  useEffect(() => {
    setFoodIndex((prev) =>
      Math.min(prev, Math.max(displayFoods.length - 1, 0)),
    );
  }, [displayFoods.length]);

  useEffect(() => {
    const updatePlate = () => {
      const w = window.innerWidth;
      if (w < 480) setPlateSize(Math.max(Math.round((w * 14) / 16 / 1.2), 150));
      else if (w < 1024) setPlateSize(300);
      else setPlateSize(390);
    };
    updatePlate();
    window.addEventListener("resize", updatePlate);
    return () => window.removeEventListener("resize", updatePlate);
  }, []);

  const handleSelectResult = (id: string) => {
    const index = displayFoods.findIndex((food) => food.id === id);
    if (index === -1) return;
    setAutoRotate(false);
    wheelApi.current?.to(index);
    setFoodIndex(index);
  };

  const handleQueryChange = (value: string) => {
    setSearchQuery(value);
    if (!value) setAutoRotate(true);
  };

  return (
    <section
      id="rekomendasi"
      data-nav="cream"
      className="grain-overlay relative flex min-h-[100svh] flex-col overflow-hidden bg-secondary pt-20 pb-12 lg:pt-20 lg:pb-16"
    >
      <div className="relative z-10 mx-auto w-full max-w-[min(100vw,1600px)] px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-3xl text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-caramel">
              Rekomendasi Makanan
            </span>
          </div>
          <h2 className="mt-4 font-display text-[clamp(1.9rem,4vw,3rem)] font-light leading-[1.05] tracking-[-0.02em] text-forest-dark">
            Pilihan terbaik untukmu hari ini
          </h2>
          <p className="mx-auto mt-4 max-w-xl font-sans text-sm leading-[1.8] text-muted-foreground sm:text-base">
            Putar piring dan temukan makanan favorit dari UMKM terbaik di Kota
            Depok.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mx-auto mt-8 w-full max-w-4xl">
          <SearchFilterBar
            query={searchQuery}
            onQueryChange={handleQueryChange}
            onSearchSubmit={() => undefined}
            activeFilter={searchFilter}
            onFilterChange={setSearchFilter}
            showLocation={false}
            showInlineResults
            onSelectResult={handleSelectResult}
            variant="light"
            items={foodItems}
          />
        </Reveal>

        <div className="mt-8 grid items-center gap-10 lg:mt-14 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <div className="order-2 w-full lg:order-1 lg:pl-16 xl:pl-28">
            <AnimatePresence mode="wait">
              <motion.div
                key={safeIndex}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="w-full"
              >
                <ProductDetailPanel food={selected} />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="order-1 lg:order-2">
            <Reveal className="relative">
              <div className="pointer-events-none absolute right-8 top-3 z-30 flex flex-col items-end gap-2.5 sm:right-16 sm:top-4">
                <div className="drop-shadow-[0_16px_28px_rgba(47,66,53,0.55)]">
                  <div
                    aria-label={`Diskon ${discountPct} persen`}
                    className="flex h-24 w-24 items-center justify-center bg-cream text-center sm:h-28 sm:w-28"
                    style={{
                      clipPath:
                        "polygon(50.00% 0.00%, 53.62% 8.66%, 58.68% 0.76%, 60.74% 9.91%, 67.10% 3.02%, 67.54% 12.39%, 75.00% 6.70%, 73.80% 16.01%, 82.14% 11.70%, 79.34% 20.66%, 88.30% 17.86%, 83.99% 26.20%, 93.30% 25.00%, 87.61% 32.46%, 96.98% 32.90%, 90.09% 39.26%, 99.24% 41.32%, 91.34% 46.38%, 100.00% 50.00%, 91.34% 53.62%, 99.24% 58.68%, 90.09% 60.74%, 96.98% 67.10%, 87.61% 67.54%, 93.30% 75.00%, 83.99% 73.80%, 88.30% 82.14%, 79.34% 79.34%, 82.14% 88.30%, 73.80% 83.99%, 75.00% 93.30%, 67.54% 87.61%, 67.10% 96.98%, 60.74% 90.09%, 58.68% 99.24%, 53.62% 91.34%, 50.00% 100.00%, 46.38% 91.34%, 41.32% 99.24%, 39.26% 90.09%, 32.90% 96.98%, 32.46% 87.61%, 25.00% 93.30%, 26.20% 83.99%, 17.86% 88.30%, 20.66% 79.34%, 11.70% 82.14%, 16.01% 73.80%, 6.70% 75.00%, 12.39% 67.54%, 3.02% 67.10%, 9.91% 60.74%, 0.76% 58.68%, 8.66% 53.62%, 0.00% 50.00%, 8.66% 46.38%, 0.76% 41.32%, 9.91% 39.26%, 3.02% 32.90%, 12.39% 32.46%, 6.70% 25.00%, 16.01% 26.20%, 11.70% 17.86%, 20.66% 20.66%, 17.86% 11.70%, 26.20% 16.01%, 25.00% 6.70%, 32.46% 12.39%, 32.90% 3.02%, 39.26% 9.91%, 41.32% 0.76%, 46.38% 8.66%)",
                    }}
                  >
                    <span className="flex items-center gap-1 font-sans text-2xl font-black leading-none text-forest-dark sm:text-3xl">
                      <span className="text-lg sm:text-xl">−</span>
                      {discountPct}%
                    </span>
                  </div>
                </div>

                <div className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-full border border-caramel/30 bg-white/95 text-primary shadow-[0_14px_28px_-18px_rgba(27,77,50,0.6)] sm:h-28 sm:w-28">
                  <Car className="h-6 w-6 fill-caramel/15 text-caramel sm:h-7 sm:w-7" strokeWidth={2.2} />
                  <span className="px-1 text-center font-sans text-[9px] font-black uppercase leading-[1.15] tracking-[0.08em] text-primary sm:text-[10px]">
                    Pengantaran Cepat
                  </span>
                </div>

                <div className="inline-flex translate-x-4 items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-primary shadow-[0_14px_28px_-18px_rgba(27,77,50,0.5)] sm:text-[11px]">
                  <ShieldCheck className="h-3.5 w-3.5 text-caramel" strokeWidth={2.2} />
                  Kualitas Terjamin
                </div>
              </div>

              <div className="absolute bottom-3 right-3 z-30 flex items-center gap-3 sm:bottom-4 sm:right-9">
                <button
                  type="button"
                  aria-label="Makanan sebelumnya"
                  onClick={() => {
                    setAutoRotate(false);
                    wheelApi.current?.prev();
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/10 bg-white text-forest shadow-[0_8px_18px_-10px_rgba(27,77,50,0.6)] transition-all duration-200 hover:bg-primary hover:text-white active:scale-95 sm:h-14 sm:w-14"
                >
                  <ChevronLeft className="h-6 w-6 sm:h-7 sm:w-7" />
                </button>

                <div className="flex items-center gap-1 rounded-full border border-primary/10 bg-white/90 px-3.5 py-2 font-sans text-sm font-bold tabular-nums text-forest shadow-[0_8px_18px_-10px_rgba(27,77,50,0.5)]">
                  <span className="text-forest">{displayFoods.length > 0 ? safeIndex + 1 : 0}</span>
                  <span className="text-forest/50">/</span>
                  <span className="text-forest/60">{displayFoods.length}</span>
                </div>

                <button
                  type="button"
                  aria-label="Makanan berikutnya"
                  onClick={() => {
                    setAutoRotate(false);
                    wheelApi.current?.next();
                  }}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/10 bg-white text-forest shadow-[0_8px_18px_-10px_rgba(27,77,50,0.6)] transition-all duration-200 hover:bg-primary hover:text-white active:scale-95 sm:h-14 sm:w-14"
                >
                  <ChevronRight className="h-6 w-6 sm:h-7 sm:w-7" />
                </button>
              </div>

              <div className="relative mx-auto w-full max-w-[15rem] sm:max-w-[30rem] lg:mr-[-2rem] lg:max-w-[42rem]">
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-y-2 left-0 right-0 z-0 rounded-l-full border-2 border-white bg-green-700 shadow-[0_44px_80px_-42px_rgba(63,107,74,0.75)] ring-1 ring-inset ring-caramel/30"
                />
                <div className="relative overflow-hidden rounded-l-full" style={{ height: plateSize + 10 }}>
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-0 w-1/2 rounded-l-full bg-[radial-gradient(130%_180%_at_12%_30%,rgba(255,253,248,0.18),transparent_55%)]"
                  />
                  <LeafSprig className="left-7 top-1/2 h-12 w-12 -translate-y-1/2 rotate-12 text-white/30" />

                  <div className="absolute inset-0">
                    <OptionWheel
                      items={displayFoods.map((f) => f.name)}
                      defaultSelected={0}
                      side="right"
                      orientation="vertical"
                      spacing={0.45}
                      curve={18}
                      tilt={6}
                      blur={4}
                      fade={1}
                      minOpacity={0}
                      smoothing={200}
                      loop
                      draggable
                      autoRotate={autoRotate}
                      autoRotateInterval={4200}
                      plateSize={plateSize}
                      onChange={(index) => setFoodIndex(index)}
                      apiRef={wheelApi}
                      className="!py-0 -translate-x-[9%] sm:-translate-x-[18%] lg:-translate-x-[20%]"
                      renderItem={(i) => <FoodPlate image={displayFoods[i].image} />}
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-green-700 to-transparent"
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-green-700 to-transparent"
                    />
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-green-700 to-transparent"
                    />
                  </div>

                  <div
                    aria-hidden
                    className="absolute right-7 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-center gap-3 lg:flex"
                  >
                    <span className="h-9 w-px bg-caramel/60" />
                    <span className="[writing-mode:vertical-rl] font-display text-xs font-semibold uppercase tracking-[0.48em] text-white">
                      ReBites
                    </span>
                    <span className="h-9 w-px bg-caramel/60" />
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>

      </section>
  );
}

function FoodPlate({ image }: { image: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gradId = `plate-surface-${uid}`;
  const clipId = `plate-cut-${uid}`;

  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label="Piring makanan"
      className="h-full w-full drop-shadow-[0_16px_22px_-14px_rgba(63,107,74,0.55)]"
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="42%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="72%" stopColor="#F4F1E9" />
          <stop offset="100%" stopColor="#DFDAC8" />
        </radialGradient>

        <clipPath id={clipId}>
          <circle cx="100" cy="100" r="84" />
        </clipPath>
      </defs>

      <circle cx="100" cy="100" r="92" fill={`url(#${gradId})`} />

      <circle
        cx="100"
        cy="100"
        r="92"
        fill="none"
        stroke="#DEDACF"
        strokeWidth="2.5"
      />

      <circle
        cx="100"
        cy="100"
        r="88"
        fill="none"
        stroke="#E6E1D1"
        strokeWidth="1.5"
      />

      <circle cx="100" cy="100" r="86" fill="#F7F5EF" />

      <image
        href={image}
        x="0"
        y="0"
        width="200"
        height="200"
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${clipId})`}
      />

      <circle
        cx="100"
        cy="100"
        r="84"
        fill="none"
        stroke="#F7F5EF"
        strokeWidth="4"
      />

      <ellipse cx="80" cy="66" rx="46" ry="22" fill="#FFFFFF" opacity="0.16" />
    </svg>
  );
}