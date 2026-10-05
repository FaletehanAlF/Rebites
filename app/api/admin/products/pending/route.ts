import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  getAdminUser,
  getUserFromBearer,
} from '@/lib/server/supabase';

export const runtime = 'nodejs';

/**
 * GET /api/admin/products/pending?limit=20&offset=0
 * Daftar antrean produk menunggu verifikasi (khusus admin).
 * Auth: Authorization: Bearer <supabase access_token admin>
 */

const PENDING_SELECT = [
  'id',
  'umkm_id',
  'slug',
  'name',
  'description',
  'image_url',
  'category',
  'original_price',
  'surplus_price',
  'stock',
  'status',
  'verification_status',
  'rejection_reason',
  'reviewed_at',
  'reviewed_by',
  'created_at',
  'umkm:umkm_profiles(id, business_name, is_verified, logo_url)',
].join(', ');

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

    const db = createAuthedServerClient(authHeader);
    const { data, error, count } = await db
      .from('products')
      .select(PENDING_SELECT, { count: 'exact' })
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[admin/products/pending] fetch error', error.message);
      return NextResponse.json({ error: 'Gagal memuat antrean verifikasi.' }, { status: 500 });
    }

    return NextResponse.json({
      products: data ?? [],
      total: count ?? (data ?? []).length,
      limit,
      offset,
    });
  } catch (err) {
    console.error('[admin/products/pending] unexpected', err);
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
