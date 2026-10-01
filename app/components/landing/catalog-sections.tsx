'use client';

import dynamic from "next/dynamic";

/**
 * `#rekomendasi`: katalog rekomendasi + flash sale.
 *
 * Keduanya adalah client component besar dan berada jauh di bawah fold (setelah
 * hero, strip mitra, dan section "Tentang"). Keduanya juga satu-satunya jalan
 * `lib/catalog` -> supabase-js masuk ke graph landing page, jadi di-split ke
 * chunk sendiri supaya tidak ikut menghalangi first paint.
 *
 * Konten tetap di-stream oleh SSR (`next/dynamic` App Router memakai
 * React.lazy + Suspense di mana-mana), jadi HTML statis tidak berubah.
 */
const HeroFoodCarousel = dynamic(
  () =>
    import("@/app/components/hero-food-carousel").then(
      (m) => m.HeroFoodCarousel,
    ),
  { ssr: true },
);

const FlashSaleGrid = dynamic(
  () => import("@/app/components/flash-sale-grid").then((m) => m.FlashSaleGrid),
  { ssr: true },
);

export function CatalogSections() {
  return (
    <div id="rekomendasi">
      <HeroFoodCarousel />

      <FlashSaleGrid />
    </div>
  );
}
