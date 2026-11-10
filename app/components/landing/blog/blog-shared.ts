'use client';

// Data & util bersama untuk halaman Blog versi landing (diambil dari API
// publik /api/articles — hanya artikel berstatus `published`).

export interface BlogArticle {
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

export const BLOG_PAGE_LIMIT = 12;

export function formatDate(iso: string | null | undefined): string {
    if (!iso)
        return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return '-';
    return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

export function estimateReadingTime(content: string | null | undefined): number {
    if (!content?.trim())
        return 0;
    return content.trim().split(/\s+/).filter(Boolean).length;
}

export function splitParagraphs(content: string): string[] {
    return content
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);
}

export type ArticleFetchResult = {
    items: BlogArticle[];
    total: number;
    error?: string;
};

export async function fetchPublishedArticles(options: {
    offset: number;
    category?: string;
    search?: string;
    limit?: number;
}): Promise<ArticleFetchResult> {
    const params = new URLSearchParams({
        limit: String(options.limit ?? BLOG_PAGE_LIMIT),
        offset: String(Math.max(0, options.offset)),
    });
    if (options.category)
        params.set('category', options.category);
    if (options.search?.trim())
        params.set('search', options.search.trim());
    try {
        const res = await fetch(`/api/articles?${params.toString()}`);
        if (!res.ok) {
            const json = (await res.json().catch(() => null)) as { error?: string } | null;
            return { items: [], total: 0, error: json?.error ?? 'Gagal memuat artikel.' };
        }
        const json = (await res.json()) as { articles: BlogArticle[]; total: number };
        return { items: json.articles ?? [], total: json.total ?? (json.articles ?? []).length };
    }
    catch {
        return { items: [], total: 0, error: 'Periksa koneksi lalu coba lagi.' };
    }
}
