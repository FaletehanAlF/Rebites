'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, MapPin, Star } from 'lucide-react';
import { Reveal } from '@/app/components/shared/reveal';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { CATEGORIES } from '@/lib/categories';
import { formatRupiah } from '@/lib/data';
import type { FoodItem } from '@/lib/types';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Katalog preview.
 *
 * The category grid is static (it mirrors `lib/categories.ts`, which also owns
 * the real `/makanan/[category]` routes). The "Tersedia sekarang" row is an
 * enhancement: it lazy-imports `@/lib/catalog` on mount so supabase-js stays
 * out of the critical path, and simply does not render when the catalog is
 * empty — no placeholder products, no invented prices.
 */
export function FoodDiscoverySection() {
  const [items, setItems] = useState<FoodItem[]>([]);

  useEffect(() => {
    let active = true;

    import('@/lib/catalog')
      .then(({ fetchFoodItems }) => fetchFoodItems())
      .then((foodItems) => {
        if (active) setItems(foodItems.slice(0, 4));
      })
      .catch((error) => {
        console.error('[landing] gagal memuat katalog:', error);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section
      id="rekomendasi"
      aria-labelledby="discovery-heading"
      className="grain-overlay bg-white"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-16">
          <Reveal>
            <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              Jelajahi katalog
            </p>
            <h2
              id="discovery-heading"
              className="mt-4 text-balance font-display text-[clamp(1.8rem,3.4vw,2.85rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-primary"
            >
              Temukan apa yang{' '}
              <span className="font-light italic">menanti</span> hari ini.
            </h2>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="lg:pb-1">
              <p className="max-w-xl text-[15px] leading-[1.8] text-muted-foreground">
                Delapan kategori kuliner menunggu untuk dijelajahi — dari
                makanan berat sampai minuman, semuanya dari pelaku UMKM di
                sekitarmu.
              </p>
              <Link
                href="/home"
                className={`group mt-4 inline-flex items-center gap-1.5 font-secondary text-sm font-semibold text-primary ${FOCUS_RING}`}
              >
                Buka katalog lengkap
                <ArrowUpRight
                  className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </div>
          </Reveal>
        </div>

        <ul className="mt-10 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-4 md:grid-cols-4">
          {CATEGORIES.map((category, index) => (
            <Reveal
              as="li"
              key={category.id}
              delay={Math.min(index, 3) * 0.05}
              className="list-none"
            >
              <Link
                href={`/makanan/${category.id}`}
                className={`group relative block aspect-square w-full overflow-hidden rounded-2xl border border-border bg-muted sm:aspect-[5/4] ${FOCUS_RING}`}
              >
                <SmartImage
                  src={category.image}
                  alt={category.name}
                  sizes="(min-width: 1024px) 18rem, (min-width: 768px) 23vw, (min-width: 640px) 46vw, calc(50vw - 1.5rem)"
                  className="transition-transform duration-500 ease-out group-hover:scale-105"
                />
                <span
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/25 to-transparent"
                />
                <span className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                  <span className="block font-display text-sm font-semibold leading-snug tracking-tight text-white sm:text-base">
                    {category.name}
                  </span>
                  <span className="mt-1 hidden text-xs leading-snug text-white/75 line-clamp-2 sm:block">
                    {category.description}
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </ul>

        {items.length > 0 && (
          <Reveal delay={0.05}>
            <div className="mt-14 border-t border-border pt-10">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                    Tersedia sekarang
                  </p>
                  <h3 className="mt-3 font-display text-xl font-semibold tracking-tight text-primary sm:text-2xl">
                    Cuplikan menu yang sedang dibuka
                  </h3>
                </div>
                <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                  Harga, stok, dan penjual ditampilkan persis seperti di dalam
                  aplikasi.
                </p>
              </div>

              <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {items.map((item) => {
                  const hasDiscount =
                    item.originalPrice > 0 &&
                    item.originalPrice > item.discountedPrice;

                  return (
                    <li key={item.id}>
                      <Link
                        href={`/preview/product?id=${encodeURIComponent(item.id)}`}
                        className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white transition-all duration-300 hover:border-primary/40 hover:shadow-[0_24px_48px_-34px_rgba(27,77,50,0.7)] ${FOCUS_RING}`}
                      >
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                          <SmartImage
                            src={item.image}
                            alt={item.name}
                            sizes="(min-width: 1024px) 18rem, (min-width: 640px) 46vw, calc(50vw - 1.5rem)"
                          />
                          {item.discountPercent > 0 && (
                            <span className="absolute left-2.5 top-2.5 rounded-full bg-sale px-2 py-0.5 font-display text-[11px] font-bold text-white">
                              -{item.discountPercent}%
                            </span>
                          )}
                        </div>

                        <div className="flex flex-1 flex-col p-3.5 sm:p-4">
                          <p className="font-secondary text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            {item.category}
                          </p>
                          <p className="mt-1 line-clamp-1 font-display text-sm font-semibold tracking-tight text-primary">
                            {item.name}
                          </p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {item.vendorName}
                          </p>

                          <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="font-display text-base font-bold tracking-tight text-primary">
                              {formatRupiah(item.discountedPrice)}
                            </span>
                            {hasDiscount && (
                              <span className="text-xs text-muted-foreground line-through">
                                {formatRupiah(item.originalPrice)}
                              </span>
                            )}
                          </div>

                          <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Star
                                className="h-3.5 w-3.5 fill-primary text-primary"
                                aria-hidden
                              />
                              <span className="font-medium text-primary">
                                {item.rating}
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5" aria-hidden />
                              {item.distanceKm} km
                            </span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
