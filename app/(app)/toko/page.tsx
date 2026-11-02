"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight,
  MapPin,
  SearchX,
  SlidersHorizontal,
  Store,
  X,
} from "lucide-react";
import { useCatalog } from "@/lib/catalog";
import { BuyerShell } from "@/app/components/shared/buyer-shell";
import { SiteFooter } from "@/app/components/site-footer";
import { VendorCard } from "@/app/components/home/VendorCard";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useSellerPlan } from "@/lib/seller-plan";
import { SELLER_VENDOR_SLUG } from "@/lib/product-storage";
import { cn } from "@/lib/utils";
import {
  availableVendorCities,
  countActiveVendorFilters,
  filterAndSortVendors,
  type VendorOpenFilter,
  type VendorSortKey,
} from "@/lib/catalog-filters";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const SORT_OPTIONS: { key: VendorSortKey; label: string }[] = [
  { key: "relevan", label: "Paling relevan" },
  { key: "rating", label: "Rating tertinggi" },
  { key: "jarak", label: "Terdekat" },
  { key: "nama", label: "Nama A–Z" },
];

const OPEN_OPTIONS: { key: VendorOpenFilter; label: string }[] = [
  { key: "semua", label: "Semua toko" },
  { key: "buka", label: "Sedang buka" },
];

