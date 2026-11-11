'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ArrowRight, Clock3 } from 'lucide-react';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { Skeleton } from '@/app/components/ui/skeleton';
import { estimateReadingTime, fetchPublishedArticles, formatDate, splitParagraphs, type BlogArticle, } from './blog-shared';

// Halaman detail artikel bergaya jurnal editorial, selaras dengan BlogListView.
// Header menonjol, cover sinematik lebar, isi 8 kolom, sidebar "Baca Selanjutnya"
// sticky 4 kolom dengan CTA hijau ReBites.

const CATEGORY_META = 'text-[11px] font-bold uppercase tracking-[0.16em] text-rose-600';

type DetailState = 'loading' | 'ready' | 'notfound' | 'error';

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
            setRelated([...sameCategory, ...others].slice(0, 4));
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

    return (<section className="mx-auto w-full max-w-5xl px-5 pb-24 pt-28 sm:px-8 sm:pt-32">
        <Link href="/blog" className="group inline-flex items-center gap-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" aria-hidden />
            Kembali ke Jurnal
        </Link>

        {state === 'loading' && (<div className="mt-8 max-w-4xl space-y-5" aria-hidden>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="aspect-[2.5/1] w-full rounded-2xl" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
        </div>)}

        {state === 'notfound' && (<div className="mt-16 border-y border-border/60 py-24 text-center">
            <h1 className="font-display text-xl font-bold text-foreground">Artikel tidak ditemukan</h1>
            <p className="mt-2 text-[13px] text-muted-foreground">Mungkin belum dipublikasikan atau tautannya salah.</p>
            <Link href="/blog" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-primary-dark">
                Kembali ke Jurnal
                <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
        </div>)}

        {state === 'error' && (<div className="mt-16 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-[14px] text-rose-700">
            {errorMsg || 'Gagal memuat artikel.'}
            <button type="button" onClick={() => void load()} className="ml-2 font-semibold underline underline-offset-4">Coba lagi</button>
        </div>)}

        {state === 'ready' && article && (<>
            <header className="mb-10 mt-8 max-w-4xl">
                <div className="mb-6 flex flex-wrap items-center gap-4">
                    {article.category && (<span className={CATEGORY_META}>{article.category}</span>)}
                    <span className="text-border">•</span>
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
                        <Clock3 className="h-4 w-4" aria-hidden />
                        {readingMinutes} menit baca
                    </span>
                </div>

                <h1 className="font-display text-3xl font-bold leading-[1.15] tracking-tight text-foreground sm:text-4xl md:text-5xl">
                    {article.title ?? 'Tanpa judul'}
                </h1>

                <div className="mt-7 flex items-center gap-4">
                    <Image
                        src="/logo.avif"
                        alt=""
                        width={48}
                        height={48}
                        className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                    <div>
                        <p className="text-[14px] font-bold text-foreground">Tim ReBites</p>
                        <p className="text-[12px] text-muted-foreground">
                            {formatDate(article.published_at ?? article.created_at)}
                        </p>
                    </div>
                </div>
            </header>

            <div className="relative mb-14 aspect-[16/10] w-full overflow-hidden rounded-2xl border border-border/40 bg-muted sm:aspect-[2.5/1]">
                {article.cover_image && (<SmartImage src={article.cover_image} alt={article.title ?? 'Cover artikel'}
                    sizes="(min-width: 1024px) 64rem, 100vw" priority className="transition-transform duration-700 hover:scale-[1.01]" />)}
            </div>

            <div className="relative grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-14">
                <article className="lg:col-span-8">
                    {article.excerpt && (<p className="mb-8 border-b border-border/50 pb-8 text-lg font-medium leading-relaxed text-foreground/90 md:text-[20px]">
                        {article.excerpt}
                    </p>)}

                    {article.content?.trim() && (<div className="space-y-5 text-[15px] leading-8 text-foreground/85 sm:text-base">
                        {splitParagraphs(article.content).map((paragraph, index) => (<p key={index}>{paragraph}</p>))}
                    </div>)}

                    {article.tags && article.tags.length > 0 && (<div className="mt-10 flex flex-wrap items-center gap-2">
                        {article.tags.map((tag) => (<span key={tag} className="rounded-full border border-border/60 bg-secondary/60 px-3 py-1 text-[11px] font-semibold text-primary">
                            #{tag}
                        </span>))}
                    </div>)}

                    <div className="mt-12 flex items-center gap-4 border-t border-border/50 pt-6">
                        <Image
                            src="/logo.avif"
                            alt=""
                            width={48}
                            height={48}
                            className="h-12 w-12 shrink-0 rounded-full object-cover"
                        />
                        <div>
                            <p className="text-[14px] font-bold text-foreground">Tim ReBites</p>
                            <p className="text-[12px] leading-relaxed text-muted-foreground">
                                Cerita, edukasi, dan panduan seputar makanan surplus & gaya hidup tanpa food waste.
                            </p>
                        </div>
                    </div>
                </article>

                <aside className="lg:col-span-4">
                    <div className="sticky top-28 space-y-8">
                        <div>
                            <h3 className="mb-5 border-b border-border/60 pb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                Baca Selanjutnya
                            </h3>
                            <div className="flex flex-col gap-5">
                                {related.slice(0, 4).map((post) => {
                                    const relatedMinutes = post.content
                                        ? Math.max(1, Math.round(estimateReadingTime(post.content) / 220))
                                        : null;
                                    return (
                                        <Link key={post.id} href={post.slug ? `/blog/${post.slug}` : '/blog'} className="group">
                                            <span className="line-clamp-2 text-[14px] font-bold leading-snug text-foreground transition-colors duration-300 group-hover:text-primary sm:text-[15px]">
                                                {post.title ?? 'Tanpa judul'}
                                            </span>
                                            <span className="mt-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                                                {relatedMinutes !== null ? `${relatedMinutes} menit baca` : formatDate(post.published_at ?? post.created_at)}
                                            </span>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="rounded-2xl bg-primary p-6 text-white sm:p-7">
                            <h3 className="font-display text-lg font-bold leading-snug">
                                Lapar, tapi sayang membuang?
                            </h3>
                            <p className="mt-2 text-[13px] leading-relaxed text-white/80">
                                Temukan makanan surplus layak konsumsi dari UMKM sekitar dengan harga lebih bersahabat.
                            </p>
                            <Link href="/#rekomendasi" className="mt-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:text-white/75">
                                Mulai Jelajah
                                <ArrowRight className="h-4 w-4" aria-hidden />
                            </Link>
                        </div>
                    </div>
                </aside>
            </div>
        </>)}
    </section>);
}
