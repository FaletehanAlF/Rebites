"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Newspaper, Search } from "lucide-react";
import { BuyerShell } from "@/app/components/shared/buyer-shell";
import { SmartImage } from "@/app/components/shared/SmartImage";

interface PublicArticle {
  id: string;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  cover_image: string | null;
  category: string | null;
  tags: string[] | null;
  published_at: string | null;
  created_at: string | null;
}

const PAGE_LIMIT = 9;
const SEARCH_DEBOUNCE_MS = 400;

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export default function ArtikelPage() {
  const [items, setItems] = useState<PublicArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  // Kategori hanya dari data API yang benar-benar diterima (tanpa asumsi).
  const [knownCategories, setKnownCategories] = useState<string[]>([]);

  const load = useCallback(
    async (nextOffset: number, nextSearch: string, nextCategory: string) => {
      setStatus("loading");
      setErrorMsg("");
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_LIMIT),
          offset: String(nextOffset),
        });
        if (nextSearch.trim()) params.set("search", nextSearch.trim());
        if (nextCategory) params.set("category", nextCategory);
        // Public API: tanpa login, tanpa session, tanpa service role.
        const res = await fetch(`/api/articles?${params.toString()}`);
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(json?.error ?? "Gagal memuat artikel.");
        }
        const json = (await res.json().catch(() => null)) as {
          articles?: PublicArticle[];
          total?: number;
          offset?: number;
        } | null;
        if (!json || !Array.isArray(json.articles)) {
          throw new Error("Respons artikel tidak valid.");
        }
        setItems(json.articles);
        setTotal(json.total ?? json.articles.length);
        setOffset(json.offset ?? nextOffset);
        setKnownCategories((prev) => {
          const seen = new Set(prev);
          for (const a of json.articles ?? []) {
            const c = typeof a.category === "string" ? a.category.trim() : "";
            if (c) seen.add(c);
          }
          return Array.from(seen).sort((x, y) => x.localeCompare(y, "id"));
        });
        setStatus("ready");
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Gagal memuat artikel.");
        setStatus("error");
      }
    },
    []
  );

  useEffect(() => {
    setKnownCategories([]);
    load(0, search, category);
  }, [search, category, load]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch((prev) => (prev === searchInput.trim() ? prev : searchInput.trim()));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE_LIMIT, total);
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_LIMIT < total;

  return (
    <BuyerShell>
      <main className="min-h-screen bg-cream-50 pb-28 pt-4 sm:pt-6 lg:pb-12 lg:pt-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-caramel">
            Edukasi & Cerita
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            Artikel ReBites
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-stone">
            Cerita dan edukasi seputar food waste, makanan surplus, dan perjuangan
            UMKM bersama ReBites menyelamatkan makanan lezat agar tidak terbuang.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-border/70 bg-white px-3 py-2 focus-within:border-primary">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setSearch(searchInput.trim());
                }}
                placeholder="Cari artikel..."
                aria-label="Cari artikel"
                className="w-full bg-transparent py-1 text-sm text-charcoal-900 outline-none placeholder:text-muted-foreground"
              />
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter kategori artikel"
              className="appearance-none rounded-xl border border-border/70 bg-white px-3 py-2.5 text-sm font-medium text-charcoal-900 outline-none focus:border-primary"
            >
              <option value="">Semua kategori</option>
              {knownCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {status === "loading" && (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  aria-hidden
                  className="h-80 animate-pulse rounded-2xl bg-white shadow-sm"
                />
              ))}
            </div>
          )}

          {status === "error" && (
            <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-sage-200 bg-white px-6 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sage-100 text-sage-500">
                <Newspaper className="h-6 w-6" />
              </span>
              <p className="mt-4 font-sans text-sm font-bold text-charcoal-900">
                Gagal memuat artikel
              </p>
              <p className="mt-1 max-w-xs font-inter text-xs text-stone">{errorMsg}</p>
              <button
                type="button"
                onClick={() => load(offset, search, category)}
                className="mt-4 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
              >
                Coba lagi
              </button>
            </div>
          )}

          {status === "ready" && items.length === 0 && (
            <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-sage-200 bg-white px-6 py-16 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-sage-100 text-sage-500">
                <Newspaper className="h-6 w-6" />
              </span>
              <p className="mt-4 font-sans text-sm font-bold text-charcoal-900">
                {search || category ? "Artikel tidak ditemukan" : "Belum ada artikel"}
              </p>
              <p className="mt-1 max-w-xs font-inter text-xs text-stone">
                {search || category
                  ? "Coba kata kunci atau kategori lain."
                  : "Artikel yang sudah dipublish akan muncul di sini."}
              </p>
            </div>
          )}

          {status === "ready" && items.length > 0 && (
            <>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                {items.map((item) => (
                  <Link
                    key={item.id}
                    href={`/artikel/${item.slug ?? item.id}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50"
                  >
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-sage-100">
                      <SmartImage
                        src={item.cover_image ?? ""}
                        alt={item.title ? `Cover ${item.title}` : "Cover artikel"}
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="transition-transform duration-500 group-hover:scale-105"
                      />
                      {item.category?.trim() && (
                        <span className="absolute left-3 top-3 rounded-full bg-charcoal-900/80 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                          {item.category.trim()}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-4 sm:p-5">
                      <h2 className="font-display text-base font-semibold leading-snug text-charcoal-900 group-hover:text-primary sm:text-lg">
                        {item.title ?? "-"}
                      </h2>
                      {item.excerpt?.trim() && (
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-stone">
                          {item.excerpt.trim()}
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-stone">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(item.published_at)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[13px] font-bold text-primary">
                          Baca Selengkapnya
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="mt-8 flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-xs text-stone">
                  Menampilkan {showingFrom}–{showingTo} dari {total} artikel
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!hasPrev}
                    onClick={() => load(Math.max(0, offset - PAGE_LIMIT), search, category)}
                    className="rounded-full border border-border/70 bg-white px-4 py-2 text-sm font-semibold text-charcoal-900 transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Sebelumnya
                  </button>
                  <button
                    type="button"
                    disabled={!hasNext}
                    onClick={() => load(offset + PAGE_LIMIT, search, category)}
                    className="rounded-full border border-border/70 bg-white px-4 py-2 text-sm font-semibold text-charcoal-900 transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </BuyerShell>
  );
}
