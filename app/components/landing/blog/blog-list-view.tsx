'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { cn } from '@/lib/utils';
import { BLOG_PAGE_LIMIT, fetchPublishedArticles, formatDate, type BlogArticle, } from './blog-shared';

// Halaman Blog bergaya jurnal editorial (terinspirasi cationgate.site/blog),
// disesuaikan ke tema ReBites: latar hangat, kartu putih, aksen hijau primary
// untuk aksi dan rose untuk label kategori. Layout 12 kolom — sorotan utama
// di kolom 8, daftar artikel lainnya di kolom 4 (border atas/bawah halus).

const CATEGORY_META = 'text-[11px] font-bold uppercase tracking-[0.16em] text-rose-600';

function CardImage({ article, className, sizes, priority }: {
    article: BlogArticle;
    className: string;
    sizes: string;
    priority?: boolean;
}) {
    return (
        <div className={cn('relative w-full overflow-hidden bg-muted', className)}>
            {article.cover_image ? (
                <SmartImage src={article.cover_image} alt={article.title ?? 'Cover artikel'} sizes={sizes} priority={priority}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
            ) : null}
        </div>
    );
}

function FeaturedPost({ article }: { article: BlogArticle }) {
    const href = article.slug ? `/blog/${article.slug}` : '/blog';
    return (
        <Link href={href} className="group lg:col-span-8">
            <CardImage article={article} className="aspect-[16/10] w-full rounded-2xl border border-border/40"
                sizes="(min-width: 1024px) 58rem, 100vw" priority />
            <div className="mt-6 max-w-2xl space-y-4">
                {article.category && (<span className={CATEGORY_META}>{article.category}</span>)}
                <h2 className="font-display text-2xl font-bold leading-[1.15] tracking-tight text-foreground transition-colors duration-300 group-hover:text-primary sm:text-3xl md:text-[40px]">
                    {article.title ?? 'Tanpa judul'}
                </h2>
                {article.excerpt && (<p className="line-clamp-2 text-[15px] leading-relaxed text-muted-foreground sm:text-lg">
                    {article.excerpt}
                </p>)}
                <p className="pt-1 text-[13px] font-medium text-muted-foreground">
                    <span className="font-semibold text-foreground/80">Tim ReBites</span>
                    <span className="px-2 text-border">•</span>
                    {formatDate(article.published_at ?? article.created_at)}
                </p>
            </div>
        </Link>
    );
}

function SideItem({ article }: { article: BlogArticle }) {
    const href = article.slug ? `/blog/${article.slug}` : '/blog';
    return (
        <Link href={href} className="group flex gap-4 py-5 first:pt-0 sm:gap-5">
            <span className="flex min-w-0 flex-1 flex-col justify-center">
                {article.category && (<span className={CATEGORY_META}>{article.category}</span>)}
                <h4 className="mt-1.5 line-clamp-3 text-[14px] font-bold leading-snug text-foreground transition-colors duration-300 group-hover:text-primary sm:text-[15px]">
                    {article.title ?? 'Tanpa judul'}
                </h4>
                <span className="mt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    {formatDate(article.published_at ?? article.created_at)}
                </span>
            </span>
            <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-24 sm:w-24">
                {article.cover_image && (
                    <SmartImage src={article.cover_image} alt={article.title ?? 'Cover artikel'} sizes="96px"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" />
                )}
            </span>
        </Link>
    );
}

