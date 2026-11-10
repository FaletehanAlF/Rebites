'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Clock3 } from 'lucide-react';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { Skeleton } from '@/app/components/ui/skeleton';
import { estimateReadingTime, fetchPublishedArticles, formatDate, splitParagraphs, type BlogArticle, } from './blog-shared';

const PILL_CLASS = 'inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-rose-600';

type DetailState = 'loading' | 'ready' | 'notfound' | 'error';

export function BlogDetailView({ slug }: { slug: string }) {
    const [state, setState] = useState<DetailState>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [article, setArticle] = useState<BlogArticle | null>(null);
    const [related, setRelated] = useState<BlogArticle[]>([]);
    const [categories, setCategories] = useState<string[]>([]);

    const load = useCallback(async () => {
        setState('loading');
        setErrorMsg('');
        try {
            const res = await fetch(`/api/articles/${encodeURIComponent(slug)}`);
            if (res.status === 404) {
                setState('notfound');
                return;
            }
            if (!res.ok) {
                const json = (await res.json().catch(() => null)) as { error?: string } | null;
                throw new Error(json?.error ?? 'Gagal memuat artikel.');
            }
            const json = (await res.json()) as { article: BlogArticle };
            setArticle(json.article);

            const list = await fetchPublishedArticles({ offset: 0, limit: 50 });
            const sameCategory = list.items.filter((a) => a.slug !== slug && a.category && a.category === json.article.category);
            const others = list.items.filter((a) => a.slug !== slug && (!a.category || a.category !== json.article.category));
            setRelated([...sameCategory, ...others].slice(0, 4));
            const unique = Array.from(new Set(list.items.map((a) => (a.category ?? '').trim()).filter(Boolean)));
            unique.sort((a, b) => a.localeCompare(b, 'id'));
            setCategories(unique);
            setState('ready');
        }
        catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan.');
            setState('error');
        }
    }, [slug]);

    useEffect(() => {
        void load();
    }, [load]);

    const readingMinutes = article?.content
        ? Math.max(1, Math.round(estimateReadingTime(article.content) / 220))
        : 0;

    return (<section className="mx-auto w-full max-w-7xl px-5 pb-20 pt-28 sm:px-8 sm:pt-32">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-primary">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Kembali ke Blog
        </Link>

        {state === 'loading' && (<div className="mt-6 grid gap-6 lg:grid-cols-[210px_minmax(0,1fr)_280px] lg:items-start" aria-hidden>
            <Skeleton className="hidden h-48 rounded-2xl lg:block" />
            <div className="space-y-4">
                <Skeleton className="h-56 rounded-2xl" />
                <Skeleton className="h-8 w-3/4 rounded-xl" />
                <Skeleton className="h-40 rounded-2xl" />
            </div>
            <Skeleton className="hidden h-56 rounded-2xl lg:block" />
        </div>)}

        {state === 'notfound' && (<div className="mt-10 rounded-2xl border border-border/40 bg-white p-12 text-center shadow-sm">
            <h1 className="font-display text-xl font-bold text-foreground">Artikel tidak ditemukan</h1>
            <p className="mt-2 text-[13px] text-muted-foreground">Mungkin belum dipublikasikan atau tautannya salah.</p>
            <Link href="/blog" className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark">
                Ke daftar artikel
            </Link>
        </div>)}

        {state === 'error' && (<div className="mt-10 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-[14px] text-rose-700">
            {errorMsg || 'Gagal memuat artikel.'}
            <button type="button" onClick={() => void load()} className="ml-2 font-semibold underline underline-offset-4">Coba lagi</button>
        </div>)}

        {state === 'ready' && article && (<div className="mt-6 grid gap-10 lg:grid-cols-[210px_minmax(0,1fr)_280px] lg:items-start">
            <aside className="hidden rounded-2xl border border-border/40 bg-white p-6 shadow-sm lg:block">
                <h2 className="font-display text-lg font-bold tracking-tight text-foreground">Kategori</h2>
                <ul className="mt-5 space-y-2.5">
                    {['Semua', ...categories].map((option) => (<li key={option}>
                        <Link href={option === 'Semua' ? '/blog' : `/blog?kategori=${encodeURIComponent(option)}`}
                            className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-rose-600">
                            {option}
                        </Link>
                    </li>))}
                </ul>
            </aside>

            <article className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                    {article.category && (<span className={PILL_CLASS}>{article.category}</span>)}
                    <span className="inline-flex items-center gap-1.5 font-sans text-[11px] uppercase tracking-[0.14em] text-rose-500">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                        {formatDate(article.published_at ?? article.created_at)}
                    </span>
                    {readingMinutes > 0 && (<span className="inline-flex items-center gap-1.5 text-[11px] font-sans uppercase tracking-[0.14em] text-rose-500">
                        <Clock3 className="h-3.5 w-3.5" aria-hidden />
                        {readingMinutes} menit baca
                    </span>)}
                </div>

                <h1 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                    {article.title ?? 'Tanpa judul'}
                </h1>

                <div className="mt-5 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-border/40 bg-muted">
                    {article.cover_image && (<SmartImage src={article.cover_image} alt={article.title ?? 'Cover artikel'}
                        sizes="(min-width: 1024px) 48rem, 100vw" priority className="h-full w-full object-cover" />)}
                </div>

                {article.excerpt && (<p className="mt-6 border-l-4 border-primary/70 pl-4 font-sans text-[15px] font-medium leading-relaxed text-foreground/90">
                    {article.excerpt}
                </p>)}

                {article.content?.trim() && (<div className="mt-6 space-y-5 font-sans text-[15px] leading-8 text-foreground/80">
                    {splitParagraphs(article.content).map((paragraph, index) => (<p key={index}>{paragraph}</p>))}
                </div>)}

                {article.tags && article.tags.length > 0 && (<div className="mt-8 flex flex-wrap items-center gap-2 border-t border-border/40 pt-5">
                    {article.tags.map((tag) => (<span key={tag} className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-primary">
                        #{tag}
                    </span>))}
                </div>)}
            </article>

            <div className="lg:sticky lg:top-28">
                <h2 className="mb-4 font-display text-base font-bold tracking-tight text-foreground">Berita terkait</h2>
                {related.length === 0 ? (<p className="rounded-2xl border border-border/40 bg-white p-5 text-[12px] leading-relaxed text-muted-foreground">
                    Belum ada artikel lain yang bisa ditampilkan.
                </p>) : (<div className="space-y-4">
                    {related.map((item) => (<Link key={item.id} href={item.slug ? `/blog/${item.slug}` : '/blog'}
                        className="flex gap-3 rounded-2xl border border-border/40 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
                        <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                            {item.cover_image && (<SmartImage src={item.cover_image} alt={item.title ?? 'Artikel'} sizes="6rem" className="h-full w-full object-cover" />)}
                        </div>
                        <div className="flex min-w-0 flex-col justify-center gap-1.5">
                            {item.category && (<span className={PILL_CLASS + ' w-fit'}>{item.category}</span>)}
                            <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
                                {item.title ?? 'Tanpa judul'}
                            </span>
                            <span className="text-[10px] uppercase tracking-[0.12em] text-rose-500">
                                {formatDate(item.published_at ?? item.created_at)}
                            </span>
                        </div>
                    </Link>))}
                </div>)}
            </div>
        </div>)}
    </section>);
}
