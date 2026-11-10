'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Clock3, CornerDownRight } from 'lucide-react';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { cn } from '@/lib/utils';
import { BLOG_PAGE_LIMIT, estimateReadingTime, fetchPublishedArticles, formatDate, type BlogArticle, } from './blog-shared';

// Halaman Blog bergaya landing / news: sidebar kategori di kiri,
// artikel utama besar di tengah, deret artikel terbaru di kanan.

const PILL_CLASS = 'inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-rose-600';

function cover(article: BlogArticle | null | undefined): string | null {
    return article?.cover_image || null;
}

function CategoryList({ categories, active, onSelect, variant }: {
    categories: string[];
    active: string;
    onSelect: (category: string) => void;
    variant: 'sidebar' | 'chips';
}) {
    const options = ['Semua', ...categories];
    if (variant === 'chips') {
        return (<div className="mb-6 flex gap-2 overflow-x-auto pb-1 lg:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {options.map((option) => (
                <button key={option} type="button" onClick={() => onSelect(option === 'Semua' ? '' : option)}
                    className={cn('shrink-0 rounded-full border px-4 py-1.5 text-[12px] font-semibold transition-colors', (option === 'Semua' && !active) || option.toLowerCase() === active.toLowerCase()
                        ? 'border-rose-200 bg-rose-50 text-rose-600'
                        : 'border-border/50 bg-white text-muted-foreground hover:border-rose-200 hover:text-rose-600')}>
                    {option}
                </button>
            ))}
        </div>);
    }
    return (<aside className="hidden rounded-2xl border border-border/40 bg-white p-6 shadow-sm lg:block">
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">Kategori</h2>
        <ul className="mt-5 space-y-2.5">
            {options.map((option) => (
                <li key={option}>
                    <button type="button" onClick={() => onSelect(option === 'Semua' ? '' : option)}
                        className={cn('text-left text-[13px] font-medium transition-colors hover:text-rose-600', (option === 'Semua' && !active) || option.toLowerCase() === active.toLowerCase()
                            ? 'font-semibold text-rose-600'
                            : 'text-muted-foreground')}>
                        {option}
                    </button>
                </li>
            ))}
        </ul>
    </aside>);
}

