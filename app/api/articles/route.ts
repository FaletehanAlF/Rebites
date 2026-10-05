import { NextRequest, NextResponse } from 'next/server';
import { createAnonServerClient } from '@/lib/server/supabase';

export const runtime = 'nodejs';

/**
 * GET /api/articles?limit=10&offset=0&search=&category=
 * Daftar artikel published untuk public (read-only, tanpa auth).
 *
 * Fase 3A: PUBLIC READ SAJA. Tidak ada endpoint write di fase ini.
 * - Hanya status='published' + published_at NOT NULL + published_at <= now().
 * - Draft/archived tidak pernah dikembalikan (filter eksplisit + RLS).
 * - Client anon (bukan service_role) sehingga RLS articles_select_public tetap berlaku.
 * - Proyeksi eksplisit: tanpa content, author_id, umkm_id, status, updated_at.
 */

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

function sanitizeSearch(raw: string | null): string {
  if (!raw) return '';
  return raw.trim().slice(0, MAX_SEARCH_LENGTH).replace(/[%(),]/g, '');
}

function sanitizeCategory(raw: string | null): string {
  if (!raw) return '';
  return raw.trim().slice(0, MAX_CATEGORY_LENGTH).replace(/[%(),]/g, '');
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
    const search = sanitizeSearch(params.get('search'));
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
  } catch (err) {
    console.error('[articles] unexpected', err);
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
