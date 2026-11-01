"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  PackageOpen,
  SearchX,
} from "lucide-react";
import { SiteFooter } from "@/app/components/site-footer";
import { BuyerShell } from "@/app/components/shared/buyer-shell";
import { FoodCard } from "@/app/components/shared/FoodCard";
import { ProductDetailModal } from "@/app/components/shared/ProductDetailModalLazy";
import { StoreClosedModal } from "@/app/components/shared/StoreClosedModal";
import { useStoreClosedModal } from "@/lib/store-closed-modal-store";
import { SearchFilterBar } from "@/app/components/shared/SearchFilterBar";
import { SmartImage } from "@/app/components/shared/SmartImage";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCatalog } from "@/lib/catalog";
import { getCategoryBySlug } from "@/lib/categories";
import { useProductDetail } from "@/app/components/detail-product/use-product-detail";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

function FoodCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-md shadow-primary/5">
      <Skeleton className="aspect-[4/3] w-full rounded-none bg-muted" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3.5 w-1/2" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full rounded-full" />
      </div>
    </div>
  );
}

export default function CategoryView({
  slug,
  name,
}: {
  slug: string;
  name: string;
}) {
  const category = getCategoryBySlug(slug);
  const description =
    category?.description ??
    "Temukan makanan berlebih yang masih layak dinikmati di sekitarmu.";
  const categoryImage = category?.image;

  const [status, setStatus] = useState<"loading" | "ready">("loading");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );
  const storeClosedModal = useStoreClosedModal();
  const { foodItems, loading: catalogLoading } = useCatalog();

  useEffect(() => {
    if (!catalogLoading) setStatus("ready");
  }, [catalogLoading]);

  const baseCategoryItems = useMemo(
    () => foodItems.filter((item) => item.category === name),
    [name, foodItems],
  );

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return baseCategoryItems.filter((item) => {
      if (query === "") return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.vendorName.toLowerCase().includes(query)
      );
    });
  }, [baseCategoryItems, searchQuery]);

  const selectedProduct = useProductDetail(selectedProductId);

  // Stable identities: ProductDetailModal re-runs its whole effect suite
  // (keydown listener, body scroll lock, focus restore) whenever onClose changes.
  const handleViewDetail = useCallback((id: string) => setSelectedProductId(id), []);
  const handleCloseProduct = useCallback(() => setSelectedProductId(null), []);

  const resetSearch = () => {
    setSearchQuery("");
  };

  const isLoading = status === "loading";
  const isCategoryEmpty = !isLoading && baseCategoryItems.length === 0;
  const showNoResults =
    !isLoading && !isCategoryEmpty && filteredItems.length === 0;

  return (
    <BuyerShell>
    <div className="flex min-h-screen flex-col bg-secondary">
      <main className="flex-1">
        {}
        <section className="relative overflow-hidden">
          {}
          {categoryImage && (
            <div className="absolute inset-0">
              <SmartImage
                src={categoryImage}
                alt={`Foto kategori ${name}`}
                sizes="100vw"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/25 to-secondary" />
            </div>
          )}

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {}
            <div className="pt-6">
              <Link
                href="/home"
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-4 py-2 text-sm font-medium text-white shadow-sm backdrop-blur-md transition-all duration-200 hover:border-white/40 hover:bg-white/25 active:scale-[0.98]",
                  FOCUS_RING,
                )}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Kembali
              </Link>
            </div>

            {}
            <header className="mt-6 max-w-2xl pb-12 sm:pb-16 lg:pb-20">
              <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                {name}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-white/90 sm:text-base" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.25)" }}>
                {description}
              </p>

              {}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span
                  aria-live="polite"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {isLoading
                    ? "Memuat…"
                    : `${filteredItems.length} makanan tersedia`}
                </span>
              </div>
            </header>
          </div>
        </section>

        {}
        <section className="border-b border-border bg-secondary">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="py-3 sm:py-4">
              <SearchFilterBar
                query={searchQuery}
                onQueryChange={setSearchQuery}
                onSearchSubmit={() => undefined}
                showLocation={false}
                showInlineResults={false}
                variant="light"
                placeholder={`Cari di kategori ${name}…`}
              />
            </div>
          </div>
        </section>

        {}
        <section className="mx-auto max-w-7xl px-4 pb-24 pt-4 sm:px-6 sm:pt-8 lg:px-8">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 sm:gap-5 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <FoodCardSkeleton key={index} />
              ))}
            </div>
          ) : isCategoryEmpty ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-white px-6 py-20 text-center"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <PackageOpen
                  className="h-8 w-8 text-muted-foreground"
                  aria-hidden
                />
              </span>
              <h2 className="mt-5 font-display text-xl font-bold text-foreground">
                Belum ada makanan di kategori ini
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Coba pilih kategori lain atau cek kembali beberapa saat lagi.
              </p>
              <Link
                href="/toko"
                className={cn(
                  "mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-dark active:scale-[0.98]",
                  FOCUS_RING,
                )}
              >
                Lihat Semua Makanan
              </Link>
            </motion.div>
          ) : showNoResults ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: EASE }}
              className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-white px-6 py-20 text-center"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <SearchX className="h-8 w-8 text-muted-foreground" aria-hidden />
              </span>
              <h2 className="mt-5 font-display text-xl font-bold text-foreground">
                Tidak ada makanan yang cocok
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Coba ubah kata kunci pencarian kamu.
              </p>
              <button
                type="button"
                onClick={resetSearch}
                className={cn(
                  "mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-dark active:scale-[0.98]",
                  FOCUS_RING,
                )}
              >
                Reset Pencarian
              </button>
            </motion.div>
          ) : (
            <motion.div
              key={`${slug}-${searchQuery}`}
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.05 } },
              }}
              className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 xl:grid-cols-4"
            >
              {filteredItems.map((item) => (
                <motion.div
                  key={item.id}
                  variants={{
                    hidden: { opacity: 0, y: 16 },
                    visible: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.4, ease: EASE },
                    },
                  }}
                >
                  <FoodCard item={item} onViewDetail={handleViewDetail} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </section>
      </main>

      <SiteFooter hasMobileBottomNav />

      <AnimatePresence>
        {selectedProduct && (
          <ProductDetailModal
            product={selectedProduct}
            onClose={handleCloseProduct}
          />
        )}
      </AnimatePresence>

      <StoreClosedModal
        isOpen={storeClosedModal.isOpen}
        onClose={storeClosedModal.close}
        availableFrom={storeClosedModal.availableFrom}
        availableTo={storeClosedModal.availableTo}
      />
    </div>
    </BuyerShell>
  );
}
