"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Quote,
  Search,
  SearchX,
  Star,
  Utensils,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCatalog } from "@/lib/catalog";
import type { FoodItem, Vendor } from "@/lib/types";
import { SiteFooter } from "@/app/components/site-footer";
import { ProductDetailModal } from "@/app/components/shared/ProductDetailModalLazy";
import { CategoryRow } from "@/app/components/detail-toko/category-row";
import { useProductDetail } from "@/app/components/detail-product/use-product-detail";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@/app/components/ui/avatar";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/app/components/ui/carousel";
import { StoreHeroCard } from "@/app/components/detail-toko/store-hero-card";
import { getServiceReviews } from "@/lib/review-storage";
import {
  getStoreProductsBySlug,
  isProductAvailable,
  PRODUCTS_UPDATED_EVENT,
} from "@/lib/product-storage";
import type { SellerProduct } from "@/lib/product-storage";
import {
  getDisplayPricing,
  getFlashDiscountPercent,
} from "@/lib/flash-sale";
import { STORE_SETTINGS_UPDATED_EVENT } from "@/lib/store-settings-storage";
import { isVendorReallyOpen } from "@/lib/store-status";

function sellerProductToFoodItem(
  sp: SellerProduct,
  vendor: Vendor
): FoodItem {

  const pricing = getDisplayPricing(sp);
  return {
    id: sp.id,
    name: sp.name,
    vendorName: vendor.name,
    image: sp.image,
    category: sp.category as FoodItem["category"],
    // Rating asli dari database (products.rating). Null = belum ada rating
    // tercatat; kartu produk menyembunyikannya (tidak mengarang angka).
    rating: sp.rating ?? null,
    distanceKm: vendor.distanceKm,
    availableFrom: sp.startTime,
    availableTo: sp.endTime,
    stockLabel: sp.stock > 0 ? `${sp.stock} porsi tersisa` : "Habis",
    originalPrice: sp.originalPrice,
    discountedPrice: pricing.price,
    discountPercent: pricing.isFlash
      ? getFlashDiscountPercent(sp)
      : sp.discountPercent,
  };
}

