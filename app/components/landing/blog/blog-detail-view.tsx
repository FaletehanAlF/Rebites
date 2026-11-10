'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Clock3 } from 'lucide-react';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { Skeleton } from '@/app/components/ui/skeleton';
import { estimateReadingTime, fetchPublishedArticles, formatDate, splitParagraphs, type BlogArticle, } from './blog-shared';

const PILL_CLASS = 'inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-rose-600';

type DetailState = 'loading' | 'ready' | 'notfound' | 'error';

function RelatedCard({ article }: { article: BlogArticle }) {
    const href = article.slug ? `/blog/${article.slug}` : '/blog';
    return (
        <Link href={href} className="group flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-white transition-shadow hover:shadow-md">
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                {article.cover_image && (
                    <SmartImage src={article.cover_image} alt={article.title ?? 'Cover artikel'} sizes="(min-width: 640px) 22rem, 100vw"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                )}
            </div>
            <div className="p-4">
                <div className="flex flex-wrap items-center gap-2.5">
                    {article.category && (<span className={PILL_CLASS}>{article.category}</span>)}
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {formatDate(article.published_at ?? article.created_at)}
                    </span>
                </div>
                <span className="mt-2 line-clamp-2 block text-[13px] font-semibold leading-snug text-foreground">
                    {article.title ?? 'Tanpa judul'}
                </span>
            </div>
        </Link>
    );
}

export function BlogDetailView({ slug }: { slug: string }) {
    const [state, setState] = useState<DetailState>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [article, setArticle] = useState<BlogArticle | null>(null);
    const [related, setRelated] = useState<BlogArticle[]>([]);

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

            // Berita terkait: prioritaskan kategori sama, lalu sisanya.
            const list = await fetchPublishedArticles({ offset: 0, limit: 50 });
            const sameCategory = list.items.filter((a) => a.slug !== slug && a.category && a.category === json.article.category);
            const others = list.items.filter((a) => a.slug !== slug && (!a.category || a.category !== json.article.category));
            setRelated([...sameCategory, ...others].slice(0, 3));
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

    return (<section className="mx-auto w-full max-w-3xl px-5 pb-24 pt-28 sm:pt-32">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-primary">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Kembali ke Blog
        </Link>

        {state === 'loading' && (<div className="mt-6 space-y-4" aria-hidden>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="aspect-[16/9] w-full rounded-3xl" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
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

        {state === 'ready' && article && (<>
            <article className="mt-6">
                <div className="flex flex-wrap items-center gap-3">
                    {article.category && (<span className={PILL_CLASS}>{article.category}</span>)}
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                        {formatDate(article.published_at ?? article.created_at)}
                    </span>
                    {readingMinutes > 0 && (<span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        <Clock3 className="h-3.5 w-3.5" aria-hidden />
                        {readingMinutes} menit baca
                    </span>)}
                </div>

                <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
                    {article.title ?? 'Tanpa judul'}
                </h1>

                <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden rounded-3xl border border-border/40 bg-muted">
                    {article.cover_image && (<SmartImage src={article.cover_image} alt={article.title ?? 'Cover artikel'}
                        sizes="(min-width: 768px) 48rem, 100vw" priority className="transition-transform duration-500 hover:scale-[1.01]" />)}
                </div>

                {article.excerpt && (<p className="mt-6 text-[16px] font-medium leading-relaxed text-foreground/90">
                    {article.excerpt}
                </p>)}

                {article.content?.trim() && (<div className="mt-5 space-y-5 text-[15px] leading-8 text-foreground/80">
                    {splitParagraphs(article.content).map((paragraph, index) => (<p key={index}>{paragraph}</p>))}
                </div>)}

                {article.tags && article.tags.length > 0 && (<div className="mt-8 flex flex-wrap items-center gap-2">
                    {article.tags.map((tag) => (<span key={tag} className="rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-primary">
                        #{tag}
                    </span>))}
                </div>)}
            </article>

            {related.length > 0 && (<div className="mt-16 border-t border-border/40 pt-8">
                <h2 className="font-display text-lg font-bold tracking-tight text-foreground">Berita terkait</h2>
                <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {related.map((item) => (<RelatedCard key={item.id} article={item} />))}
                </div>
            </div>)}
        </>)}
    </section>);
}
