"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Filter,
  PackageOpen,
  SearchX,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { BuyerShell } from "@/app/components/shared/buyer-shell";
import { FoodCard } from "@/app/components/shared/FoodCard";
import { SiteFooter } from "@/app/components/site-footer";
import { Skeleton } from "@/app/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCatalog } from "@/lib/catalog";
import { CATEGORIES, getCategoryBySlug } from "@/lib/categories";
import { formatRupiah } from "@/lib/data";
import {
  availableFoodCategories,
  countActiveFoodFilters,
  filterAndSortFoods,
  type FoodSortKey,
  type StockFilter,
} from "@/lib/catalog-filters";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const PAGE_SIZE = 12;

/** Label kategori dari slug; slug yang tidak terdaftar ditampilkan apa adanya. */
function categoryLabel(slug: string | null): string | null {
  if (!slug) return null;
  return getCategoryBySlug(slug)?.name ?? slug;
}

const SORT_OPTIONS: { key: FoodSortKey; label: string }[] = [
  { key: "relevan", label: "Paling relevan" },
  { key: "diskon-terbesar", label: "Diskon terbesar" },
  { key: "harga-rendah", label: "Harga terendah" },
  { key: "harga-tinggi", label: "Harga tertinggi" },
  { key: "rating", label: "Rating tertinggi" },
];

const STOCK_OPTIONS: { key: StockFilter; label: string }[] = [
  { key: "semua", label: "Semua stok" },
  { key: "tersedia", label: "Stok tersedia" },
];

function FoodCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white">
      <Skeleton className="aspect-[4/3] w-full rounded-none bg-muted" />
      <div className="space-y-2.5 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full rounded-full" />
      </div>
    </div>
  );
}

/** Chip filter yang bisa dilepas satu per satu. */
function ActiveChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-accent px-3 py-1 font-sans text-[11px] font-semibold text-primary transition-colors hover:border-primary/60",
        FOCUS_RING,
      )}
    >
      {label}
      <X className="h-3 w-3" aria-hidden />
    </button>
  );
}

