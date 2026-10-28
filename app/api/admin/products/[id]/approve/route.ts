import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  getAdminUser,
  getUserFromBearer,
  isSupabaseUnavailable,
  upstreamUnavailableResponse,
} from '@/lib/server/supabase';
import { notifySellerModeration } from '@/lib/server/moderation-notifications';

export const runtime = 'nodejs';

/**
 * POST /api/admin/products/:id/approve
 * Setujui produk (khusus admin). Body tidak diperlukan.
 * Mendukung auto-approve era post-publish monitoring:
 *   - pending -> approved  (approve antrean lama)
 *   - rejected -> approved (restore setelah takedown)
 * Produk yang sudah approved ditolak dengan 409.
 * Auth: Authorization: Bearer <supabase access_token admin>
 */

type ProductRow = Record<string, unknown>;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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
    if (!id) {
      return NextResponse.json({ error: 'ID produk wajib.' }, { status: 400 });
    }

    const db = createAuthedServerClient(authHeader);

    const { data: existing, error: fetchErr } = await db
      .from('products')
      .select('id, verification_status')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      console.error('[admin/products/approve] fetch error', fetchErr.message);
      return NextResponse.json({ error: 'Gagal memuat produk.' }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: 'Produk tidak ditemukan.' }, { status: 404 });
    }

    const current = (existing as ProductRow).verification_status as string | null;
    if (current !== 'pending' && current !== 'rejected') {
      return NextResponse.json(
        { error: `Produk sudah aktif (status: ${current}). Hanya produk pending/rejected yang bisa disetujui.` },
        { status: 409 }
      );
    }

    // Conditional update sebagai proteksi balapan antar admin.
    const { data: updated, error: updErr } = await db
      .from('products')
      .update({
        verification_status: 'approved',
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      })
      .eq('id', id)
      .eq('verification_status', current)
      .select()
      .maybeSingle();

    if (updErr) {
      console.error('[admin/products/approve] update error', updErr.message);
      return NextResponse.json({ error: 'Gagal menyetujui produk.' }, { status: 500 });
    }
    if (!updated) {
      return NextResponse.json(
        { error: 'Produk sudah dimoderasi admin lain. Muat ulang antrean.' },
        { status: 409 }
      );
    }

    const { error: logErr } = await db.from('moderation_logs').insert({
      product_id: id,
      moderator_id: admin.id,
      action: 'approve',
      reason: null,
    });

    if (logErr) {
      console.error('[admin/products/approve] log error', logErr.message);
      return NextResponse.json(
        { error: 'Produk disetujui, tetapi riwayat moderasi gagal dicatat.' },
        { status: 500 }
      );
    }

    try {
      const { data: product } = await db
        .from('products')
        .select('umkm_id, name')
        .eq('id', id)
        .maybeSingle();
      const umkmId = (product as ProductRow | null)?.umkm_id as
        | string
        | undefined;
      const productName = (product as ProductRow | null)?.name as
        | string
        | undefined;
      if (umkmId) {
        const { data: umkm } = await db
          .from('umkm_profiles')
          .select('user_id')
          .eq('id', umkmId)
          .maybeSingle();
        const sellerUserId = (umkm as ProductRow | null)?.user_id as
          | string
          | undefined;
        if (sellerUserId) {
          await notifySellerModeration(db, {
            productId: id,
            umkmUserId: sellerUserId,
            productName: productName ?? 'Produk',
            verdict: 'approved',
          });
        }
      }
    } catch (notifErr) {
      console.error(
        '[admin/products/approve] notification error',
        notifErr instanceof Error ? notifErr.message : notifErr
      );
    }

    return NextResponse.json({ product: updated });
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[admin/products/approve] unexpected', err);
    // Pesan internal (stack trace, detail TLS/query) hanya ke log server;
    // client menerima pesan publik agar tidak ada informasi internal yang bocor.
    return NextResponse.json({ error: "Gagal memproses produk." }, { status: 500 });
  }
}
