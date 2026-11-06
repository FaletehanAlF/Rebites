import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  getAdminUser,
  getUserFromBearer,
  isSupabaseUnavailable,
  upstreamUnavailableResponse,
} from '@/lib/server/supabase';
import { COVER_IMAGE_ERROR, isArticleCoverUrl } from '@/lib/article-cover';
import { sanitizeSearchTerm } from '@/lib/filter-search';

export const runtime = 'nodejs';

/**
 * GET /api/admin/articles?limit=20&offset=0&search=&status=
 * Daftar SEMUA artikel (draft/published/archived) untuk admin.
 * Public GET /api/articles hanya mengembalikan published, sehingga
 * endpoint ini diperlukan agar admin dapat mengelola draft.
 * Filter status: draft | published | archived (allowlist).
 * Auth: Authorization: Bearer <supabase access_token admin>
 */

const ADMIN_LIST_SELECT = [
  'id',
  'title',
  'slug',
  'excerpt',
  // `content` SENGAJA tidak diambil di daftar. Artikel bisa 50.000 karakter;
  // 20 baris per halaman berarti hingga ~1 MB JSON hanya untuk menampilkan
  // judul + status. Isi artikel diambil per artikel lewat GET /:id saat
  // admin membuka pratinjau atau form ubah.
  'cover_image',
  'status',
  'published_at',
  'author_id',
  'umkm_id',
  'category',
  'tags',
  'created_at',
  'updated_at',
].join(', ');

const STATUS_FILTERS = ['draft', 'published', 'archived'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

type ProfileRow = Record<string, unknown>;

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const admin = await getAdminUser(authHeader);
    if (!admin) {
      const user = await getUserFromBearer(authHeader);
      return NextResponse.json(
        { error: user ? 'Akses ditolak. Hanya admin.' : 'Unauthorized. Silakan login ulang.' },
        { status: user ? 403 : 401 }
      );
    }

    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
    }

    const params = req.nextUrl.searchParams;
    const rawLimit = Number(params.get('limit') ?? '20');
    const rawOffset = Number(params.get('offset') ?? '0');
    const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 20;
    const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;
    const search = sanitizeSearchTerm(params.get('search'));
    const statusRaw = (params.get('status') ?? '').trim();
    const statusFilter: StatusFilter | null = (
      STATUS_FILTERS as readonly string[]
    ).includes(statusRaw)
      ? (statusRaw as StatusFilter)
      : null;
    if (statusRaw && !statusFilter) {
      return NextResponse.json(
        { error: 'Filter tidak valid. Nilai yang diizinkan: draft, published, archived.' },
        { status: 400 }
      );
    }

    const db = createAuthedServerClient(authHeader);

    let query = db
      .from('articles')
      .select(ADMIN_LIST_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    if (search) {
      const pattern = `%${search}%`;
      query = query.or(`title.ilike.${pattern},excerpt.ilike.${pattern}`);
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error('[admin/articles] list error', error.message);
      return NextResponse.json({ error: 'Gagal memuat daftar artikel.' }, { status: 500 });
    }

    // Batch profiles author (bukan N+1), pola admin/umkm.
    const rows = ((data ?? []) as unknown) as ProfileRow[];
    const authorIds = Array.from(
      new Set(
        rows
          .map((r) => r.author_id)
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
      )
    );
    const authors = new Map<string, ProfileRow>();
    if (authorIds.length > 0) {
      const { data: profiles, error: profErr } = await db
        .from('profiles')
        .select('id, full_name, email')
        .in('id', authorIds);
      if (profErr) {
        console.error('[admin/articles] authors error', profErr.message);
      } else {
        for (const p of ((profiles ?? []) as unknown) as ProfileRow[]) {
          if (typeof p.id === 'string') authors.set(p.id, p);
        }
      }
    }

    const articles = rows.map((r) => {
      const author =
        typeof r.author_id === 'string' ? authors.get(r.author_id) ?? null : null;
      return {
        ...r,
        author: author
          ? { id: author.id ?? null, full_name: author.full_name ?? null, email: author.email ?? null }
          : null,
      };
    });

    return NextResponse.json({
      articles,
      total: count ?? articles.length,
      limit,
      offset,
    });
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[admin/articles] list unexpected', err);
    // Pesan internal (stack trace, detail TLS/query) hanya ke log server;
    // client menerima pesan publik agar tidak ada informasi internal yang bocor.
    return NextResponse.json({ error: "Gagal memproses artikel." }, { status: 500 });
  }
}