export default function MakananCatalogPage() {
  const { foodItems, loading } = useCatalog();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sort, setSort] = useState<FoodSortKey>("relevan");
  const [stock, setStock] = useState<StockFilter>("semua");
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [sheetOpen, setSheetOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  /**
   * Kata kunci awal dari beranda (`/makanan?q=...`).
   *
   * Dibaca lewat `window.location` di dalam effect, bukan `useSearchParams`:
   * hook itu menuntut Suspense boundary saat halaman di-prerender, sedangkan
   * yang dibutuhkan di sini hanya satu nilai awal pada mount.
   */
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("q");
    if (fromUrl) setQuery(fromUrl);
  }, []);

  const result = useMemo(
    () =>
      filterAndSortFoods(foodItems, {
        query,
        categoryId,
        sort,
        stock,
        maxPrice,
      }),
    [foodItems, query, categoryId, sort, stock, maxPrice],
  );

  // Setiap perubahan filter mengembalikan daftar ke halaman pertama; tanpa ini
  // "Muat lebih banyak" yang sudah ditekan akan menampilkan 24 item sekaligus
  // padahal hasil filter baru hanya 10.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, categoryId, sort, stock, maxPrice]);

  // Drawer filter mobile: kunci scroll latar dan tutup dengan Escape.
  useEffect(() => {
    if (!sheetOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [sheetOpen]);

  const offeredCategories = useMemo(
    () => availableFoodCategories(foodItems),
    [foodItems],
  );
  const categoryChoices = CATEGORIES.filter((category) =>
    offeredCategories.includes(category.id),
  );

  const activeFilterCount = countActiveFoodFilters({
    query,
    categoryId,
    sort,
    stock,
    maxPrice,
  });

  const resetAll = () => {
    setQuery("");
    setCategoryId(null);
    setSort("relevan");
    setStock("semua");
    setMaxPrice(null);
  };

  const visible = result.slice(0, visibleCount);
  const hasMore = result.length > visible.length;

  const openDetail = (id: string) => {
    router.push(`/detail/product?id=${encodeURIComponent(id)}`);
  };

  const filterPanel = (
    <div className="space-y-6">
      <div>
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Kategori
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryId(null)}
            aria-pressed={categoryId === null}
            className={cn(
              "rounded-full border px-3 py-1.5 font-sans text-xs font-semibold transition-colors",
              categoryId === null
                ? "border-primary bg-primary text-white"
                : "border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-primary",
              FOCUS_RING,
            )}
          >
            Semua
          </button>
          {categoryChoices.map((category) => {
            const active = categoryId === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(active ? null : category.id)}
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-3 py-1.5 font-sans text-xs font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-primary",
                  FOCUS_RING,
                )}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Harga maksimum
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[null, 10000, 15000, 25000].map((value) => {
            const active = maxPrice === value;
            return (
              <button
                key={String(value)}
                type="button"
                onClick={() => setMaxPrice(value)}
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-3 py-1.5 font-sans text-xs font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-primary",
                  FOCUS_RING,
                )}
              >
                {value === null ? "Tanpa batas" : `≤ ${formatRupiah(value)}`}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Ketersediaan
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STOCK_OPTIONS.map((option) => {
            const active = stock === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setStock(option.key)}
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-3 py-1.5 font-sans text-xs font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-primary",
                  FOCUS_RING,
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label
          htmlFor="food-sort"
          className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        >
          Urutkan
        </label>
        <select
          id="food-sort"
          value={sort}
          onChange={(event) => setSort(event.target.value as FoodSortKey)}
          className="mt-3 min-h-10 w-full rounded-xl border border-border bg-white px-3 font-sans text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={resetAll}
        className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-border bg-white font-sans text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
      >
        Reset semua filter
      </button>
    </div>
  );

  return (
    <BuyerShell>
      <main className="bg-background pb-20 lg:pb-12">
        <div className="bg-secondary">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
            <nav aria-label="Remah roti" className="flex items-center gap-1.5 font-sans text-[11px] text-muted-foreground">
              <Link href="/home" className="hover:text-primary">
                Beranda
              </Link>
              <ChevronRight className="h-3 w-3" aria-hidden />
              <span className="font-semibold text-foreground">Makanan</span>
            </nav>

            <h1 className="mt-3 font-sans text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Jelajahi Makanan
            </h1>
            <p className="mt-2 max-w-xl font-secondary text-sm leading-relaxed text-muted-foreground">
              Semua makanan surplus dari UMKM lokal dalam satu tempat. Cari,
              saring, lalu pesan sebelum stoknya habis.
            </p>
            <p className="mt-3 font-sans text-xs font-semibold text-primary" aria-live="polite">
              {loading
                ? "Memuat makanan…"
                : `${result.length} makanan ditemukan`}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nama makanan atau toko…"
                aria-label="Cari makanan atau toko"
                className="min-h-11 w-full rounded-full border border-border bg-white px-4 pr-11 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                  aria-label="Hapus kata kunci"
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className={cn(
                "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-white px-4 font-sans text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary lg:hidden",
                FOCUS_RING,
              )}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              Filter
              {activeFilterCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {activeFilterCount > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="font-sans text-[11px] font-semibold text-muted-foreground">
                Filter aktif:
              </span>
              {query.trim() && (
                <ActiveChip label={`"${query.trim()}"`} onRemove={() => setQuery("")} />
              )}
              {categoryId && (
                <ActiveChip
                  label={categoryLabel(categoryId) ?? categoryId}
                  onRemove={() => setCategoryId(null)}
                />
              )}
              {maxPrice != null && (
                <ActiveChip
                  label={`≤ ${formatRupiah(maxPrice)}`}
                  onRemove={() => setMaxPrice(null)}
                />
              )}
              {stock !== "semua" && (
                <ActiveChip label="Stok tersedia" onRemove={() => setStock("semua")} />
              )}
              {sort !== "relevan" && (
                <ActiveChip
                  label={SORT_OPTIONS.find((option) => option.key === sort)?.label ?? sort}
                  onRemove={() => setSort("relevan")}
                />
              )}
              <button
                type="button"
                onClick={resetAll}
                className="font-sans text-[11px] font-semibold text-primary underline-offset-2 hover:underline"
              >
                Reset
              </button>
            </div>
          )}

          <div className="mt-6 flex gap-8">
            {/* Panel filter desktop. Di mobile diganti drawer agar kolom
                konten tidak menyempit sampai kartu tidak terbaca. */}
            <aside className="hidden w-64 shrink-0 lg:block">
              <div className="sticky top-24 rounded-2xl border border-border bg-white p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-primary" aria-hidden />
                  <p className="font-sans text-sm font-bold text-foreground">Filter</p>
                </div>
                {filterPanel}
              </div>
            </aside>

            <div className="min-w-0 flex-1">
              {loading ? (
                <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <FoodCardSkeleton key={index} />
                  ))}
                </div>
              ) : result.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-white px-6 py-16 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    {foodItems.length === 0 ? (
                      <PackageOpen className="h-7 w-7" aria-hidden />
                    ) : (
                      <SearchX className="h-7 w-7" aria-hidden />
                    )}
                  </span>
                  <p className="mt-4 font-sans text-sm font-bold text-foreground">
                    {foodItems.length === 0
                      ? "Belum ada makanan tersedia"
                      : "Tidak ada makanan yang cocok"}
                  </p>
                  <p className="mt-1 max-w-sm font-secondary text-xs leading-relaxed text-muted-foreground">
                    {foodItems.length === 0
                      ? "Menu surplus akan muncul di sini begitu penjual menambahkannya."
                      : "Coba ubah kata kunci atau longgarkan filter yang aktif."}
                  </p>
                  {foodItems.length > 0 && (
                    <button
                      type="button"
                      onClick={resetAll}
                      className="mt-6 inline-flex min-h-10 items-center rounded-full bg-primary px-6 font-sans text-sm font-semibold text-white hover:bg-primary-dark"
                    >
                      Reset filter
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {visible.map((item) => (
                      <FoodCard
                        key={item.id}
                        item={item}
                        onViewDetail={openDetail}
                      />
                    ))}
                  </div>

                  {hasMore && (
                    <div className="mt-8 flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                        className={cn(
                          "inline-flex min-h-11 items-center rounded-full border border-primary/40 px-6 font-sans text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white",
                          FOCUS_RING,
                        )}
                      >
                        Muat lebih banyak
                      </button>
                      <p className="font-sans text-[11px] text-muted-foreground">
                        Menampilkan {visible.length} dari {result.length} makanan
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <SiteFooter hasMobileBottomNav />
      </main>

      {/* Drawer filter mobile */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setSheetOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filter makanan"
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="font-sans text-base font-bold text-foreground">Filter makanan</p>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Tutup filter"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {filterPanel}
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary font-sans text-sm font-semibold text-white"
            >
              Tampilkan {result.length} makanan
            </button>
          </div>
        </div>
      )}
    </BuyerShell>
  );
}
