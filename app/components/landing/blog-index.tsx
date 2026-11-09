'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Newspaper, Search } from 'lucide-react';
import { Reveal } from '@/app/components/shared/reveal';
import { SmartImage } from '@/app/components/shared/SmartImage';

interface LandingArticle {
  id: string;
  title: string | null;
  slug: string | null;
  excerpt: string | null;
  cover_image: string | null;
  category: string | null;
  published_at: string | null;
}

const PAGE_LIMIT = 7;
const SEARCH_DEBOUNCE_MS = 400;

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

// Indeks blog publik /blog; data dari GET /api/articles (tanpa login).
export function BlogIndex() {
  const [items, setItems] = useState<LandingArticle[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [knownCategories, setKnownCategories] = useState<string[]>([]);

  const load = useCallback(
    async (
      nextOffset: number,
      nextSearch: string,
      nextCategory: string,
      append: boolean
    ) => {
      if (append) setLoadingMore(true);
      else {
        setStatus('loading');
        setErrorMsg('');
      }
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_LIMIT),
          offset: String(nextOffset),
        });
        if (nextSearch.trim()) params.set('search', nextSearch.trim());
        if (nextCategory) params.set('category', nextCategory);

        const res = await fetch(`/api/articles?${params.toString()}`);
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(json?.error ?? 'Gagal memuat artikel.');
        }
        const json = (await res.json().catch(() => null)) as {
          articles?: LandingArticle[];
          total?: number;
        } | null;
        if (!json || !Array.isArray(json.articles)) {
          throw new Error('Respons artikel tidak valid.');
        }
        const articles = json.articles;
        setItems((prev) => (append ? [...prev, ...articles] : articles));
        setTotal(json.total ?? articles.length);
        setKnownCategories((prev) => {
          const seen = new Set(prev);
          for (const a of articles) {
            const c = typeof a.category === 'string' ? a.category.trim() : '';
            if (c) seen.add(c);
          }
          return Array.from(seen).sort((x, y) => x.localeCompare(y, 'id'));
        });
        setStatus('ready');
      } catch (err) {
        if (!append) {
          setErrorMsg(
            err instanceof Error ? err.message : 'Gagal memuat artikel.'
          );
          setStatus('error');
        } else {
          setErrorMsg(
            err instanceof Error ? err.message : 'Gagal memuat artikel.'
          );
        }
      } finally {
        setLoadingMore(false);
      }
    },
    []
  );

  useEffect(() => {
    setKnownCategories([]);
    load(0, search, category, false);
  }, [search, category, load]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch((prev) =>
        prev === searchInput.trim() ? prev : searchInput.trim()
      );
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const isFiltering = Boolean(search.trim() || category);
  const featured = !isFiltering && items.length > 0 ? items[0] : null;
  const gridItems = featured ? items.slice(1) : items;
  const hasMore = items.length < total;

  return (
    <section
      aria-labelledby="blog-heading"
      className="grain-overlay bg-secondary"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <Reveal>
          <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
            Blog ReBites
          </p>
          <h1
            id="blog-heading"
            className="mt-4 max-w-3xl text-balance font-display text-[clamp(2rem,4.2vw,3.25rem)] font-semibold leading-[1.06] tracking-[-0.035em] text-primary"
          >
            Cerita & edukasi seputar{' '}
            <span className="font-light italic">makanan surplus</span>.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-[1.8] text-muted-foreground">
            Cerita dan edukasi seputar food waste, makanan surplus, dan
            perjuangan UMKM kuliner — dari dapur yang hampir terbuang ke meja
            makan.
          </p>
        </Reveal>

        {/* Kontrol: pencarian + filter kategori */}
        <Reveal delay={0.05}>
          <div className="mt-8 flex flex-col gap-4 sm:mt-10">
            <div className="flex max-w-md items-center gap-2 rounded-2xl border border-border bg-white px-4 py-2.5 transition-colors focus-within:border-primary">
              <Search
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setSearch(searchInput.trim());
                }}
                placeholder="Cari artikel..."
                aria-label="Cari artikel"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            {knownCategories.length > 0 && (
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Filter kategori artikel"
              >
                <button
                  type="button"
                  onClick={() => setCategory('')}
                  aria-pressed={category === ''}
                  className={`rounded-full border px-4 py-1.5 font-secondary text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    category === ''
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-primary'
                  }`}
                >
                  Semua
                </button>
                {knownCategories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory((prev) => (prev === c ? '' : c))}
                    aria-pressed={category === c}
                    className={`rounded-full border px-4 py-1.5 font-secondary text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      category === c
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-white text-muted-foreground hover:border-primary/40 hover:text-primary'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Reveal>

        {/* Loading */}
        {status === 'loading' && (
          <div className="mt-10 grid gap-5 sm:mt-12 lg:grid-cols-5">
            <div
              aria-hidden
              className="h-80 animate-pulse rounded-3xl bg-white lg:col-span-2 lg:h-96"
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:col-span-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  aria-hidden
                  className="h-44 animate-pulse rounded-3xl bg-white sm:h-48"
                />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div
            role="alert"
            className="mt-10 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-white px-6 py-16 text-center sm:mt-12"
          >
            <span
              aria-hidden
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15 bg-secondary text-primary"
            >
              <Newspaper className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <p className="mt-4 font-display text-base font-semibold text-primary">
              Gagal memuat artikel
            </p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {errorMsg}
            </p>
            <button
              type="button"
              onClick={() => load(0, search, category, false)}
              className="mt-5 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Coba lagi
            </button>
          </div>
        )}

        {/* Empty */}
        {status === 'ready' && items.length === 0 && (
          <div
            role="status"
            className="mt-10 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-white px-6 py-16 text-center sm:mt-12"
          >
            <span
              aria-hidden
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15 bg-secondary text-primary"
            >
              <Newspaper className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <p className="mt-4 font-display text-base font-semibold text-primary">
              {isFiltering ? 'Artikel tidak ditemukan' : 'Belum ada artikel'}
            </p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {isFiltering
                ? 'Coba kata kunci atau kategori lain.'
                : 'Artikel yang sudah dipublish akan muncul di sini.'}
            </p>
          </div>
        )}

        {/* Konten */}
        {status === 'ready' && items.length > 0 && (
          <>
            {featured && (
              <Reveal delay={0.08}>
                <Link
                  href={`/blog/${featured.slug ?? featured.id}`}
                  className="group mt-10 grid overflow-hidden rounded-3xl border border-border bg-white transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:mt-12 lg:grid-cols-2"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-sage-100 lg:aspect-auto lg:min-h-[340px]">
                    <SmartImage
                      src={featured.cover_image ?? ''}
                      alt={
                        featured.title
                          ? `Cover ${featured.title}`
                          : 'Cover artikel'
                      }
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      priority
                      className="transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    {featured.category?.trim() && (
                      <span className="absolute left-4 top-4 rounded-full bg-charcoal-900/80 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                        {featured.category.trim()}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col justify-center gap-4 p-6 sm:p-10">
                    <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/60">
                      Artikel terbaru
                    </p>
                    <h2 className="text-balance font-display text-2xl font-semibold leading-[1.15] tracking-[-0.02em] text-primary sm:text-[2rem]">
                      {featured.title ?? '-'}
                    </h2>
                    {featured.excerpt?.trim() && (
                      <p className="line-clamp-3 text-sm leading-[1.8] text-muted-foreground sm:text-base">
                        {featured.excerpt.trim()}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays className="h-4 w-4" aria-hidden />
                        {formatDate(featured.published_at)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                        Baca artikel
                        <ArrowRight
                          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </span>
                    </div>
                  </div>
                </Link>
              </Reveal>
            )}

            {gridItems.length > 0 && (
              <ul className="mt-5 grid list-none gap-5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                {gridItems.map((item) => (
                  <li key={item.id} className="h-full">
                    <Link
                      href={`/blog/${item.slug ?? item.id}`}
                      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-white transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                      <div className="relative aspect-[16/9] w-full overflow-hidden bg-sage-100">
                        <SmartImage
                          src={item.cover_image ?? ''}
                          alt={
                            item.title
                              ? `Cover ${item.title}`
                              : 'Cover artikel'
                          }
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="transition-transform duration-500 group-hover:scale-105"
                        />
                        {item.category?.trim() && (
                          <span className="absolute left-3 top-3 rounded-full bg-charcoal-900/80 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                            {item.category.trim()}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-5 sm:p-6">
                        <h2 className="font-display text-base font-semibold leading-snug text-primary sm:text-lg">
                          {item.title ?? '-'}
                        </h2>
                        {item.excerpt?.trim() && (
                          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                            {item.excerpt.trim()}
                          </p>
                        )}
                        <div className="mt-auto flex items-center justify-between gap-2 pt-5">
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                            {formatDate(item.published_at)}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[13px] font-bold text-primary">
                            Baca
                            <ArrowRight
                              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                              aria-hidden
                            />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {hasMore && (
              <div className="mt-10 text-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => load(items.length, search, category, true)}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-primary/20 bg-white px-6 text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {loadingMore ? 'Memuat...' : 'Muat artikel lainnya'}
                  {!loadingMore && <ArrowRight className="h-4 w-4" aria-hidden />}
                </button>
                {errorMsg && (
                  <p role="alert" className="mt-3 text-sm text-destructive">
                    {errorMsg}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