/**
 * POST /api/admin/articles
 * Buat artikel baru (khusus admin). Fase 3B: CRUD SAJA, tanpa publish/unpublish.
 *
 * Rules:
 * - status selalu 'draft' (dipaksa server, tidak dibaca dari body).
 * - published_at selalu NULL (publishing hanya via Fase 3C nanti).
 * - id/status/published_at/created_at/updated_at dari body diabaikan.
 * - author_id TIDAK dibaca dari body; selalu admin pembuat (admin.id)
 *   agar author artikel merepresentasikan ReBites.
 * - umkm_id opsional; bila diisi harus menunjuk UMKM yang ada.
 * - Memakai authed client (bukan service-role) agar RLS articles_admin_all
 *   (public.is_admin()) tetap dihormati.
 * Auth: Authorization: Bearer <supabase access_token admin>
 */

const MAX_TITLE_LENGTH = 200;
const MAX_SLUG_LENGTH = 200;
const MAX_EXCERPT_LENGTH = 500;
const MAX_CONTENT_LENGTH = 50000;
const MAX_COVER_IMAGE_LENGTH = 1000;
const MAX_CATEGORY_LENGTH = 100;
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 50;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ArticleBody = {
  title?: unknown;
  slug?: unknown;
  excerpt?: unknown;
  content?: unknown;
  cover_image?: unknown;
  umkm_id?: unknown;
  category?: unknown;
  tags?: unknown;
};

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTags(value: unknown): { ok: boolean; tags?: string[] } {
  if (value === undefined || value === null) return { ok: true };
  if (!Array.isArray(value)) return { ok: false };
  if (value.length > MAX_TAGS) return { ok: false };
  const tags: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') return { ok: false };
    const t = item.trim();
    if (!t) continue;
    if (t.length > MAX_TAG_LENGTH) return { ok: false };
    tags.push(t);
  }
  return { ok: true, tags };
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const admin = await getAdminUser(authHeader);
    if (!admin) {
      const user = await getUserFromBearer(authHeader);
      return NextResponse.json(
        { error: user ? 'Akses ditolak. Hanya admin.' : 'Unauthorized. Silakan login ulang.' },
        { status: user ? 403 : 401 }
      );
    }

    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as ArticleBody | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body JSON tidak valid.' }, { status: 400 });
    }

    const title = asTrimmed(body.title);
    if (!title) {
      return NextResponse.json({ error: 'Title wajib diisi.' }, { status: 400 });
    }
    if (title.length > MAX_TITLE_LENGTH) {
      return NextResponse.json(
        { error: `Title maksimal ${MAX_TITLE_LENGTH} karakter.` },
        { status: 400 }
      );
    }

    const slug = asTrimmed(body.slug);
    if (!slug) {
      return NextResponse.json({ error: 'Slug wajib diisi.' }, { status: 400 });
    }
    if (slug.length > MAX_SLUG_LENGTH || !SLUG_RE.test(slug)) {
      return NextResponse.json(
        { error: 'Slug tidak valid. Gunakan huruf kecil, angka, dan strip (mis. promo-akhir-pekan).' },
        { status: 400 }
      );
    }

    const content = asTrimmed(body.content);
    if (!content) {
      return NextResponse.json({ error: 'Content wajib diisi.' }, { status: 400 });
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { error: `Content maksimal ${MAX_CONTENT_LENGTH} karakter.` },
        { status: 400 }
      );
    }

    const excerptRaw = asTrimmed(body.excerpt);
    if (excerptRaw.length > MAX_EXCERPT_LENGTH) {
      return NextResponse.json(
        { error: `Excerpt maksimal ${MAX_EXCERPT_LENGTH} karakter.` },
        { status: 400 }
      );
    }

    const coverImageRaw = asTrimmed(body.cover_image);
    if (coverImageRaw.length > MAX_COVER_IMAGE_LENGTH) {
      return NextResponse.json(
        { error: `Cover image maksimal ${MAX_COVER_IMAGE_LENGTH} karakter.` },
        { status: 400 }
      );
    }
    if (
      coverImageRaw &&
      !isArticleCoverUrl(coverImageRaw, process.env.NEXT_PUBLIC_SUPABASE_URL)
    ) {
      return NextResponse.json({ error: COVER_IMAGE_ERROR }, { status: 400 });
    }

    const umkmIdRaw = asTrimmed(body.umkm_id);
    if (umkmIdRaw && !UUID_RE.test(umkmIdRaw)) {
      return NextResponse.json({ error: 'umkm_id tidak valid.' }, { status: 400 });
    }

    const categoryRaw = asTrimmed(body.category);
    if (categoryRaw.length > MAX_CATEGORY_LENGTH) {
      return NextResponse.json(
        { error: `Category maksimal ${MAX_CATEGORY_LENGTH} karakter.` },
        { status: 400 }
      );
    }

    const tagsRes = normalizeTags(body.tags);
    if (!tagsRes.ok) {
      return NextResponse.json(
        { error: `Tags harus berupa array string (maksimal ${MAX_TAGS} item, ${MAX_TAG_LENGTH} karakter per item).` },
        { status: 400 }
      );
    }

    const db = createAuthedServerClient(authHeader);

    if (umkmIdRaw) {
      const { data: umkm, error: umkmErr } = await db
        .from('umkm_profiles')
        .select('id')
        .eq('id', umkmIdRaw)
        .maybeSingle();
      if (umkmErr) {
        console.error('[admin/articles] umkm check error', umkmErr.message);
        return NextResponse.json({ error: 'Gagal memvalidasi UMKM.' }, { status: 500 });
      }
      if (!umkm) {
        return NextResponse.json({ error: 'umkm_id tidak ditemukan.' }, { status: 400 });
      }
    }

    const { data: slugTaken, error: slugErr } = await db
      .from('articles')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (slugErr) {
      console.error('[admin/articles] slug check error', slugErr.message);
      return NextResponse.json({ error: 'Gagal memvalidasi slug.' }, { status: 500 });
    }
    if (slugTaken) {
      return NextResponse.json({ error: 'Slug sudah digunakan artikel lain.' }, { status: 409 });
    }

    // status/published_at dipaksa server (Fase 3B tanpa publish).
    // id/created_at/updated_at tidak pernah dibaca dari body.
    // author_id selalu admin pembuat (body.author_id diabaikan bila dikirim).
    const payload: Record<string, unknown> = {
      title,
      slug,
      excerpt: excerptRaw ? excerptRaw : null,
      content,
      cover_image: coverImageRaw ? coverImageRaw : null,
      author_id: admin.id,
      umkm_id: umkmIdRaw ? umkmIdRaw : null,
      category: categoryRaw ? categoryRaw : null,
      status: 'draft',
      published_at: null,
    };
    if (tagsRes.tags !== undefined) {
      payload.tags = tagsRes.tags;
    }

    const { data: created, error: insErr } = await db
      .from('articles')
      .insert(payload)
      .select()
      .maybeSingle();

    if (insErr) {
      console.error('[admin/articles] insert error', insErr.message);
      if ((insErr as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'Slug sudah digunakan artikel lain.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Gagal membuat artikel.' }, { status: 500 });
    }
    if (!created) {
      return NextResponse.json({ error: 'Gagal membuat artikel.' }, { status: 500 });
    }

    return NextResponse.json({ article: created }, { status: 201 });
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[admin/articles] unexpected', err);
    // Pesan internal (stack trace, detail TLS/query) hanya ke log server;
    // client menerima pesan publik agar tidak ada informasi internal yang bocor.
    return NextResponse.json({ error: "Gagal memproses artikel." }, { status: 500 });
  }
}