function isOpenNow(openHours: string): boolean {
  // Deprecated: gunakan isOpenNow dari lib/store-status untuk konsistensi
  const match = openHours.match(
    /(\d{1,2})\.(\d{2})\s*[-]\s*(\d{1,2})\.(\d{2})/,
  );
  if (!match) return true;

  const open = Number(match[1]) * 60 + Number(match[2]);
  const close = Number(match[3]) * 60 + Number(match[4]);
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();

  return open <= close
    ? minutes >= open && minutes < close
    : minutes >= open || minutes < close;
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

interface ServiceReview {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  comment: string;
  timeAgo: string;
}

function StoreServiceReviews({ vendor }: { vendor: Vendor }) {
  const [reviews, setReviews] = useState<ServiceReview[]>([]);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let active = true;
    getServiceReviews(vendor.id).then((rows) => {
      if (!active) return;
      setReviews(
        rows.map((r) => ({
          id: r.id,
          name: r.reviewerName,
          avatar: r.avatar,
          rating: r.rating,
          comment: r.comment,
          timeAgo: r.date,
        }))
      );
    });
    return () => {
      active = false;
    };
  }, [vendor.id]);

  useEffect(() => {
    if (!carouselApi) return;

    const onSelect = () => setActiveIndex(carouselApi.selectedScrollSnap());

    onSelect();
    carouselApi.on("select", onSelect);
    carouselApi.on("reInit", onSelect);

    return () => {
      carouselApi.off("select", onSelect);
      carouselApi.off("reInit", onSelect);
    };
  }, [carouselApi]);

  if (reviews.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mt-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sage-500">
          Review Pelanggan
        </p>
        <h2 className="mt-1.5 font-display text-2xl font-medium tracking-tight text-primary sm:text-3xl">
          Kata Pelanggan tentang Pelayanan {vendor.name}
        </h2>
      </div>

      <div className="relative mt-6">
        <button
          type="button"
          onClick={() => carouselApi?.scrollPrev()}
          aria-label="Review sebelumnya"
          className="absolute -left-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-primary shadow-[0_10px_30px_-24px_rgba(34,81,56,0.3)] transition-all duration-300 hover:-translate-y-1/2 hover:border-caramel hover:bg-caramel hover:text-white sm:flex"
        >
          <ArrowRight className="h-4 w-4 rotate-180" />
        </button>

        <button
          type="button"
          onClick={() => carouselApi?.scrollNext()}
          aria-label="Review berikutnya"
          className="absolute -right-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-primary shadow-[0_10px_30px_-24px_rgba(34,81,56,0.3)] transition-all duration-300 hover:-translate-y-1/2 hover:border-caramel hover:bg-caramel hover:text-white sm:flex"
        >
          <ArrowRight className="h-4 w-4" />
        </button>

        <Carousel opts={{ align: "start", loop: true }} setApi={setCarouselApi}>
          <CarouselContent className="-ml-4 lg:-ml-5">
            {reviews.map((review) => (
              <CarouselItem
                key={review.id}
                className="basis-full pl-4 sm:basis-1/2 sm:pl-4 lg:basis-1/3 lg:pl-5"
              >
                <div className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-white p-8 shadow-[0_10px_30px_-24px_rgba(34,81,56,0.3)] transition-all duration-300 hover:-translate-y-1 hover:border-caramel/40 hover:shadow-[0_30px_60px_-28px_rgba(34,81,56,0.35)] lg:p-9">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -top-3 right-4 select-none font-display text-[6rem] font-extralight leading-none text-caramel/[0.08] transition-colors duration-300 group-hover:text-caramel/15"
                  >
                    &ldquo;
                  </span>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: review.rating }).map((_, s) => (
                      <Star
                        key={s}
                        className="h-4 w-4 fill-caramel text-caramel"
                      />
                    ))}
                  </div>

                  <Quote className="mt-5 h-5 w-5 text-caramel/40" />

                  <blockquote className="mt-3 flex-1 font-sans text-sm leading-relaxed text-foreground/80">
                    &ldquo;{review.comment}&rdquo;
                  </blockquote>

                  <div className="relative mt-7 flex items-center gap-3 pt-6">
                    <span
                      aria-hidden
                      className="absolute inset-x-0 top-0 h-px"
                      style={{
                        background:
                          "repeating-linear-gradient(90deg, currentColor 0 5px, transparent 5px 10px)",
                        opacity: 0.35,
                      }}
                    />

                    <Avatar className="h-11 w-11 border border-caramel/30">
                      <AvatarImage
                        src={review.avatar}
                        alt={review.name}
                        className="object-cover"
                      />

                      <AvatarFallback className="bg-caramel font-display text-sm font-medium text-white">
                        {initialsOf(review.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div>
                      <p className="font-display text-base font-medium text-primary">
                        {review.name}
                      </p>

                      <p className="mt-0.5 font-sans text-xs text-muted-foreground">
                        {review.timeAgo}
                      </p>
                    </div>
                  </div>
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>

      <div className="mt-7 flex justify-center gap-2">
        {reviews.map((review, i) => (
          <button
            key={review.id}
            type="button"
            aria-label={`Ke review ${i + 1}`}
            onClick={() => carouselApi?.scrollTo(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              activeIndex === i
                ? "w-8 bg-primary"
                : "w-1.5 bg-charcoal-900/15 hover:bg-charcoal-900/30"
            }`}
          />
        ))}
      </div>
    </>
  );
}

function StoreNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream-50 px-5 font-sans text-charcoal-900">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-sage-100 bg-white p-10 text-center shadow-md shadow-primary/5">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sage-100 text-primary">
          <Utensils className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-xl font-medium tracking-tight text-primary">
            Toko tidak ditemukan
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-charcoal-500">
            Toko yang kamu cari tidak tersedia atau sudah tidak aktif. Coba
            jelajahi toko lain di beranda.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-colors hover:bg-caramel"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Beranda
        </Link>
      </div>
    </main>
  );
}

function StoreDetailContent() {
  const searchParams = useSearchParams();
  const storeId = searchParams.get("id");
  const { vendors, loading: catalogLoading } =
    useCatalog();
  const vendor: Vendor | undefined = vendors.find(
    (item) => item.id === storeId,
  );

  const [storeProducts, setStoreProducts] = useState<SellerProduct[]>([]);
  const [storeLoading, setStoreLoading] = useState(true);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadsOwnProducts = Boolean(vendor);

  useEffect(() => {
    if (!vendor || !loadsOwnProducts) {
      setStoreProducts([]);
      setStoreError(null);
      setStoreLoading(false);
      return;
    }
    let mounted = true;
    setStoreLoading(true);
    setStoreError(null);

    const load = async () => {
      const result = await getStoreProductsBySlug(storeId ?? "", { onlyApproved: true });
      if (!mounted) return;
      setStoreProducts(result.products);
      setStoreError(result.error);
      setStoreLoading(false);
    };

    load();
    window.addEventListener(PRODUCTS_UPDATED_EVENT, load);
    window.addEventListener(STORE_SETTINGS_UPDATED_EVENT, load);
    return () => {
      mounted = false;
      window.removeEventListener(PRODUCTS_UPDATED_EVENT, load);
      window.removeEventListener(STORE_SETTINGS_UPDATED_EVENT, load);
    };
  }, [vendor, loadsOwnProducts, storeId, reloadKey]);

  const foods = useMemo(
    () => {
      if (!vendor) return [];
      return storeProducts.map((sp) => sellerProductToFoodItem(sp, vendor));
    },
    [vendor, storeProducts]
  );

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Semua");
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [openNow, setOpenNow] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );

  const handleViewDetail = useCallback((id: string) => {
    setSelectedProductId(id);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedProductId(null);
  }, []);

  const selectedProduct = useProductDetail(selectedProductId);

  useEffect(() => {
    setQuery("");
    setActiveCategory("Semua");
    setIsCategoryOpen(false);
    setOpenNow(true);
    setSelectedProductId(null);
  }, [storeId]);

  useEffect(() => {
    if (vendor) setOpenNow(isVendorReallyOpen({ isOpen: vendor.isOpen, openHours: vendor.openHours }));
  }, [vendor?.isOpen, vendor?.openHours]);

  const featuredIds = useMemo(
    () => new Set(storeProducts.filter((sp) => sp.featured).map((sp) => sp.id)),
    [storeProducts]
  );

  const sellerAvailability = useMemo(() => {
    if (!loadsOwnProducts) return new Map<string, boolean>();
    const map = new Map<string, boolean>();
    for (const sp of storeProducts) {
      map.set(sp.id, isProductAvailable(sp));
    }
    return map;
  }, [loadsOwnProducts, storeProducts]);

  const categoryGroups = useMemo(() => {
    const sorted = [...foods].sort(
      (a, b) => Number(featuredIds.has(b.id)) - Number(featuredIds.has(a.id))
    );
    const map = new Map<string, FoodItem[]>();
    for (const item of sorted) {
      const list = map.get(item.category);
      if (list) list.push(item);
      else map.set(item.category, [item]);
    }
    return Array.from(map.entries());
  }, [foods, featuredIds]);

  const searching = query.trim().length > 0;

  const visibleGroups = useMemo(() => {
    let groups = categoryGroups;
    if (activeCategory !== "Semua") {
      groups = groups.filter(([cat]) => cat === activeCategory);
    }
    if (!searching) return groups;
    const q = query.trim().toLowerCase();
    return groups
      .map(([cat, items]) => {
        const filtered = items.filter((item) =>
          item.name.toLowerCase().includes(q)
        );
        return [cat, filtered] as const;
      })
      .filter(([, items]) => items.length > 0);
  }, [categoryGroups, activeCategory, searching, query]);

  const displayCategories = useMemo(
    () => ["Semua", ...categoryGroups.map(([cat]) => cat)],
    [categoryGroups]
  );

  const hasResults = visibleGroups.length > 0;

  if (!vendor) {
    return <StoreNotFound />;
  }

  return (
    <main className="min-h-screen bg-cream-50 font-sans text-charcoal-900">
      { }
      <StoreHeroCard vendor={vendor} openNow={openNow} />

      { }
      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <section id="menu-surplus" className="pt-9">
          <h2 className="mt-1.5 font-display text-2xl font-medium tracking-tight text-primary sm:text-3xl">
            Menu Surplus dari {vendor.name}
          </h2>

          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-500" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Cari menu di ${vendor.name}...`}
                aria-label="Cari menu di toko ini"
                className="w-full rounded-full border border-sage-100 bg-cream-50 py-2.5 pl-11 pr-10 text-sm text-charcoal-900 outline-none transition-colors placeholder:text-charcoal-500/70 focus:border-primary focus:bg-white"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Hapus pencarian"
                  className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-sage-100 text-charcoal-900 transition-colors hover:bg-sage-100/70"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="relative shrink-0 self-start lg:self-auto">
              <button
                type="button"
                onClick={() => setIsCategoryOpen((v) => !v)}
                aria-expanded={isCategoryOpen}
                aria-haspopup="listbox"
                className={cn(
                  "flex h-[38px] items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors duration-200",
                  activeCategory !== "Semua" || isCategoryOpen
                    ? "border-primary bg-white text-primary"
                    : "border-sage-100 bg-white text-charcoal-900 hover:border-caramel hover:text-caramel",
                )}
              >
                {activeCategory === "Semua" ? "Kategori" : activeCategory}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isCategoryOpen && "rotate-180",
                  )}
                />
              </button>

              <AnimatePresence>
                {isCategoryOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-sage-100 bg-white p-2 shadow-lg shadow-primary/10"
                  >
                    {displayCategories.map((cat) => {
                      const isActive = activeCategory === cat;

                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setActiveCategory(cat);
                            setIsCategoryOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm transition-colors duration-200",
                            isActive
                              ? "bg-primary font-semibold text-white"
                              : "text-charcoal-500 hover:bg-sage-100",
                          )}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {loadsOwnProducts && storeLoading ? (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  aria-hidden
                  className="h-64 animate-pulse rounded-2xl bg-white shadow-md shadow-primary/5"
                />
              ))}
            </div>
          ) : loadsOwnProducts && storeError ? (
            <div className="mt-8 flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-sage-100 bg-white p-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cream-50 text-primary shadow-sm">
                <SearchX className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm font-bold text-charcoal-900">
                  Menu gagal dimuat
                </p>
                <p className="mt-1 text-xs leading-relaxed text-sage-500">
                  Terjadi kendala saat memuat menu toko ini. Silakan coba lagi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-colors hover:bg-caramel"
              >
                Coba Lagi
              </button>
            </div>
          ) : loadsOwnProducts && storeProducts.length === 0 ? (
            <div className="mt-8 flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-sage-100 bg-white p-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cream-50 text-primary shadow-sm">
                <Utensils className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm font-bold text-charcoal-900">
                  Belum ada menu surplus
                </p>
                <p className="mt-1 text-xs leading-relaxed text-sage-500">
                  Toko ini belum menayangkan menu surplus. Kunjungi lagi nanti,
                  ya.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-6 flex flex-col gap-10">
                {visibleGroups.map(([cat, items]) => (
                  <CategoryRow
                    key={cat}
                    title={cat}
                    items={items}
                    onSelect={handleViewDetail}
                    featuredIds={featuredIds}
                    isItemUnavailable={
                      loadsOwnProducts
                        ? (item) =>
                            sellerAvailability.has(item.id)
                              ? !sellerAvailability.get(item.id)
                              : undefined
                        : undefined
                    }
                  />
                ))}
              </div>

              {!hasResults && (
                <div className="mt-8 flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-sage-100 bg-white p-10 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-cream-50 text-primary shadow-sm">
                    <SearchX className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-charcoal-900">
                      Menu tidak ditemukan
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-sage-500">
                      Coba kata kunci lain atau lihat semua menu surplus di toko
                      ini.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setActiveCategory("Semua");
                    }}
                    className="rounded-full border border-primary px-5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-caramel hover:text-white"
                  >
                    Lihat Semua Menu
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
        <section id="tentang-toko" className="mt-14 pb-4">
          <StoreServiceReviews vendor={vendor} />
        </section>
      </div>

      <SiteFooter />

      <AnimatePresence>
        {selectedProduct && (
          <ProductDetailModal
            product={selectedProduct}
            onClose={handleCloseModal}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

export default function DetailTokoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream-50" />}>
      <StoreDetailContent />
    </Suspense>
  );
}
