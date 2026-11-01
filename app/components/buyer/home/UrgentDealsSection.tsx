"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useCatalog } from "@/lib/catalog";
import { FoodCard } from "@/app/components/shared/FoodCard";
import { SearchFilterBar } from "@/app/components/shared/SearchFilterBar";
import { cn } from "@/lib/utils";
import type { FilterKey } from "@/lib/types";

const MAX_ITEMS = 8;

function hashStringToInt(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getDailySeed(): number {
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return hashStringToInt(dateStr);
}

function getDailyOffset(seed: number, length: number, pageSize: number): number {
  if (length <= pageSize) return 0;
  const maxStart = length - pageSize;
  return seed % (maxStart + 1);
}

/**
 * Grid rekomendasi harian.
 *
 * Sebelumnya berupa rail geser mendatar dengan tombol panah dan animasi
 * masuk per kartu. Grid biasa menampilkan lebih banyak menu sekaligus di
 * layar sempit tanpa perlu geser, dan tidak lagi memasang animasi yang
 * harus dihitung ulang setiap kali daftar berubah.
 */
export function UrgentDealsSection({
  onViewDetail,
}: {
  onViewDetail?: (id: string) => void;
  from?: "landing" | "home";
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState<FilterKey>("terdekat");
  const { foodItems, loading } = useCatalog();

  const items = useMemo(() => {
    const sorted = [...foodItems].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    const dailySeed = getDailySeed();
    const offset = getDailyOffset(dailySeed, sorted.length, MAX_ITEMS);
    return sorted.slice(offset, offset + MAX_ITEMS);
  }, [foodItems]);

  return (
    <section
      id="rekomendasi"
      data-nav="green"
      className="relative flex min-h-screen scroll-mt-20 flex-col justify-center overflow-hidden bg-primary py-10 sm:py-16 lg:py-20"
    >
      <div className="relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sale" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sale" />
              </span>
              <span className="font-sans text-xs font-bold uppercase tracking-[0.3em] text-white/90">
                Rekomendasi Untukmu
              </span>
            </div>

            <h2 className="mt-3 font-sans text-[22px] font-semibold tracking-tight text-white sm:text-[28px]">
              Menu <span className="text-white">unggulan</span> hari ini
            </h2>
            <p className="mt-2 max-w-xl font-sans text-sm text-white/70">
              Pilihan makanan surplus dengan rating terbaik dari UMKM terdekat.
            </p>
          </div>
        </div>

        <div className="mt-5 sm:mt-6">
          <SearchFilterBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSearchSubmit={() => undefined}
            activeFilter={searchFilter}
            onFilterChange={setSearchFilter}
            showLocation={false}
            showInlineResults
            onSelectResult={onViewDetail}
          />
        </div>

        {loading && (
          <div className="mt-8 flex h-40 items-center justify-center text-sm text-muted-foreground">
            Memuat menu...
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
            <p className="font-sans text-sm font-semibold text-foreground">
              Belum ada menu tersedia
            </p>
            <p className="mt-1 font-sans text-xs text-muted-foreground">
              Menu surplus akan muncul di sini begitu penjual menambahkannya.
            </p>
          </div>
        )}

        {!loading && items.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <FoodCard key={item.id} item={item} onViewDetail={onViewDetail} />
            ))}
          </div>
        )}

        {/* Beranda hanya menampilkan sekumpulan rekomendasi; katalog lengkap
            berada di /makanan. Tombol ini selalu tampil (desktop & mobile). */}
        <div className="mt-8 flex justify-center">
          <Link
            href="/makanan"
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-6 font-sans text-sm font-semibold text-white transition-colors hover:bg-primary-dark",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            Lihat Semua Makanan
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