export default function TokoPage() {
  const { vendors, loading } = useCatalog();
  const { plan } = useSellerPlan();

  const [query, setQuery] = useState("");
  const [location, setLocation] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState<VendorOpenFilter>("semua");
  const [sort, setSort] = useState<VendorSortKey>("relevan");
  const [panelOpen, setPanelOpen] = useState(false);

  const cities = useMemo(() => availableVendorCities(vendors), [vendors]);

  const result = useMemo(() => {
    const filtered = filterAndSortVendors(vendors, {
      query,
      location,
      openOnly,
      sort,
    });
    // Paket penjual dengan "prioritas listing" tetap dipromosikan ke depan,
    // sama seperti perilaku halaman ini sebelumnya — hanya setelah filter
    // diterapkan, supaya filter tidak bisa "dilewati" oleh pengurutan.
    if (!plan.priorityListing) return filtered;
    return [...filtered].sort(
      (a, b) =>
        Number(b.id === SELLER_VENDOR_SLUG) - Number(a.id === SELLER_VENDOR_SLUG),
    );
  }, [vendors, query, location, openOnly, sort, plan.priorityListing]);

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanelOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  const activeCount = countActiveVendorFilters({ query, location, openOnly, sort });

  const resetAll = () => {
    setQuery("");
    setLocation(null);
    setOpenOnly("semua");
    setSort("relevan");
  };

  const filterPanel = (
    <div className="space-y-6">
      <div>
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Lokasi
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setLocation(null)}
            aria-pressed={location === null}
            className={cn(
              "rounded-full border px-3 py-1.5 font-sans text-xs font-semibold transition-colors",
              location === null
                ? "border-primary bg-primary text-white"
                : "border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-primary",
              FOCUS_RING,
            )}
          >
            Semua lokasi
          </button>
          {cities.map((city) => {
            const active = location === city;
            return (
              <button
                key={city}
                type="button"
                onClick={() => setLocation(active ? null : city)}
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-3 py-1.5 font-sans text-xs font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-primary",
                  FOCUS_RING,
                )}
              >
                {city}
              </button>
            );
          })}
          {cities.length === 0 && (
            <p className="font-sans text-[11px] text-muted-foreground">
              Data lokasi belum tersedia.
            </p>
          )}
        </div>
      </div>

      <div>
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Status toko
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {OPEN_OPTIONS.map((option) => {
            const active = openOnly === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setOpenOnly(option.key)}
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
          htmlFor="vendor-sort"
          className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
        >
          Urutkan
        </label>
        <select
          id="vendor-sort"
          value={sort}
          onChange={(event) => setSort(event.target.value as VendorSortKey)}
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
            <nav
              aria-label="Remah roti"
              className="flex items-center gap-1.5 font-sans text-[11px] text-muted-foreground"
            >
              <Link href="/home" className="hover:text-primary">
                Beranda
              </Link>
              <ChevronRight className="h-3 w-3" aria-hidden />
              <span className="font-semibold text-foreground">UMKM</span>
            </nav>

            <h1 className="mt-3 font-sans text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Jelajahi UMKM
            </h1>
            <p className="mt-2 max-w-xl font-secondary text-sm leading-relaxed text-muted-foreground">
              Kenali toko-toko lokal yang rutin menyelamatkan makanan surplusnya.
              Dukung usaha di sekitarmu.
            </p>
            <p className="mt-3 font-sans text-xs font-semibold text-primary" aria-live="polite">
              {loading ? "Memuat toko…" : `${result.length} toko ditemukan`}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nama toko…"
                aria-label="Cari nama toko"
                className="min-h-11 w-full rounded-full border border-border bg-white px-4 pr-11 font-sans text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Hapus kata kunci"
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className={cn(
                "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-border bg-white px-4 font-sans text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary lg:hidden",
                FOCUS_RING,
              )}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              Filter
              {activeCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                  {activeCount}
                </span>
              )}
            </button>
          </div>

          {activeCount > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="font-sans text-[11px] font-semibold text-muted-foreground">
                Filter aktif:
              </span>
              {query.trim() && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-accent px-3 py-1 font-sans text-[11px] font-semibold text-primary"
                >
                  &quot;{query.trim()}&quot;
                  <X className="h-3 w-3" aria-hidden />
                </button>
              )}
              {location && (
                <button
                  type="button"
                  onClick={() => setLocation(null)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-accent px-3 py-1 font-sans text-[11px] font-semibold text-primary"
                >
                  <MapPin className="h-3 w-3" aria-hidden />
                  {location}
                  <X className="h-3 w-3" aria-hidden />
                </button>
              )}
              {openOnly !== "semua" && (
                <button
                  type="button"
                  onClick={() => setOpenOnly("semua")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-accent px-3 py-1 font-sans text-[11px] font-semibold text-primary"
                >
                  Sedang buka
                  <X className="h-3 w-3" aria-hidden />
                </button>
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
            <aside className="hidden w-64 shrink-0 lg:block">
              <div className="sticky top-24 rounded-2xl border border-border bg-white p-5">
                <p className="mb-4 font-sans text-sm font-bold text-foreground">Filter</p>
                {filterPanel}
              </div>
            </aside>

            <div className="min-w-0 flex-1">
              {loading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="overflow-hidden rounded-2xl border border-border bg-white">
                      <Skeleton className="aspect-[4/3] w-full rounded-none bg-muted" />
                      <div className="space-y-2 p-4">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                        <Skeleton className="h-9 w-full rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : result.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-white px-6 py-16 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    {vendors.length === 0 ? (
                      <Store className="h-6 w-6" aria-hidden />
                    ) : (
                      <SearchX className="h-6 w-6" aria-hidden />
                    )}
                  </span>
                  <p className="mt-4 font-sans text-sm font-bold text-foreground">
                    {vendors.length === 0
                      ? "Belum ada toko tersedia"
                      : "Tidak ada toko yang cocok"}
                  </p>
                  <p className="mt-1 max-w-xs font-secondary text-xs text-muted-foreground">
                    {vendors.length === 0
                      ? "Toko UMKM akan muncul di sini setelah terdaftar."
                      : "Coba ubah kata kunci atau longgarkan filter."}
                  </p>
                  {vendors.length > 0 && (
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
                  {result.map((vendor) => (
                    <VendorCard
                      key={vendor.id}
                      vendor={vendor}
                      badgeLabel={
                        plan.priorityListing && vendor.id === SELLER_VENDOR_SLUG
                          ? "Prioritas"
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <SiteFooter hasMobileBottomNav />
      </main>

      {panelOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setPanelOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filter UMKM"
            className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="font-sans text-base font-bold text-foreground">Filter UMKM</p>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                aria-label="Tutup filter"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {filterPanel}
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary font-sans text-sm font-semibold text-white"
            >
              Tampilkan {result.length} toko
            </button>
          </div>
        </div>
      )}
    </BuyerShell>
  );
}
