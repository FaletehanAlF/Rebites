"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Filter, MapPin, Search, SearchX, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LOCATIONS, formatRupiah } from "@/lib/data";
import { useCatalog } from "@/lib/catalog";
import { SmartImage } from "@/app/components/shared/SmartImage";
import type { FilterKey, FoodItem } from "@/lib/types";

interface SearchFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSearchSubmit: () => void;
  activeFilter?: FilterKey;
  onFilterChange?: (key: FilterKey) => void;
  showLocation?: boolean;
  showInlineResults?: boolean;
  onSelectResult?: (id: string) => void;
  placeholder?: string;
  variant?: "default" | "glass" | "light";
  /** Optional override for the searchable pool (defaults to the catalog). */
  items?: FoodItem[];
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const GLASS_FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: "terdekat", label: "Terdekat" },
  { key: "diskon-terbesar", label: "Diskon Terbesar" },
  { key: "segera-habis", label: "Segera Habis" },
  { key: "umkm", label: "UMKM" },
  { key: "bakery", label: "Bakery" },
  { key: "restoran", label: "Restoran" },
  { key: "minuman", label: "Minuman" },
];

function applySort(key: FilterKey) {
  return (a: FoodItem, b: FoodItem) => {
    switch (key) {
      case "terdekat":
        return a.distanceKm - b.distanceKm;
      case "diskon-terbesar":
        return b.discountPercent - a.discountPercent;
      case "segera-habis":
        return (
          (a.expiresAt
            ? new Date(a.expiresAt).getTime()
            : Number.MAX_SAFE_INTEGER) -
          (b.expiresAt
            ? new Date(b.expiresAt).getTime()
            : Number.MAX_SAFE_INTEGER)
        );
      default:
        return 0;
    }
  };
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;

  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-muted px-0.5 font-semibold text-primary">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export function SearchFilterBar({
  query,
  onQueryChange,
  onSearchSubmit,
  activeFilter = "terdekat",
  onFilterChange,
  showLocation = true,
  showInlineResults = false,
  onSelectResult,
  placeholder = "Cari makanan surplus di sekitarmu...",
  variant = "default",
  items: itemsOverride,
}: SearchFilterBarProps) {
  const isGlass = variant === "glass";
  const isLight = variant === "light";
  const [locationOpen, setLocationOpen] = useState(false);
  const [location, setLocation] = useState(LOCATIONS[0]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { foodItems } = useCatalog();
  const searchPool = itemsOverride ?? foodItems;

  const trimmedQuery = query.trim();

  const results = useMemo(() => {
    if (!showInlineResults || !trimmedQuery) return [];

    const q = trimmedQuery.toLowerCase();
    let matches = searchPool.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.vendorName.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q),
    );

    const categoryFilters: FilterKey[] = [
      "umkm",
      "bakery",
      "restoran",
      "minuman",
    ];
    if (categoryFilters.includes(activeFilter)) {
      matches = matches.filter((item) => item.category === activeFilter);
    } else if (activeFilter === "segera-habis") {
      matches = matches.filter((item) => item.expiresAt);
    }

    return [...matches].sort(applySort(activeFilter));
  }, [showInlineResults, trimmedQuery, activeFilter, searchPool]);

  const dropdownVisible =
    showInlineResults && isDropdownOpen && trimmedQuery.length > 0;

  useEffect(() => {
    if (!dropdownVisible) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDropdownOpen(false);
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [dropdownVisible]);

  useEffect(() => {
    if (!dropdownVisible) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [dropdownVisible]);

  const handleQueryChange = (value: string) => {
    onQueryChange(value);
    setIsDropdownOpen(value.trim().length > 0);
  };

  const handleClear = () => {
    onQueryChange("");
    setIsDropdownOpen(false);
    inputRef.current?.focus();
  };

  const handleSelectResult = (id: string) => {
    setIsDropdownOpen(false);
    onSelectResult?.(id);
  };

  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [draftFilter, setDraftFilter] = useState<FilterKey>(activeFilter);

  const handleApplyFilter = () => {
    onFilterChange?.(draftFilter);
    setFilterSheetOpen(false);
  };

  return (
    <div
      className={cn(
        "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8",
        isGlass && "relative z-30",
      )}
    >
      <div
        className={cn(
          isGlass
            ? "rounded-[28px] border border-white/25 bg-white/15 p-2 shadow-lg shadow-black/10 backdrop-blur-md sm:rounded-full"
            : isLight
              ? "rounded-[28px] border border-border bg-white p-2 shadow-md shadow-primary/5 sm:rounded-full"
              : "rounded-2xl border border-border bg-white p-2.5 shadow-md shadow-primary/5 sm:p-3",
        )}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (showInlineResults && trimmedQuery) setIsDropdownOpen(true);
            onSearchSubmit();
          }}
          className="flex flex-col gap-2.5 sm:flex-row sm:items-center"
        >
          <div className="relative flex-1">
            <div
              className={cn(
                "flex w-full items-center gap-3 rounded-full px-4 py-2.5",
                !isGlass && !isLight && "bg-secondary",
              )}
            >
              <Search
                className={cn(
                  "h-5 w-5 shrink-0",
                  isGlass ? "text-white/80" : "text-muted-foreground",
                )}
              />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onFocus={() => {
                  if (trimmedQuery) setIsDropdownOpen(true);
                }}
                placeholder={placeholder}
                aria-label={placeholder}
                aria-expanded={dropdownVisible}
                role="combobox"
                aria-controls="search-inline-results"
                className={cn(
                  "w-full bg-transparent font-sans text-sm focus:outline-none",
                  isGlass
                    ? "text-white placeholder:text-white/60"
                    : "text-foreground placeholder:text-muted-foreground/70",
                  (showInlineResults || isLight) &&
                  "[&::-webkit-search-cancel-button]:hidden",
                )}
              />

              {trimmedQuery && (
                <button
                  type="button"
                  aria-label="Hapus pencarian"
                  onClick={handleClear}
                  className={cn(
                    "-ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-150",
                    isGlass
                      ? "text-white/70 hover:bg-white/15 hover:text-white"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <AnimatePresence>
              {dropdownVisible && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40"
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  <motion.div
                    id="search-inline-results"
                    role="listbox"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(340px,60vh)] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-white p-1.5 shadow-xl [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-primary/40 [&::-webkit-scrollbar-track]:bg-transparent"
                  >
                    {results.length > 0 ? (
                      results.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          role="option"
                          aria-selected={false}
                          onClick={() => handleSelectResult(item.id)}
                          className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-150 hover:bg-secondary"
                        >
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
                            <SmartImage
                              src={item.image}
                              alt={`Foto ${item.name}`}
                              sizes="48px"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate font-sans text-sm font-semibold text-foreground">
                              <HighlightedText
                                text={item.name}
                                query={trimmedQuery}
                              />
                            </p>
                            <p className="mt-0.5 truncate font-secondary text-xs text-muted-foreground">
                              <HighlightedText
                                text={item.vendorName}
                                query={trimmedQuery}
                              />
                            </p>
                            <p className="mt-0.5 truncate font-secondary text-[11px] text-muted-foreground">
                              {item.stockLabel} · {item.distanceKm} km
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="font-sans text-sm font-bold text-primary">
                              {formatRupiah(item.discountedPrice)}
                            </p>
                            <p className="font-secondary text-xs text-muted-foreground line-through">
                              {formatRupiah(item.originalPrice)}
                            </p>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
                        <SearchX
                          className="h-7 w-7 text-muted-foreground-400"
                          strokeWidth={1.5}
                        />
                        <p className="mt-1 font-sans text-sm font-semibold text-foreground">
                          Makanan tidak ditemukan
                        </p>
                        <p className="font-secondary text-xs text-muted-foreground">
                          Coba kata kunci lain.
                        </p>
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {showLocation && (
            <div className="relative hidden sm:block">
            <button
              type="button"
              aria-label="Pilih lokasi"
              aria-expanded={locationOpen}
              onClick={() => setLocationOpen((v) => !v)}
              className={cn(
                "flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors duration-200",
                isGlass
                  ? "border-white/30 bg-white/10 text-white hover:border-white/60 hover:text-white"
                  : "border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-primary",
                isGlass ? GLASS_FOCUS_RING : FOCUS_RING,
              )}
            >
              <MapPin className="h-4 w-4 text-primary" />
              <span className="max-w-[130px] truncate">{location}</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  locationOpen && "rotate-180",
                )}
              />
            </button>

            <AnimatePresence>
              {locationOpen && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40"
                    onClick={() => setLocationOpen(false)}
                  />
                  <motion.ul
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }}
                    className="absolute left-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-white p-1.5 shadow-xl"
                  >
                    {LOCATIONS.map((loc) => (
                      <li key={loc}>
                        <button
                          type="button"
                          onClick={() => {
                            setLocation(loc);
                            setLocationOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150",
                            loc === location
                              ? "bg-muted font-semibold text-primary"
                              : "text-muted-foreground hover:bg-secondary hover:text-primary",
                          )}
                        >
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          {loc}
                        </button>
                      </li>
                    ))}
                  </motion.ul>
                </>
              )}
            </AnimatePresence>
          </div>
          )}

          {!isGlass && !isLight && (
            <div className="flex items-center gap-2">
              {/* Mobile filter button */}
              <button
                type="button"
                onClick={() => {
                  setDraftFilter(activeFilter);
                  setFilterSheetOpen(true);
                }}
                aria-label="Buka filter"
                className={cn(
                  "flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-white px-3 font-sans text-sm font-semibold text-foreground shadow-sm transition-colors duration-200 active:scale-[0.98] lg:hidden",
                  FOCUS_RING,
                )}
              >
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">Filter</span>
              </button>

              <button
                type="submit"
                className={cn(
                  "flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-5 font-sans text-sm font-semibold text-white shadow-md transition-colors duration-200 active:scale-[0.98] sm:px-7",
                  "bg-primary hover:bg-primary-dark",
                  FOCUS_RING,
                )}
              >
                <Search className="h-4 w-4" />
                Cari
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Mobile filter bottom sheet */}
      <AnimatePresence>
        {filterSheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[55] bg-primary/40 backdrop-blur-sm"
              onClick={() => setFilterSheetOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-x-0 bottom-0 z-[60] max-h-[80vh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />
              <div className="flex items-center justify-between">
                <h3 className="font-sans text-lg font-bold text-foreground">Filter</h3>
                <button
                  type="button"
                  onClick={() => setFilterSheetOpen(false)}
                  aria-label="Tutup filter"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4">
                <p className="font-sans text-xs font-semibold uppercase tracking-wider text-muted-foreground">Urutkan</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {FILTER_OPTIONS.map((opt) => {
                    const active = draftFilter === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setDraftFilter(opt.key)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-xs font-semibold transition-colors",
                          active
                            ? "border-primary bg-primary text-white"
                            : "border-border bg-white text-foreground hover:border-primary hover:bg-primary-dark/20",
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDraftFilter("terdekat");
                  }}
                  className="flex-1 rounded-full border border-border bg-white px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleApplyFilter}
                  className="flex-1 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-primary/25 transition-colors hover:bg-primary-dark"
                >
                  Terapkan
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
