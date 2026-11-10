'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { cn } from '@/lib/utils';
import { BLOG_PAGE_LIMIT, fetchPublishedArticles, formatDate, type BlogArticle, } from './blog-shared';

// Blog landing bergaya majalah sederhana: satu artikel utama dengan foto lebar,
// lalu grid kartu sederhana. Kategori memakai chip di atas, tanpa panel samping.

const PILL_CLASS = 'inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-rose-600';

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
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
            ) : null}
        </div>
    );
}

function FeaturedCard({ article }: { article: BlogArticle }) {
    const href = article.slug ? `/blog/${article.slug}` : '/blog';
    return (
        <article className="group overflow-hidden rounded-3xl border border-border/40 bg-white shadow-sm transition-shadow hover:shadow-md">
            <Link href={href} className="block">
                <CardImage article={article} className="aspect-[16/9] w-full sm:aspect-[16/7]"
                    sizes="(min-width: 1152px) 72rem, 100vw" priority />
            </Link>
            <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-3">
                    {article.category && (<span className={PILL_CLASS}>{article.category}</span>)}
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        {formatDate(article.published_at ?? article.created_at)}
                    </span>
                </div>
                <h2 className="mt-3 font-display text-2xl font-bold leading-snug tracking-tight text-foreground sm:text-[28px]">
                    <Link href={href} className="transition-colors hover:text-primary">
                        {article.title ?? 'Tanpa judul'}
                    </Link>
                </h2>
                {article.excerpt && (<p className="mt-3 line-clamp-2 text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
                    {article.excerpt}
                </p>)}
                <Link href={href} className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary transition-colors hover:text-primary-dark">
                    Baca selengkapnya
                    <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
            </div>
        </article>
    );
}

function ArticleCard({ article, priority }: { article: BlogArticle; priority?: boolean }) {
    const href = article.slug ? `/blog/${article.slug}` : '/blog';
    return (
        <article className="group flex flex-col overflow-hidden rounded-2xl border border-border/40 bg-white transition-shadow hover:shadow-md">
            <CardImage article={article} className="aspect-[16/9] w-full"
                sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 100vw" priority={priority} />
            <div className="flex flex-1 flex-col p-5">
                <div className="flex flex-wrap items-center gap-2.5">
                    {article.category && (<span className={PILL_CLASS}>{article.category}</span>)}
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {formatDate(article.published_at ?? article.created_at)}
                    </span>
                </div>
                <h3 className="mt-3 flex-1 font-display text-[16px] font-bold leading-snug tracking-tight text-foreground">
                    <Link href={href} className="transition-colors hover:text-primary">
                        {article.title ?? 'Tanpa judul'}
                    </Link>
                </h3>
                <Link href={href} className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary transition-colors hover:text-primary-dark">
                    Baca selengkapnya
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
            </div>
        </article>
    );
}

function CategoryChips({ categories, active, onSelect }: {
    categories: string[];
    active: string;
    onSelect: (category: string) => void;
}) {
    const options = ['Semua', ...categories];
    return (
        <div className="mb-8 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {options.map((option) => (
                <button key={option} type="button" onClick={() => onSelect(option === 'Semua' ? '' : option)}
                    className={cn('shrink-0 rounded-full border px-4 py-1.5 text-[12px] font-semibold transition-colors',
                        (option === 'Semua' && !active) || option.toLowerCase() === active.toLowerCase()
                            ? 'border-rose-200 bg-rose-50 text-rose-600'
                            : 'border-border/50 bg-white text-muted-foreground hover:border-rose-200 hover:text-rose-600')}>
                    {option}
                </button>
            ))}
        </div>
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

    // Daftar kategori chip — diambil sekali dari halaman pertama.
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
    const rest = items.slice(1);

    const selectCategory = (nextCategory: string) => {
        setCategory(nextCategory);
        router.replace(nextCategory ? `/blog?kategori=${encodeURIComponent(nextCategory)}` : '/blog', { scroll: false });
    };

    return (<section className="mx-auto w-full max-w-6xl px-5 pb-24 pt-28 sm:px-8 sm:pt-32">
        <header className="mb-8 max-w-2xl">
            <span className={PILL_CLASS}>Blog ReBites</span>
            <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Kabar terbaru dari dapur ReBites
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
                Cerita, tips, dan edukasi seputar makanan surplus — ditulis langsung oleh tim ReBites.
            </p>
        </header>

        <CategoryChips categories={categories} active={category} onSelect={selectCategory} />

        {status === 'loading' && (<div className="space-y-8" aria-hidden>
            <div className="aspect-[16/9] w-full animate-pulse rounded-3xl bg-muted sm:aspect-[16/7]" />
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="aspect-[16/9] animate-pulse rounded-2xl bg-muted" />
                <div className="aspect-[16/9] animate-pulse rounded-2xl bg-muted" />
                <div className="aspect-[16/9] animate-pulse rounded-2xl bg-muted" />
            </div>
        </div>)}

        {status === 'error' && (<div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-[14px] text-rose-700">
            {errorMsg || 'Gagal memuat artikel.'}
            <button type="button" onClick={() => void loadFirst(category)}
                className="ml-2 font-semibold underline underline-offset-4">
                Coba lagi
            </button>
        </div>)}

        {status === 'ready' && !featured && (<div className="rounded-2xl border border-border/40 bg-white p-12 text-center shadow-sm">
            <h2 className="font-display text-lg font-bold text-foreground">Belum ada artikel yang diterbitkan</h2>
            <p className="mt-2 text-[13px] text-muted-foreground">
                Artikel yang dipublikasikan admin akan tampil di sini.
            </p>
        </div>)}

        {status === 'ready' && featured && (<>
            <FeaturedCard article={featured} />

            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((article, index) => (<ArticleCard key={article.id} article={article} priority={index < 3} />))}
            </div>

            {offset < total && (<div className="pt-10 text-center">
                <button type="button" onClick={() => void loadMore()} disabled={loadingMore}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-primary/30 bg-white px-8 text-[12px] font-semibold uppercase tracking-[0.12em] text-primary transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60">
                    {loadingMore ? 'Memuat…' : 'Muat lebih banyak'}
                </button>
            </div>)}
        </>)}
    </section>);
}
