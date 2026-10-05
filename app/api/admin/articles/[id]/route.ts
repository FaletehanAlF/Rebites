import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  getAdminUser,
  getUserFromBearer,
} from '@/lib/server/supabase';
import { COVER_IMAGE_ERROR, isArticleCoverUrl } from '@/lib/article-cover';

export const runtime = 'nodejs';

/**
 * PUT /api/admin/articles/:id — ubah field konten artikel (khusus admin).
 * DELETE /api/admin/articles/:id — hapus artikel by UUID (khusus admin).
 *
 * Fase 3B: CRUD SAJA, tanpa publish/unpublish.
 * - PUT tidak pernah menyentuh status/published_at (diabaikan dari body,
 *   tidak ada di payload update) sehingga artikel tidak bisa berubah
 *   published melalui endpoint ini. Publishing hanya via Fase 3C nanti.
 * - id/created_at/updated_at tidak bisa diubah (updated_at via trigger DB).
 * - author_id TIDAK bisa diubah (diabaikan dari body); author artikel
 *   selalu merepresentasikan ReBites dan ditentukan saat create.
 * - Slug yang diubah tetap harus unik.
 * - DELETE by UUID saja (bukan slug), tanpa cleanup file cover_image
 *   (storage cleanup ditangani terpisah).
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

type Row = Record<string, unknown>;

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
  if (value === undefined) return { ok: true };
  if (value === null) return { ok: true, tags: [] };
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

async function requireAdmin(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const admin = await getAdminUser(authHeader);
  if (!admin) {
    const user = await getUserFromBearer(authHeader);
    return {
      error: NextResponse.json(
        { error: user ? 'Akses ditolak. Hanya admin.' : 'Unauthorized. Silakan login ulang.' },
        { status: user ? 403 : 401 }
      ),
    };
  }
  if (!authHeader) {
    return {
      error: NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 }),
    };
  }
  return { admin, authHeader };
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;

    const id = params.id?.trim();
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: 'ID artikel tidak valid.' }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as ArticleBody | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body JSON tidak valid.' }, { status: 400 });
    }

    // Hanya field konten yang boleh diubah. status/published_at/id/
    // created_at/updated_at/author_id sengaja tidak dibaca dari body.
    const update: Record<string, unknown> = {};
    let slugChanged: string | null = null;
    let umkmChanged: string | null | undefined;

    if (body.title !== undefined) {
      const title = asTrimmed(body.title);
      if (!title) {
        return NextResponse.json({ error: 'Title tidak boleh kosong.' }, { status: 400 });
      }
      if (title.length > MAX_TITLE_LENGTH) {
        return NextResponse.json(
          { error: `Title maksimal ${MAX_TITLE_LENGTH} karakter.` },
          { status: 400 }
        );
      }
      update.title = title;
    }

    if (body.slug !== undefined) {
      const slug = asTrimmed(body.slug);
      if (!slug) {
        return NextResponse.json({ error: 'Slug tidak boleh kosong.' }, { status: 400 });
      }
      if (slug.length > MAX_SLUG_LENGTH || !SLUG_RE.test(slug)) {
        return NextResponse.json(
          { error: 'Slug tidak valid. Gunakan huruf kecil, angka, dan strip (mis. promo-akhir-pekan).' },
          { status: 400 }
        );
      }
      update.slug = slug;
      slugChanged = slug;
    }

    if (body.excerpt !== undefined) {
      const excerpt = asTrimmed(body.excerpt);
      if (excerpt.length > MAX_EXCERPT_LENGTH) {
        return NextResponse.json(
          { error: `Excerpt maksimal ${MAX_EXCERPT_LENGTH} karakter.` },
          { status: 400 }
        );
      }
      update.excerpt = excerpt ? excerpt : null;
    }

    if (body.content !== undefined) {
      const content = asTrimmed(body.content);
      if (!content) {
        return NextResponse.json({ error: 'Content tidak boleh kosong.' }, { status: 400 });
      }
      if (content.length > MAX_CONTENT_LENGTH) {
        return NextResponse.json(
          { error: `Content maksimal ${MAX_CONTENT_LENGTH} karakter.` },
          { status: 400 }
        );
      }
      update.content = content;
    }

    if (body.cover_image !== undefined) {
      const cover = asTrimmed(body.cover_image);
      if (cover.length > MAX_COVER_IMAGE_LENGTH) {
        return NextResponse.json(
          { error: `Cover image maksimal ${MAX_COVER_IMAGE_LENGTH} karakter.` },
          { status: 400 }
        );
      }
      if (cover && !isArticleCoverUrl(cover, process.env.NEXT_PUBLIC_SUPABASE_URL)) {
        return NextResponse.json({ error: COVER_IMAGE_ERROR }, { status: 400 });
      }
      update.cover_image = cover ? cover : null;
    }

    if (body.umkm_id !== undefined) {
      const umkmId = asTrimmed(body.umkm_id);
      if (umkmId && !UUID_RE.test(umkmId)) {
        return NextResponse.json({ error: 'umkm_id tidak valid.' }, { status: 400 });
      }
      update.umkm_id = umkmId ? umkmId : null;
      umkmChanged = umkmId ? umkmId : null;
    }

    if (body.category !== undefined) {
      const category = asTrimmed(body.category);
      if (category.length > MAX_CATEGORY_LENGTH) {
        return NextResponse.json(
          { error: `Category maksimal ${MAX_CATEGORY_LENGTH} karakter.` },
          { status: 400 }
        );
      }
      update.category = category ? category : null;
    }

    if (body.tags !== undefined) {
      const tagsRes = normalizeTags(body.tags);
      if (!tagsRes.ok || tagsRes.tags === undefined) {
        return NextResponse.json(
          { error: `Tags harus berupa array string (maksimal ${MAX_TAGS} item, ${MAX_TAG_LENGTH} karakter per item).` },
          { status: 400 }
        );
      }
      update.tags = tagsRes.tags;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Tidak ada field yang dapat diubah.' }, { status: 400 });
    }

    const db = createAuthedServerClient(auth.authHeader);

    const { data: existing, error: fetchErr } = await db
      .from('articles')
      .select('id, slug')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) {
      console.error('[admin/articles/update] fetch error', fetchErr.message);
      return NextResponse.json({ error: 'Gagal memuat artikel.' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Artikel tidak ditemukan.' }, { status: 404 });
    }

    if (slugChanged && slugChanged !== ((existing as unknown) as Row).slug) {
      const { data: clash, error: clashErr } = await db
        .from('articles')
        .select('id')
        .eq('slug', slugChanged)
        .neq('id', id)
        .maybeSingle();
      if (clashErr) {
        console.error('[admin/articles/update] slug check error', clashErr.message);
        return NextResponse.json({ error: 'Gagal memvalidasi slug.' }, { status: 500 });
      }
      if (clash) {
        return NextResponse.json({ error: 'Slug sudah digunakan artikel lain.' }, { status: 409 });
      }
    }

    if (umkmChanged) {
      const { data: umkm, error: umkmErr } = await db
        .from('umkm_profiles')
        .select('id')
        .eq('id', umkmChanged)
        .maybeSingle();
      if (umkmErr) {
        console.error('[admin/articles/update] umkm check error', umkmErr.message);
        return NextResponse.json({ error: 'Gagal memvalidasi UMKM.' }, { status: 500 });
      }
      if (!umkm) {
        return NextResponse.json({ error: 'umkm_id tidak ditemukan.' }, { status: 400 });
      }
    }

    const { data: updated, error: updErr } = await db
      .from('articles')
      .update(update)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updErr) {
      console.error('[admin/articles/update] update error', updErr.message);
      if ((updErr as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'Slug sudah digunakan artikel lain.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Gagal mengubah artikel.' }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json({ error: 'Artikel tidak ditemukan.' }, { status: 404 });
    }

    return NextResponse.json({ article: updated });
  } catch (err) {
    console.error('[admin/articles/update] unexpected', err);
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(req);
    if ('error' in auth) return auth.error;

    const id = params.id?.trim();
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: 'ID artikel tidak valid.' }, { status: 400 });
    }

    const db = createAuthedServerClient(auth.authHeader);

    const { data: existing, error: fetchErr } = await db
      .from('articles')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) {
      console.error('[admin/articles/delete] fetch error', fetchErr.message);
      return NextResponse.json({ error: 'Gagal memuat artikel.' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Artikel tidak ditemukan.' }, { status: 404 });
    }

    // Hapus by UUID saja; file cover_image di storage sengaja tidak dihapus
    // pada fase ini (cleanup ditangani terpisah).
    const { error: delErr } = await db.from('articles').delete().eq('id', id);
    if (delErr) {
      console.error('[admin/articles/delete] delete error', delErr.message);
      return NextResponse.json({ error: 'Gagal menghapus artikel.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error('[admin/articles/delete] unexpected', err);
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
