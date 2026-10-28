import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  getAdminUser,
  getUserFromBearer,
  isSupabaseUnavailable,
  upstreamUnavailableResponse,
} from '@/lib/server/supabase';
import { COVER_IMAGE_ERROR, isArticleCoverUrl } from '@/lib/article-cover';

export const runtime = 'nodejs';

/**
 * PATCH /api/admin/articles/:id/publish
 * Publish/unpublish artikel (khusus admin). Body: { "published": boolean }.
 *
 * Fase 3C: PUBLISH/UNPUBLISH SAJA.
 * - published=true  -> status='published', published_at=now().
 * - published=false -> status='draft', published_at=null.
 * - Hanya kolom status + published_at yang diubah; title/slug/content/
 *   author/category/tags/cover_image tidak disentuh.
 * - Publish ditolak bila title/slug/content kosong (field wajib schema).
 * - Publish ditolak bila cover_image terisi URL eksternal (bukan bucket
 *   article-images); cover kosong tetap boleh publish (opsional).
 * - Conditional update (ID + kondisi status, pola approve/reject produk)
 *   sebagai proteksi balapan antar admin.
 * - Memakai authed client (bukan service-role) agar RLS articles_admin_all
 *   (public.is_admin()) tetap dihormati.
 * Auth: Authorization: Bearer <supabase access_token admin>
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown>;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
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

    const id = params.id?.trim();
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: 'ID artikel tidak valid.' }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as {
      published?: unknown;
    } | null;
    if (!body || typeof body !== 'object' || typeof body.published !== 'boolean') {
      return NextResponse.json({ error: 'Field published wajib boolean.' }, { status: 400 });
    }
    const wantPublished = body.published;

    const db = createAuthedServerClient(authHeader);

    const { data: existing, error: fetchErr } = await db
      .from('articles')
      .select('id, title, slug, content, cover_image, status')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) {
      console.error('[admin/articles/publish] fetch error', fetchErr.message);
      return NextResponse.json({ error: 'Gagal memuat artikel.' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Artikel tidak ditemukan.' }, { status: 404 });
    }

    const row = (existing as unknown) as Row;
    const currentStatus = typeof row.status === 'string' ? row.status : null;

    if (wantPublished) {
      if (currentStatus === 'published') {
        return NextResponse.json(
          { error: 'Artikel sudah published. Tidak ada perubahan.' },
          { status: 409 }
        );
      }
      const title = typeof row.title === 'string' ? row.title.trim() : '';
      const slug = typeof row.slug === 'string' ? row.slug.trim() : '';
      const content = typeof row.content === 'string' ? row.content.trim() : '';
      if (!title || !slug || !content) {
        return NextResponse.json(
          { error: 'Artikel tidak dapat dipublish. Title, slug, dan content wajib terisi.' },
          { status: 400 }
        );
      }
      // Tolak publish bila cover terisi URL eksternal (bukan bucket article-images).
      // Artikel lama tidak diubah/dihapus otomatis; publish diblokir agar URL
      // eksternal (mis. pinimg) tidak lolos ke landing dan merusak next/image.
      const cover = typeof row.cover_image === 'string' ? row.cover_image.trim() : '';
      if (cover && !isArticleCoverUrl(cover, process.env.NEXT_PUBLIC_SUPABASE_URL)) {
        return NextResponse.json({ error: COVER_IMAGE_ERROR }, { status: 400 });
      }

      // Conditional update: hanya row yang belum published (proteksi balapan).
      const { data: updated, error: pubErr } = await db
        .from('articles')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', id)
        .neq('status', 'published')
        .select()
        .maybeSingle();
      if (pubErr) {
        console.error('[admin/articles/publish] publish error', pubErr.message);
        return NextResponse.json({ error: 'Gagal mempublish artikel.' }, { status: 500 });
      }
      if (!updated) {
        return NextResponse.json(
          { error: 'Artikel sudah diubah admin lain. Muat ulang data.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ article: updated });
    }

    if (currentStatus === 'draft') {
      return NextResponse.json(
        { error: 'Artikel sudah draft. Tidak ada perubahan.' },
        { status: 409 }
      );
    }

    // Conditional update: hanya row yang belum draft (proteksi balapan).
    const { data: updated, error: unpubErr } = await db
      .from('articles')
      .update({ status: 'draft', published_at: null })
      .eq('id', id)
      .neq('status', 'draft')
      .select()
      .maybeSingle();
    if (unpubErr) {
      console.error('[admin/articles/publish] unpublish error', unpubErr.message);
      return NextResponse.json({ error: 'Gagal mengembalikan artikel ke draft.' }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json(
        { error: 'Artikel sudah diubah admin lain. Muat ulang data.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ article: updated });
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[admin/articles/publish] unexpected', err);
    // Pesan internal (stack trace, detail TLS/query) hanya ke log server;
    // client menerima pesan publik agar tidak ada informasi internal yang bocor.
    return NextResponse.json({ error: "Gagal memproses artikel." }, { status: 500 });
  }
}
