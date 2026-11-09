
'use client';

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowUpRight, MapPin, RefreshCw, Star } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { Reveal } from '@/app/components/shared/reveal';
import { SectionHeading } from '@/app/components/landing/SectionHeading';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { fetchFeaturedProducts } from '@/app/components/landing/featured-products';
import { CATEGORIES } from '@/lib/categories';
import { formatRupiah } from '@/lib/data';
import type { FoodItem } from '@/lib/types';

gsap.registerPlugin(ScrollTrigger);

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const PRODUCT_COUNT = 8;

function getRandomItems(
  pool: FoodItem[],
  count: number,
  excludeIds: string[] = [],
): FoodItem[] {
  if (pool.length === 0) return [];

  const available = pool.filter(
    (item) => !excludeIds.includes(item.id),
  );

  const source = available.length >= count ? available : pool;
  const shuffled = [...source];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

export function FoodDiscoverySection() {
  const [allProducts, setAllProducts] = useState<FoodItem[]>([]);
  const [displayedItems, setDisplayedItems] = useState<FoodItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, startTransition] = useTransition();

  const pinRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let active = true;

    fetchFeaturedProducts(20)
      .then((products) => {
        if (!active) return;

        setAllProducts(products);
        setDisplayedItems(getRandomItems(products, PRODUCT_COUNT));
      })
      .catch((error) => {
        console.error('[landing] gagal memuat katalog:', error);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useLayoutEffect(() => {
    const pin = pinRef.current;
    const viewport = viewportRef.current;
    const track = trackRef.current;

    if (
      !pin ||
      !viewport ||
      !track ||
      isLoading ||
      displayedItems.length < 2
    ) {
      return;
    }

    const ctx = gsap.context(() => {
      const getDistance = () =>
        Math.max(0, track.scrollWidth - viewport.clientWidth);

      if (getDistance() <= 0) return;

      gsap.to(track, {
        x: () => -getDistance(),
        ease: 'none',
        scrollTrigger: {
          trigger: pin,
          start: 'top top',
          end: () => `+=${getDistance()}`,
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });
    }, pin);

    const refreshFrame = requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });

    return () => {
      cancelAnimationFrame(refreshFrame);
      ctx.revert();
    };
  }, [isLoading, displayedItems.length]);

  const handleShuffle = () => {
    if (allProducts.length === 0) return;

    const currentIds = displayedItems.map((item) => item.id);
    const newRandom = getRandomItems(
      allProducts,
      PRODUCT_COUNT,
      currentIds,
    );

    startTransition(() => {
      setDisplayedItems(newRandom);
    });
  };

  return (
    <section
      id="rekomendasi"
      aria-labelledby="discovery-heading"
      className="border-t border-border bg-white"
    >
      <div
        ref={pinRef}
        className="flex min-h-[100svh] flex-col justify-center overflow-hidden py-8 sm:py-10"
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal delay={0.06}>
            <SectionHeading
              id="discovery-heading"
              heading="Temukan Favoritmu, Lebih Hemat."
              description="Jelajahi pilihan makanan surplus dari pelaku UMKM dan temukan kuliner yang sesuai dengan seleramu."
            />
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-6">
              <Link
                href="/home"
                className={`group inline-flex min-h-10 items-center gap-1.5 font-secondary text-sm font-semibold text-primary ${FOCUS_RING}`}
              >
                Lihat semua makanan
                <ArrowUpRight
                  className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>

              {allProducts.length > PRODUCT_COUNT && (
                <button
                  type="button"
                  onClick={handleShuffle}
                  disabled={isLoading}
                  className={`group inline-flex min-h-10 items-center gap-1.5 font-secondary text-sm font-semibold text-muted-foreground transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                >
                  <RefreshCw
                    className="h-4 w-4 transition-transform duration-500 group-hover:rotate-180"
                    aria-hidden
                  />
                  Acak
                </button>
              )}
            </div>
          </Reveal>

          {isLoading ? (
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-2xl border border-border p-3"
                >
                  <div className="aspect-[4/3] rounded-xl bg-muted" />
                  <div className="mt-4 h-4 w-3/4 rounded bg-muted" />
                  <div className="mt-3 h-4 w-1/2 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : displayedItems.length > 0 ? (
            <div
              ref={viewportRef}
              className="mt-10 overflow-hidden"
            >
              <ul
                ref={trackRef}
                className="flex w-max gap-4 pr-4"
              >
                {displayedItems.map((item, index) => {
                  const hasDiscount =
                    item.originalPrice > 0 &&
                    item.originalPrice > item.discountedPrice;

                  return (
                    <Reveal
                      key={item.id}
                      as="li"
                      delay={Math.min(index, 3) * 0.05}
                      className="w-[76vw] max-w-[300px] shrink-0 sm:w-[280px] lg:w-[300px]"
                    >
                      <Link
                        href="/auth/login"
                        className={`group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white transition-colors duration-300 hover:border-primary ${FOCUS_RING}`}
                      >
                        <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-muted">
                          <SmartImage
                            src={item.image}
                            alt={item.name}
                            sizes="(min-width: 1024px) 300px, 76vw"
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
                              <MapPin
                                className="h-3.5 w-3.5"
                                aria-hidden
                              />
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
            </div>
          ) : (
            <p className="mt-10 text-center text-sm text-muted-foreground">
              Belum ada produk yang tersedia.
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8 lg:pb-24">
        <Reveal delay={0.08}>
          <div className="border-t border-border pt-8">
            <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Jelajahi per kategori
            </p>

            <ul className="mt-4 flex flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <li key={category.id}>
                  <Link
                    href="/auth/login"
                    className={`inline-flex min-h-10 items-center rounded-full border border-border bg-secondary px-4 font-secondary text-sm font-medium text-foreground transition-colors duration-200 hover:border-primary hover:bg-accent hover:text-primary ${FOCUS_RING}`}
                  >
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
