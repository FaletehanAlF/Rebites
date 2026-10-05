import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  getAdminUser,
  getUserFromBearer,
} from '@/lib/server/supabase';
import {
  resolveSellerStatus,
  type SellerStatus,
} from '@/lib/server/seller-status';

export const runtime = 'nodejs';

/**
 * GET /api/admin/users/:id
 * Detail satu pengguna untuk admin (read-only).
 * has_umkm / seller_status ditentukan dari keberadaan umkm_profiles
 * (user_id) dan subscription aktif-periode, BUKAN dari profiles.role.
 * Auth: Authorization: Bearer <supabase access_token admin>
 */

const USER_SELECT = [
  'id',
  'email',
  'full_name',
  'role',
  'phone',
  'is_verified',
  'created_at',
].join(', ');

const UMKM_SELECT = [
  'id',
  'business_name',
  'slug',
  'description',
  'category',
  'is_verified',
  'address',
  'city',
  'postal_code',
  'phone',
].join(', ');

const SUB_SELECT = [
  'status',
  'billing',
  'price_paid',
  'current_period_start',
  'current_period_end',
  'created_at',
  'plans(name)',
].join(', ');

type Row = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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
      return NextResponse.json({ error: 'ID pengguna wajib.' }, { status: 400 });
    }

    const db = createAuthedServerClient(authHeader);

    // Dua query langsung (profil + toko miliknya), bukan N+1.
    const [{ data: profile, error: profileErr }, { data: umkm, error: umkmErr }] =
      await Promise.all([
        db.from('profiles').select(USER_SELECT).eq('id', id).maybeSingle(),
        db.from('umkm_profiles').select(UMKM_SELECT).eq('user_id', id).maybeSingle(),
      ]);

    if (profileErr) {
      console.error('[admin/users/detail] fetch error', profileErr.message);
      return NextResponse.json({ error: 'Gagal memuat detail pengguna.' }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 });
    }
    if (umkmErr) {
      console.error('[admin/users/detail] umkm error', umkmErr.message);
    }

    const row = (profile as unknown) as Row;
    const store = ((umkm ?? null) as unknown) as Row | null;

    // Subscription terbaru milik toko ini (pola subscription-storage.ts:
    // order created_at desc, ambil pertama). Bukan N+1: satu query.
    const storeId = store ? asString(store.id) : null;
    const { data: latestSub, error: subErr } = storeId
      ? await db
          .from('subscriptions')
          .select(SUB_SELECT)
          .eq('umkm_id', storeId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null, error: null };

    if (subErr) {
      console.error('[admin/users/detail] subs error', subErr.message);
    }

    const sub = ((latestSub ?? null) as unknown) as Row | null;
    const seller_status: SellerStatus = resolveSellerStatus(store !== null, sub);
    const plan = (sub?.plans ?? null) as Row | null;

    return NextResponse.json({
      user: {
        id: row.id ?? null,
        email: row.email ?? null,
        full_name: row.full_name ?? null,
        role: row.role ?? null,
        phone: row.phone ?? null,
        is_verified: row.is_verified ?? false,
        created_at: row.created_at ?? null,
        has_umkm: store !== null,
        umkm: store
          ? {
              id: store.id ?? null,
              business_name: store.business_name ?? null,
              slug: store.slug ?? null,
              is_verified: store.is_verified ?? false,
              address: store.address ?? null,
              city: store.city ?? null,
              postal_code: store.postal_code ?? null,
              phone: store.phone ?? null,
            }
          : null,
        seller_status,
        seller: store
          ? {
              umkm_id: store.id ?? null,
              business_name: store.business_name ?? null,
              slug: store.slug ?? null,
              description: store.description ?? null,
              category: store.category ?? null,
              address: store.address ?? null,
              city: store.city ?? null,
              postal_code: store.postal_code ?? null,
              phone: store.phone ?? null,
              is_verified: store.is_verified ?? false,
              subscription: sub
                ? {
                    plan_name: plan ? (asString(plan.name) ?? null) : null,
                    status: sub.status ?? null,
                    current_period_start: sub.current_period_start ?? null,
                    current_period_end: sub.current_period_end ?? null,
                  }
                : null,
            }
          : null,
      },
    });
  } catch (err) {
    console.error('[admin/users/detail] unexpected', err);
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