function FeaturedCard({ article }: { article: BlogArticle }) {
    return (<article className="overflow-hidden rounded-2xl border border-border/40 bg-white shadow-sm">
        <div className="aspect-[16/9] w-full bg-muted">
            {cover(article) && (<SmartImage src={article.cover_image!} alt={article.title ?? 'C Artikel'} sizes="(min-width: 1024px) 48rem, 100vw" priority
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]" />)}
        </div>
        <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
                {article.category && (<span className={PILL_CLASS}>{article.category}</span>)}
                <span className="font-sans text-[11px] uppercase tracking-[0.14em] text-rose-500">
                    {formatDate(article.published_at ?? article.created_at)}
                </span>
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold leading-snug tracking-tight text-foreground sm:text-3xl">
                <Link href={article.slug ? `/blog/${article.slug}` : '/blog'} className="transition-colors hover:text-primary">
                    {article.title ?? 'Tanpa judul'}
                </Link>
            </h2>
            {article.excerpt && (<p className="mt-3 font-sans text-[14px] leading-relaxed text-muted-foreground sm:text-[15px]">
                {article.excerpt}
            </p>)}
            <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-4 text-[12px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden />
                    {estimateReadingTime(article.content ?? article.excerpt) > 0
                        ? `±${estimateReadingTime(article.content ?? article.excerpt)} kata`
                        : 'Artikel ReBites'}
                </span>
                <Link href={article.slug ? `/blog/${article.slug}` : '/blog'}
                    className="font-semibold text-primary transition-colors hover:text-primary-dark">
                    Baca selengkapnya
                </Link>
            </div>
        </div>
    </article>);
}

function ArticleRow({ article }: { article: BlogArticle }) {
    return (<article className="overflow-hidden rounded-2xl border border-border/40 bg-white shadow-sm transition-shadow hover:shadow-md sm:grid sm:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="h-44 bg-muted sm:h-full">
            {cover(article) && (<SmartImage src={article.cover_image!} alt={article.title ?? 'Artikel'} sizes="(min-width: 1024px) 14rem, 100vw"
                className="h-full w-full object-cover" />)}
        </div>
        <div className="flex h-full flex-col justify-center p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2.5">
                {article.category && (<span className={PILL_CLASS}>{article.category}</span>)}
                <span className="text-[11px] font-sans uppercase tracking-[0.12em] text-rose-500">
                    {formatDate(article.published_at ?? article.created_at)}
                </span>
            </div>
            <h3 className="mt-2.5 font-display text-base font-bold leading-snug tracking-tight text-foreground sm:text-lg">
                <Link href={article.slug ? `/blog/${article.slug}` : '/blog'} className="transition-colors hover:text-primary">
                    {article.title ?? 'Tanpa judul'}
                </Link>
            </h3>
            {article.excerpt && (<p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                {article.excerpt}
            </p>)}
        </div>
    </article>);
}

function LatestCard({ article }: { article: BlogArticle }) {
    return (<article className="overflow-hidden rounded-2xl border border-border/40 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
        <div className="aspect-[16/10] w-full overflow-hidden rounded-xl bg-muted">
            {cover(article) && (<SmartImage src={article.cover_image!} alt={article.title ?? 'Artikel'} sizes="(min-width: 1024px) 18rem, 100vw"
                className="h-full w-full object-cover" />)}
        </div>
        <div className="p-3">
            <div className="flex items-center justify-between gap-2">
                {article.category && (<span className={PILL_CLASS}>{article.category}</span>)}
                <span className="shrink-0 text-[11px] text-rose-500">
                    {formatDate(article.published_at ?? article.created_at)}
                </span>
            </div>
            <h3 className="mt-2 line-clamp-2 font-display text-[14px] font-bold leading-snug text-foreground">
                <Link href={article.slug ? `/blog/${article.slug}` : '/blog'} className="transition-colors hover:text-primary">
                    {article.title ?? 'Tanpa judul'}
                </Link>
            </h3>
        </div>
    </article>);
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

    // Daftar kategori untuk sidebar — diambil sekali dari halaman pertama.
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
    const latest = rest.slice(0, 4);

    const selectCategory = (nextCategory: string) => {
        setCategory(nextCategory);
        router.replace(nextCategory ? `/blog?kategori=${encodeURIComponent(nextCategory)}` : '/blog', { scroll: false });
    };

    return (<section className="mx-auto w-full max-w-7xl px-5 pb-20 pt-28 sm:px-8 sm:pt-32">
        <div className="mb-8 flex items-end justify-between gap-4">
            <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-500">Blog ReBites</p>
                <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                    Kabar terbaru di dapur makanan surplus
                </h1>
            </div>
        </div>

        <CategoryList categories={categories} active={category} onSelect={selectCategory} variant="chips" />

        <div className="grid gap-6 lg:grid-cols-[210px_minmax(0,1fr)_280px] lg:items-start">
            <CategoryList categories={categories} active={category} onSelect={selectCategory} variant="sidebar" />

            <div className="space-y-6">
                {status === 'loading' && (<div className="space-y-6" aria-hidden>
                    <div className="h-64 animate-pulse rounded-2xl bg-muted" />
                    <div className="h-28 animate-pulse rounded-2xl bg-muted" />
                    <div className="h-28 animate-pulse rounded-2xl bg-muted" />
                </div>)}

                {status === 'error' && (<div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-[14px] text-rose-700">
                    {errorMsg || 'Gagal memuat artikel.'}
                    <button type="button" onClick={() => void loadFirst(category)}
                        className="ml-2 font-semibold underline underline-offset-4">
                        Coba lagi
                    </button>
                </div>)}

                {status === 'ready' && !featured && (<div className="rounded-2xl border border-border/40 bg-white p-10 text-center shadow-sm">
                    <h2 className="font-display text-lg font-bold text-foreground">Belum ada artikel yang diterbitkan</h2>
                    <p className="mt-2 text-[13px] text-muted-foreground">
                        Artikel yang dipublikasikan admin akan tampil di sini.
                    </p>
                    <CornerDownRight className="mx-auto mt-4 h-5 w-5 text-muted-foreground/50" aria-hidden />
                </div>)}

                {status === 'ready' && featured && (<>
                    <FeaturedCard article={featured} />

                    <div className="space-y-6">
                        {rest.map((article) => (<ArticleRow key={article.id} article={article} />))}
                    </div>

                    {offset < total && (<div className="pt-2 text-center">
                        <button type="button" onClick={() => void loadMore()} disabled={loadingMore}
                            className="inline-flex h-10 items-center justify-center rounded-full border border-primary/30 bg-white px-7 text-[12px] font-semibold uppercase tracking-[0.12em] text-primary transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60">
                            {loadingMore ? 'Memuat…' : 'Muat lebih banyak'}
                        </button>
                    </div>)}
                </>)}
            </div>

            <div className="lg:sticky lg:top-28">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-display text-base font-bold tracking-tight text-foreground">Berita terbaru</h2>
                </div>
                {latest.length === 0 ? (<p className="rounded-2xl border border-border/40 bg-white p-5 text-[12px] leading-relaxed text-muted-foreground">
                    Artikel terbaru akan muncul di sini setelah ada lebih dari satu artikel.
                </p>) : (<div className="space-y-4">
                    {latest.map((article) => (<LatestCard key={article.id} article={article} />))}
                </div>)}
            </div>
        </div>
    </section>);
}
