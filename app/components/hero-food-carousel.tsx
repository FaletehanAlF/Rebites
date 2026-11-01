"use client";

import { useMemo, useState, useRef, useId, useEffect } from "react";
import OptionWheel, { type OptionWheelApi } from "@/app/components/ui/korosel";
import { Reveal } from "./shared/reveal";
import { LeafSprig } from "./shared/ornaments";
import { useCatalog } from "@/lib/catalog";
import type { FoodItem } from "@/lib/types";
import type { FeaturedFood } from "@/app/components/product-detail-panel";

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
  // `rating` bisa null (belum ada ulasan) — pakai konvensi repo `?? 0` untuk
  // perhitungan; field ini tidak dirender oleh carousel (hanya name + image).
  const reviewCount = Math.max(
    40,
    Math.round((food.rating ?? 0) * 42 + (food.distanceKm || 1) * 7),
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
    rating: food.rating ?? 0,
    reviewCount,
    stockLabel: food.stockLabel,
    description: `${food.name} dari ${food.vendorName}, menu berkualitas dengan harga yang terjangkau.`,
  };
}

export function HeroFoodCarousel() {
  const [autoRotate] = useState(true);
  const [plateSize, setPlateSize] = useState(320);
  const wheelApi = useRef<OptionWheelApi | null>(null);
  const { foodItems } = useCatalog();

  const displayFoods: PlateFood[] = useMemo(
    () =>
      foodItems.length > 0
        ? foodItems.map(foodItemToPlate)
        : (FOODS as PlateFood[]),
    [foodItems],
  );

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

  return (
    <section
      className="grain-overlay pointer-events-none relative flex flex-col overflow-hidden bg-secondary pt-0 pb-10 select-none lg:pb-14"
    >


      <div className="mt-2 flex flex-col items-center gap-10 lg:mt-4">
        <Reveal className="relative w-full">
          <div
            className="relative mx-auto w-full max-w-3xl "
            style={{ height: plateSize + 30 }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-1/2 rounded-l-full bg-[radial-gradient(130%_180%_at_12%_30%,rgba(255,253,248,0.18),transparent_55%)]"
            />

            <div className="absolute inset-0">
              <OptionWheel
                items={displayFoods.map((f) => f.name)}
                defaultSelected={0}
                side="left"
                orientation="horizontal"
                spacing={1.2}
                curve={10}
                tilt={10}
                blur={4}
                fade={0.55}
                minOpacity={0.12}
                smoothing={200}
                loop
                autoRotate={autoRotate}
                autoRotateInterval={4200}
                plateSize={plateSize}
                apiRef={wheelApi}
                className="!py-0"
                renderItem={(i) => <FoodPlate image={displayFoods[i].image} />}
              />
            </div>
          </div>
        </Reveal>
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