export function BlogListView() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialCategory = searchParams.get('kategori') ?? '';

    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [items, setItems] = useState<BlogArticle[]>([]);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);
    const [category, setCategory] = useState(initialCategory);
    const [categories, setCategories] = useState<string[]>([]);

    // Daftar kategori di header — diambil sekali dari halaman pertama.
    useEffect(() => {
        let mounted = true;
        void (async () => {
            const result = await fetchPublishedArticles({ offset: 0, limit: 50 });
            if (!mounted)
                return;
            const unique = Array.from(new Set(result.items
                .map((a) => (a.category ?? '').trim())
                .filter(Boolean)));
            unique.sort((a, b) => a.localeCompare(b, 'id'));
            setCategories(unique);
        })();
        return () => { mounted = false; };
    }, []);

    const loadFirst = useCallback(async (nextCategory: string) => {
        setStatus('loading');
        setErrorMsg('');
        const result = await fetchPublishedArticles({ offset: 0, category: nextCategory || undefined });
        setItems(result.items);
        setTotal(result.total);
        setOffset(result.items.length);
        if (result.error) {
            setErrorMsg(result.error);
            setStatus('error');
        }
        else {
            setStatus('ready');
        }
    }, []);

    useEffect(() => {
        void loadFirst(category);
    }, [category, loadFirst]);

    const loadMore = useCallback(async () => {
        if (loadingMore || offset >= total)
            return;
        setLoadingMore(true);
        const result = await fetchPublishedArticles({ offset, category: category || undefined });
        setItems((prev) => [...prev, ...result.items]);
        setOffset(offset + result.items.length);
        setLoadingMore(false);
    }, [category, loadingMore, offset, total]);

    const featured = items[0] ?? null;
    const sidePosts = items.slice(1, 1 + BLOG_PAGE_LIMIT);

    const selectCategory = (nextCategory: string) => {
        setCategory(nextCategory);
        router.replace(nextCategory ? `/blog?kategori=${encodeURIComponent(nextCategory)}` : '/blog', { scroll: false });
    };

    const options = ['Semua', ...categories];

    return (<section className="mx-auto w-full max-w-6xl px-5 pb-24 pt-28 sm:px-8 sm:pt-32">
        {/* Header jurnal + filter kategori */}
        <div className="mb-12 flex flex-col justify-between gap-6 border-b border-border/60 pb-8 md:flex-row md:items-end">
            <div>
                <h1 className="font-display text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                    Jurnal
                </h1>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground sm:text-base">
                    Kabar, tips, &amp; cerita dari dapur ReBites.
                </p>
            </div>

            <div className="flex flex-wrap gap-2">
                {options.map((option) => (
                    <button key={option} type="button" onClick={() => selectCategory(option === 'Semua' ? '' : option)}
                        className={cn('rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-300',
                            (option === 'Semua' && !category) || option.toLowerCase() === category.toLowerCase()
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-muted-foreground hover:bg-secondary hover:text-foreground')}>
                        {option}
                    </button>
                ))}
            </div>
        </div>

        {status === 'loading' && (<div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14" aria-hidden>
            <div className="space-y-5 lg:col-span-8">
                <div className="aspect-[16/10] w-full animate-pulse rounded-2xl bg-muted" />
                <div className="h-4 w-32 animate-pulse rounded-full bg-muted" />
                <div className="h-9 w-4/5 animate-pulse rounded-xl bg-muted" />
                <div className="h-4 w-full animate-pulse rounded-full bg-muted" />
            </div>
            <div className="space-y-4 lg:col-span-4">
                <div className="h-3 w-40 animate-pulse rounded-full bg-muted" />
                <div className="h-20 animate-pulse rounded-xl bg-muted" />
                <div className="h-20 animate-pulse rounded-xl bg-muted" />
                <div className="h-20 animate-pulse rounded-xl bg-muted" />
            </div>
        </div>)}

        {status === 'error' && (<div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-[14px] text-rose-700">
            {errorMsg || 'Gagal memuat artikel.'}
            <button type="button" onClick={() => void loadFirst(category)}
                className="ml-2 font-semibold underline underline-offset-4">
                Coba lagi
            </button>
        </div>)}

        {status === 'ready' && !featured && (<div className="border-y border-border/60 py-24 text-center">
            <p className="font-display text-lg font-bold text-foreground">Belum ada jurnal di kategori ini.</p>
            <p className="mt-2 text-[13px] text-muted-foreground">
                Artikel yang dipublikasikan admin akan tampil di sini.
            </p>
        </div>)}

        {status === 'ready' && featured && (<>
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14">
                <FeaturedPost article={featured} />

                <aside className="lg:col-span-4">
                    <h3 className="mb-4 border-b border-border/60 pb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                        Artikel Lainnya
                    </h3>
                    <div className="flex flex-col divide-y divide-border/50">
                        {sidePosts.map((article) => (<SideItem key={article.id} article={article} />))}
                    </div>
                </aside>
            </div>

            {offset < total && (<div className="mt-14 border-t border-border/60 pt-8 text-center">
                <button type="button" onClick={() => void loadMore()} disabled={loadingMore}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-primary/30 bg-white px-8 text-[12px] font-semibold uppercase tracking-[0.12em] text-primary transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60">
                    {loadingMore ? 'Memuat…' : 'Muat lebih banyak'}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
            </div>)}
        </>)}
    </section>);
}
