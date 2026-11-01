import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  getAdminUser,
  getUserFromBearer,
  isSupabaseUnavailable,
  upstreamUnavailableResponse,
} from '@/lib/server/supabase';

export const runtime = 'nodejs';

/**
 * GET /api/admin/moderation-logs?limit=20&offset=0
 * Riwayat tindakan verifikasi produk (read-only, khusus admin).
 * Auth: Authorization: Bearer <supabase access_token admin>
 */

const HISTORY_SELECT = [
  'id',
  'product_id',
  'action',
  'reason',
  'created_at',
  'moderator:profiles(id, full_name, email)',
  'product:products(id, name, image_url, umkm_id, umkm:umkm_profiles(id, business_name, logo_url))',
].join(', ');

type ModerationLogRow = Record<string, unknown>;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

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
      .from('moderation_logs')
      .select(HISTORY_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[admin/moderation-logs] fetch error', error.message);
      return NextResponse.json({ error: 'Gagal memuat riwayat moderasi.' }, { status: 500 });
    }

    const logs = (data ?? []).map((row) => {
      const r = row as unknown as ModerationLogRow;
      const moderator = asRecord(r.moderator);
      const product = asRecord(r.product);
      const umkm = asRecord(product?.umkm);
      return {
        id: asString(r.id) ?? '',
        productId: asString(r.product_id) ?? asString(product?.id) ?? '',
        productName: asString(product?.name) ?? 'Tidak diketahui',
        productImageUrl: asString(product?.image_url),
        businessName: asString(umkm?.business_name) ?? 'Tidak diketahui',
        businessLogoUrl: asString(umkm?.logo_url),
        action: r.action === 'reject' ? 'reject' : 'approve',
        reason: asString(r.reason),
        moderatorName:
          asString(moderator?.full_name) ??
          asString(moderator?.email) ??
          'Tidak diketahui',
        moderatorEmail: asString(moderator?.email),
        createdAt: asString(r.created_at) ?? '',
      };
    });

    return NextResponse.json({
      logs,
      total: count ?? logs.length,
      limit,
      offset,
    });
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[admin/moderation-logs] unexpected', err);
    // Pesan internal (stack trace, detail TLS/query) hanya ke log server;
    // client menerima pesan publik agar tidak ada informasi internal yang bocor.
    return NextResponse.json({ error: "Gagal memuat log moderasi." }, { status: 500 });
  }
}
