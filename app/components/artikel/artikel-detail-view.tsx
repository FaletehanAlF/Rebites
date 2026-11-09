'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Clock, Newspaper } from 'lucide-react';
import { Skeleton } from '@/app/components/ui/skeleton';
import { SmartImage } from '@/app/components/shared/SmartImage';

interface PublicArticleDetail {
    id: string;
    title: string | null;
    slug: string | null;
    excerpt: string | null;
    content: string | null;
    cover_image: string | null;
    category: string | null;
    tags: string[] | null;
    published_at: string | null;
    created_at: string | null;
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

const estimateReadingTime = (content: string | null | undefined) => {
    if (!content?.trim()) return null;
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    if (words === 0) return null;
    const minutes = Math.max(1, Math.ceil(words / 200));
    return `${minutes} menit baca`;
};

function renderContent(content: string): JSX.Element[] {
    return content
        .split(/\n{2,}/)
        .map((block) => block.trim())
        .filter((block) => block.length > 0)
        .map((block, i) => (
            <p key={i} className="whitespace-pre-line leading-[1.85]">
                {block}
            </p>
        ));
}

export function ArtikelDetailView({
    slug,
    backHref,
    backLabel,
}: {
    slug: string;
    backHref: string;
    backLabel: string;
}) {
    const [article, setArticle] = useState<PublicArticleDetail | null>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
    const [errorMsg, setErrorMsg] = useState('');

    const load = useCallback(async () => {
        if (!slug) {
            setStatus('not-found');
            return;
        }
        setStatus('loading');
        setErrorMsg('');
        try {
            const res = await fetch(`/api/articles/${encodeURIComponent(slug)}`);
            if (res.status === 404) {
                setStatus('not-found');
                return;
            }
            if (!res.ok) {
                const json = (await res.json().catch(() => null)) as {
                    error?: string;
                } | null;
                throw new Error(json?.error ?? 'Gagal memuat artikel.');
            }
            const json = (await res.json().catch(() => null)) as {
                article?: PublicArticleDetail;
            } | null;
            if (!json || !json.article) {
                throw new Error('Respons artikel tidak valid.');
            }
            setArticle(json.article);
            setStatus('ready');
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Gagal memuat artikel.');
            setStatus('error');
        }
    }, [slug]);

    useEffect(() => {
        void load();
    }, [load]);

    useEffect(() => {
        if (status === 'ready' && article?.title) {
            document.title = `${article.title} - ReBites`;
            const excerpt = article.excerpt?.trim();
            if (excerpt) {
                let meta = document.querySelector('meta[name="description"]');
                if (!meta) {
                    meta = document.createElement('meta');
                    meta.setAttribute('name', 'description');
                    document.head.appendChild(meta);
                }
                meta.setAttribute('content', excerpt.slice(0, 160));
            }
        } else if (status === 'not-found') {
            document.title = 'Artikel tidak ditemukan - ReBites';
        }
    }, [status, article]);

    const readingTime = estimateReadingTime(article?.content);

    return (
        <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
            {/* Tombol kembali — hanya satu, di bagian atas (tidak diduplikasi di bawah artikel) */}
            <Link
                href={backHref}
                className="group inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border bg-white px-4 text-[13px] font-semibold text-primary shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-primary/30 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
                {backLabel}
            </Link>

            {status === 'loading' && (
                <div role="status" aria-label="Memuat artikel" className="mt-6 space-y-4">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-10 w-3/4 rounded-2xl" />
                    <Skeleton className="h-10 w-1/2 rounded-2xl" />
                    <Skeleton className="h-5 w-40 rounded-lg" />
                    <Skeleton className="aspect-[16/9] w-full rounded-3xl" />
                    <div className="space-y-3">
                        {[0, 1, 2, 3, 4].map((i) => (
                            <Skeleton key={i} className="h-4 w-full rounded-lg" />
                        ))}
                    </div>
                </div>
            )}

            {status === 'not-found' && (
                <div className="mt-6 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-white px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15 bg-secondary text-primary" aria-hidden>
                        <Newspaper className="h-6 w-6" strokeWidth={1.75} />
                    </span>
                    <p className="mt-4 font-display text-base font-semibold text-primary">
                        Artikel tidak ditemukan
                    </p>
                    <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted-foreground">
                        Artikel mungkin belum dipublish, sudah diarsipkan, atau alamatnya salah.
                    </p>
                    <Link
                        href={backHref}
                        className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                        <ArrowLeft className="h-4 w-4" aria-hidden />
                        {backLabel}
                    </Link>
                </div>
            )}

            {status === 'error' && (
                <div className="mt-6 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-white px-6 py-16 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15 bg-secondary text-primary" aria-hidden>
                        <Newspaper className="h-6 w-6" strokeWidth={1.75} />
                    </span>
                    <p className="mt-4 font-display text-base font-semibold text-primary">
                        Gagal memuat artikel
                    </p>
                    <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted-foreground">{errorMsg}</p>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                        <button
                            type="button"
                            onClick={() => void load()}
                            className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        >
                            Coba lagi
                        </button>
                        <Link
                            href={backHref}
                            className="inline-flex h-11 items-center gap-2 rounded-full border border-primary/20 bg-white px-6 text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        >
                            <ArrowLeft className="h-4 w-4" aria-hidden />
                            {backLabel}
                        </Link>
                    </div>
                </div>
            )}

            {status === 'ready' && article && (
                <article className="mt-6 overflow-hidden rounded-3xl border border-border bg-white shadow-sm">
                    <div className="relative aspect-[16/9] w-full overflow-hidden bg-sage-100">
                        <SmartImage
                            src={article.cover_image ?? ''}
                            alt={article.title ? `Cover ${article.title}` : 'Cover artikel'}
                            sizes="(min-width: 768px) 768px, 100vw"
                            priority
                        />
                        {article.category?.trim() && (
                            <span className="absolute left-4 top-4 rounded-full bg-charcoal-900/80 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
                                {article.category.trim()}
                            </span>
                        )}
                    </div>

                    <div className="p-5 sm:p-8 lg:p-10">
                        <p className="font-secondary text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                            Blog ReBites
                        </p>
                        <h1 className="mt-3 text-balance font-display text-[clamp(1.75rem,4vw,2.5rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-primary">
                            {article.title ?? '-'}
                        </h1>

                        {article.excerpt?.trim() && (
                            <p className="mt-4 text-base leading-[1.8] text-muted-foreground sm:text-lg">
                                {article.excerpt.trim()}
                            </p>
                        )}

                        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground sm:text-sm">
                            <span className="inline-flex items-center gap-1.5">
                                <CalendarDays className="h-4 w-4" aria-hidden />
                                {formatDate(article.published_at)}
                            </span>
                            {readingTime && (
                                <span className="inline-flex items-center gap-1.5">
                                    <Clock className="h-4 w-4" aria-hidden />
                                    {readingTime}
                                </span>
                            )}
                        </div>

                        <div className="mt-6 space-y-5 border-t border-border pt-7 text-[15px] text-charcoal-900 sm:text-base">
                            {article.content?.trim() ? (
                                renderContent(article.content)
                            ) : (
                                <p className="text-sm text-muted-foreground">Konten artikel belum tersedia.</p>
                            )}
                        </div>

                        {Array.isArray(article.tags) && article.tags.length > 0 && (
                            <div className="mt-8 flex flex-wrap gap-2 border-t border-border pt-6">
                                {article.tags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground"
                                    >
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </article>
            )}
        </div>
    );
}
