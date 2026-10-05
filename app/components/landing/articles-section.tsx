'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { Reveal } from '@/app/components/reveal';
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

/**
 * Section "Artikel Terbaru" di landing page.
 * - Maksimal 3 artikel published terbaru via public GET /api/articles.
 * - Tanpa login, tanpa service role, tanpa query DB langsung.
 * - Gagal/loading/kosong tidak merusak landing: error & empty
 *   menyembunyikan section, loading memakai skeleton ringan.
 */
export function ArticlesSection() {
  const [items, setItems] = useState<LandingArticle[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'hidden'>('loading');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/articles?limit=3&offset=0');
        if (!res.ok) {
          if (active) setState('hidden');
          return;
        }
        const json = (await res.json().catch(() => null)) as {
          articles?: LandingArticle[];
        } | null;
        const articles = Array.isArray(json?.articles) ? json!.articles!.slice(0, 3) : [];
        if (!active) return;
        if (articles.length === 0) {
          setState('hidden');
          return;
        }
        setItems(articles);
        setState('ready');
      } catch {
        if (active) setState('hidden');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (state === 'hidden') return null;

  return (
    <section
      id="artikel"
      data-nav="cream"
      aria-label="Artikel terbaru ReBites"
      className="grain-overlay relative scroll-mt-28 overflow-hidden bg-cream py-20 lg:scroll-mt-32 lg:py-28"
    >
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal delay={0.05}>
            <p className="font-sans text-[11px] font-bold uppercase tracking-[0.3em] text-primary">
              Wawasan
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3.1rem)] font-light leading-[1.08] tracking-[-0.02em] text-primary">
              Artikel <span className="italic text-caramel">Terbaru</span>
            </h2>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mt-4 font-sans text-sm leading-[1.85] text-muted-foreground">
              Cerita dan edukasi seputar food waste, makanan surplus, dan
              perjuangan UMKM bersama ReBites.
            </p>
          </Reveal>
        </div>

        {state === 'loading' ? (
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                aria-hidden
                className="h-80 animate-pulse rounded-[var(--radius)] bg-white shadow-[0_10px_30px_-24px_rgba(34,81,56,0.3)]"
              />
            ))}
          </div>
        ) : (
          <>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:mt-14 lg:grid-cols-3">
              {items.map((item, i) => (
                <Reveal key={item.id} delay={0.08 + i * 0.06}>
                  <Link
                    href={`/artikel/${item.slug ?? item.id}`}
                    className="group flex h-full flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-white shadow-[0_10px_30px_-24px_rgba(34,81,56,0.3)] transition-all duration-300 hover:-translate-y-1 hover:border-caramel/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-sage-100">
                      <SmartImage
                        src={item.cover_image ?? ''}
                        alt={item.title ? `Cover ${item.title}` : 'Cover artikel'}
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="transition-transform duration-500 group-hover:scale-105"
                      />
                      {item.category?.trim() && (
                        <span className="absolute left-3 top-3 rounded-full bg-charcoal-900/80 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                          {item.category.trim()}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="font-display text-lg font-medium leading-snug text-primary">
                        {item.title ?? '-'}
                      </h3>
                      {item.excerpt?.trim() && (
                        <p className="mt-2 line-clamp-2 font-sans text-sm leading-relaxed text-muted-foreground">
                          {item.excerpt.trim()}
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-between gap-2 pt-5">
                        <span className="inline-flex items-center gap-1.5 font-sans text-xs text-muted-foreground">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(item.published_at)}
                        </span>
                        <span className="inline-flex items-center gap-1 font-sans text-[13px] font-bold text-primary">
                          Baca Selengkapnya
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>

            <Reveal delay={0.1}>
              <div className="mt-10 text-center">
                <Link
                  href="/artikel"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 font-sans text-sm font-semibold text-white transition-colors hover:bg-caramel"
                >
                  Lihat Semua Artikel
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>
          </>
        )}
      </div>
    </section>
  );
}
