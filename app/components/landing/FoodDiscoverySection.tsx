'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, MapPin, Star } from 'lucide-react';
import { Reveal } from '@/app/components/shared/reveal';
import { SectionHeading } from '@/app/components/landing/SectionHeading';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { CATEGORIES } from '@/lib/categories';
import { formatRupiah } from '@/lib/data';
import { fetchFeaturedProducts } from '@/app/components/landing/featured-products';
import type { FoodItem } from '@/lib/types';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Cuplikan katalog: memperlihatkan produknya, bukan hanya bicara tentang
 * produknya. Enam menu asli diambil dari Supabase lewat `featured-products`
 * (satu request dibagi dengan hero); bila katalog kosong, section ini tetap
 * utuh lewat baris kategori + tautan katalog — tidak ada kartu palsu.
 */
export function FoodDiscoverySection() {
  const [items, setItems] = useState<FoodItem[]>([]);

  useEffect(() => {
    let active = true;

    fetchFeaturedProducts(6)
      .then((featured) => {
        if (active) setItems(featured);
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
      className="border-t border-border bg-white"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <SectionHeading
          id="discovery-heading"
          heading="Temukan Favoritmu, Lebih Hemat."
          description="Jelajahi pilihan makanan surplus dari pelaku UMKM dan temukan kuliner yang sesuai dengan seleramu."
        />

        <Reveal delay={0.06}>
          <div className="mt-6 flex justify-center">
            <Link
              href="/home"
              className={`group inline-flex min-h-[40px] items-center gap-1.5 font-secondary text-sm font-semibold text-primary ${FOCUS_RING}`}
            >
              Lihat semua makanan
              <ArrowUpRight
                className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </div>
        </Reveal>

        {items.length > 0 && (
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-4 lg:grid-cols-3">
            {items.map((item, index) => {
              const hasDiscount =
                item.originalPrice > 0 &&
                item.originalPrice > item.discountedPrice;

              return (
                <Reveal
                  key={item.id}
                  as="li"
                  delay={Math.min(index, 3) * 0.05}
                >
                  <Link
                    href={`/preview/product?id=${encodeURIComponent(item.id)}`}
                    className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white transition-colors duration-300 hover:border-primary ${FOCUS_RING}`}
                  >
                    <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted">
                      <SmartImage
                        src={item.image}
                        alt={item.name}
                        sizes="(min-width: 1024px) 24rem, (min-width: 640px) 46vw, calc(50vw - 1.5rem)"
                        className="transition-transform duration-500 ease-out group-hover:scale-105"
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

                      <div className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-1 pt-3">
                        <span className="font-display text-base font-bold tracking-tight text-primary">
                          {formatRupiah(item.discountedPrice)}
                        </span>
                        {hasDiscount && (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatRupiah(item.originalPrice)}
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
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

                      {item.stockLabel && (
                        <p className="mt-2 line-clamp-1 text-[11px] text-muted-foreground">
                          {item.stockLabel}
                        </p>
                      )}
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </ul>
        )}

        <div className="mt-12 border-t border-border pt-8">
          <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Jelajahi per kategori
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/makanan/${category.id}`}
                  className={`inline-flex min-h-[40px] items-center rounded-full border border-border bg-secondary px-4 font-secondary text-sm font-medium text-foreground transition-colors duration-200 hover:border-primary hover:bg-accent hover:text-primary ${FOCUS_RING}`}
                >
                  {category.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
