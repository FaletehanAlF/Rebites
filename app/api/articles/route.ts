import { NextRequest, NextResponse } from 'next/server';
import { createAnonServerClient } from '@/lib/server/supabase';
import { sanitizeSearchTerm } from '@/lib/filter-search';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const ARTICLE_LIST_SELECT = [
    'id',
    'title',
    'slug',
    'excerpt',
    'cover_image',
    'category',
    'tags',
    'published_at',
    'created_at',
].join(', ');
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_SEARCH_LENGTH = 100;
const MAX_CATEGORY_LENGTH = 50;
function sanitizeCategory(raw: string | null): string {
    if (!raw)
        return '';
    return sanitizeSearchTerm(raw, MAX_CATEGORY_LENGTH);
}
export async function GET(req: NextRequest) {
    try {
        const params = req.nextUrl.searchParams;
        const rawLimit = Number(params.get('limit') ?? String(DEFAULT_LIMIT));
        const rawOffset = Number(params.get('offset') ?? '0');
        const limit = Number.isFinite(rawLimit)
            ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(rawLimit)))
            : DEFAULT_LIMIT;
        const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;
        const search = sanitizeSearchTerm(params.get('search'), MAX_SEARCH_LENGTH);
        const category = sanitizeCategory(params.get('category'));
        const db = createAnonServerClient();
        const nowIso = new Date().toISOString();
        let query = db
            .from('articles')
            .select(ARTICLE_LIST_SELECT, { count: 'exact' })
            .eq('status', 'published')
            .not('published_at', 'is', null)
            .lte('published_at', nowIso)
            .order('published_at', { ascending: false })
            .order('created_at', { ascending: false });
        if (category) {
            query = query.eq('category', category);
        }
        if (search) {
            const pattern = `%${search}%`;
            query = query.or(`title.ilike.${pattern},excerpt.ilike.${pattern}`);
        }
        const { data, error, count } = await query.range(offset, offset + limit - 1);
        if (error) {
            console.error('[articles] fetch error', error.message);
            return NextResponse.json({ error: 'Gagal memuat daftar artikel.' }, { status: 500 });
        }
        return NextResponse.json({
            articles: data ?? [],
            total: count ?? (data ?? []).length,
            limit,
            offset,
        });
    }
    catch (err) {
        console.error('[articles] unexpected', err);
        const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
