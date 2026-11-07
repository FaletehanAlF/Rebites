import { NextRequest, NextResponse } from 'next/server';
import { createAnonServerClient } from '@/lib/server/supabase';
export const runtime = 'nodejs';
const ARTICLE_DETAIL_SELECT = [
    'id',
    'title',
    'slug',
    'excerpt',
    'content',
    'cover_image',
    'category',
    'tags',
    'published_at',
    'created_at',
].join(', ');
const MAX_SLUG_LENGTH = 200;
export async function GET(_req: NextRequest, { params }: {
    params: {
        slug: string;
    };
}) {
    try {
        const slug = params.slug?.trim().slice(0, MAX_SLUG_LENGTH);
        if (!slug) {
            return NextResponse.json({ error: 'Slug artikel wajib.' }, { status: 400 });
        }
        const db = createAnonServerClient();
        const nowIso = new Date().toISOString();
        const { data, error } = await db
            .from('articles')
            .select(ARTICLE_DETAIL_SELECT)
            .eq('slug', slug)
            .eq('status', 'published')
            .not('published_at', 'is', null)
            .lte('published_at', nowIso)
            .maybeSingle();
        if (error) {
            console.error('[articles/[slug]] fetch error', error.message);
            return NextResponse.json({ error: 'Gagal memuat artikel.' }, { status: 500 });
        }
        if (!data) {
            return NextResponse.json({ error: 'Artikel tidak ditemukan.' }, { status: 404 });
        }
        return NextResponse.json({ article: data });
    }
    catch (err) {
        console.error('[articles/[slug]] unexpected', err);
        const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
