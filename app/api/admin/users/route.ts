import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  getAdminUser,
  getUserFromBearer,
  isSupabaseUnavailable,
  upstreamUnavailableResponse,
} from '@/lib/server/supabase';
import {
  resolveSellerStatus,
  type SellerStatus,
} from '@/lib/server/seller-status';
import { isSuperAdminUserId } from '@/lib/admin-access';
import { sanitizeSearchTerm } from '@/lib/filter-search';

export const runtime = 'nodejs';

/**
 * GET /api/admin/users?limit=20&offset=0&search=&sellerStatus=
 * Daftar pengguna terdaftar untuk admin (read-only).
 * has_umkm / seller_status ditentukan dari keberadaan umkm_profiles
 * (user_id) dan subscription aktif-periode, BUKAN dari profiles.role.
 * Filter sellerStatus: active | no_subscription | no_store (allowlist).
 * Auth: Authorization: Bearer <supabase access_token admin>
 */

const USERS_SELECT = [
  'id',
  'email',
  'full_name',
  'role',
  'is_verified',
  'created_at',
].join(', ');

const UMKM_SELECT = ['id', 'user_id', 'business_name', 'slug', 'is_verified'].join(
  ', '
);

// Kolom subscription untuk ringkasan seller (beserta nama paket).
const SUBS_SELECT = [
  'umkm_id',
  'status',
  'billing',
  'price_paid',
  'current_period_start',
  'current_period_end',
  'created_at',
  'plans(name)',
].join(', ');

const SELLER_STATUS_FILTERS: readonly SellerStatus[] = [
  'active',
  'no_subscription',
  'no_store',
];

type Row = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toIdList(ids: string[]): string {
  return `(${ids.join(',')})`;
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
    const search = sanitizeSearchTerm(params.get('search'));
    const sellerFilterRaw = (params.get('sellerStatus') ?? '').trim();
    const sellerFilter: SellerStatus | null = (
      SELLER_STATUS_FILTERS as readonly string[]
    ).includes(sellerFilterRaw)
      ? (sellerFilterRaw as SellerStatus)
      : null;
    if (sellerFilterRaw && !sellerFilter) {
      return NextResponse.json(
        { error: 'Filter tidak valid. Nilai yang diizinkan: active, no_subscription, no_store.' },
        { status: 400 }
      );
    }

    const db = createAuthedServerClient(authHeader);

    // Filter seller_status dihitung sebelum pagination agar total benar.
    // Tahap 1 (hanya bila filter diminta): petakan pemilik toko dan
    // subscription aktif dari batch query (bukan N+1).
    let idFilter: { op: 'in' | 'not-in'; ids: string[] } | null = null;
    if (sellerFilter) {
      const { data: allUmkm, error: allUmkmErr } = await db
        .from('umkm_profiles')
        .select('id, user_id')
        .limit(5000);
      if (allUmkmErr) {
        console.error('[admin/users] umkm ids error', allUmkmErr.message);
        return NextResponse.json({ error: 'Gagal memuat daftar pengguna.' }, { status: 500 });
      }
      const umkmRows = ((allUmkm ?? []) as unknown) as Row[];
      const ownerIds = umkmRows
        .map((u) => u.user_id)
        .filter((v): v is string => typeof v === 'string' && v.length > 0);
      const umkmByOwner = new Map<string, string>();
      for (const u of umkmRows) {
        const uid = asString(u.user_id);
        const umkmId = asString(u.id);
        if (uid && umkmId && !umkmByOwner.has(uid)) umkmByOwner.set(uid, umkmId);
      }

      if (sellerFilter === 'no_store') {
        if (ownerIds.length > 0) idFilter = { op: 'not-in', ids: ownerIds };
      } else {
        // Tentukan pemilik dengan subscription aktif-periode dari
        // subscription terbaru tiap UMKM (pola subscription-storage.ts).
        const { data: allSubs, error: allSubsErr } = await db
          .from('subscriptions')
          .select('umkm_id, status, current_period_end, created_at')
          .order('created_at', { ascending: false })
          .limit(5000);
        if (allSubsErr) {
          console.error('[admin/users] subs ids error', allSubsErr.message);
          return NextResponse.json({ error: 'Gagal memuat daftar pengguna.' }, { status: 500 });
        }
        const latestByUmkm = new Map<string, Row>();
        for (const s of ((allSubs ?? []) as unknown) as Row[]) {
          const key = asString(s.umkm_id);
          if (key && !latestByUmkm.has(key)) latestByUmkm.set(key, s);
        }
        const now = Date.now();
        const activeOwnerIds: string[] = [];
        umkmByOwner.forEach((umkmId, uid) => {
          const latest = latestByUmkm.get(umkmId) ?? null;
          const active =
            latest !== null &&
            latest.status === 'active' &&
            typeof latest.current_period_end === 'string' &&
            Number.isFinite(new Date(latest.current_period_end as string).getTime()) &&
            new Date(latest.current_period_end as string).getTime() > now;
          if (active) activeOwnerIds.push(uid);
        });
        if (sellerFilter === 'active') {
          if (activeOwnerIds.length === 0) {
            return NextResponse.json({ users: [], total: 0, limit, offset });
          }
          idFilter = { op: 'in', ids: activeOwnerIds };
        } else {
          const inactiveOwnerIds = ownerIds.filter((id) => !activeOwnerIds.includes(id));
          if (inactiveOwnerIds.length === 0) {
            return NextResponse.json({ users: [], total: 0, limit, offset });
          }
          idFilter = { op: 'in', ids: inactiveOwnerIds };
        }
      }
    }

    let query = db
      .from('profiles')
      .select(USERS_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (search) {
      const pattern = `%${search}%`;
      query = query.or(`email.ilike.${pattern},full_name.ilike.${pattern}`);
    }
    if (idFilter) {
      query =
        idFilter.op === 'in'
          ? query.in('id', idFilter.ids)
          : query.not('id', 'in', toIdList(idFilter.ids));
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error('[admin/users] fetch error', error.message);
      return NextResponse.json({ error: 'Gagal memuat daftar pengguna.' }, { status: 500 });
    }

    const rows = ((data ?? []) as unknown) as Row[];
    const ids = rows
      .map((r) => r.id)
      .filter((v): v is string => typeof v === 'string');

    // Batch query toko (bukan N+1): satu query untuk semua user di halaman ini.
    const { data: umkmData, error: umkmErr } = ids.length > 0
      ? await db.from('umkm_profiles').select(UMKM_SELECT).in('user_id', ids).limit(1000)
      : { data: [] as Row[], error: null };

    if (umkmErr) {
      console.error('[admin/users] umkm error', umkmErr.message);
    }

    const umkmByUserId = new Map<string, Row>();
    for (const u of ((umkmData ?? []) as unknown) as Row[]) {
      const key = u.user_id;
      if (typeof key === 'string' && !umkmByUserId.has(key)) {
        umkmByUserId.set(key, u);
      }
    }

    // Batch subscription terbaru tiap UMKM di halaman ini (pola
    // subscription-storage.ts: order created_at desc, ambil pertama).
    const umkmIds = Array.from(umkmByUserId.values())
      .map((u) => u.id)
      .filter((v): v is string => typeof v === 'string');
    const { data: subsData, error: subsErr } = umkmIds.length > 0
      ? await db
          .from('subscriptions')
          .select(SUBS_SELECT)
          .in('umkm_id', umkmIds)
          .order('created_at', { ascending: false })
          .limit(1000)
      : { data: [] as Row[], error: null };

    if (subsErr) {
      console.error('[admin/users] subs error', subsErr.message);
    }

    const latestSubByUmkm = new Map<string, Row>();
    for (const s of ((subsData ?? []) as unknown) as Row[]) {
      const key = s.umkm_id;
      if (typeof key === 'string' && !latestSubByUmkm.has(key)) {
        latestSubByUmkm.set(key, s);
      }
    }

    const users = rows.map((r) => {
      const umkm =
        typeof r.id === 'string' ? (umkmByUserId.get(r.id) ?? null) : null;
      const umkmId = umkm ? asString(umkm.id) : null;
      const latestSub = umkmId ? (latestSubByUmkm.get(umkmId) ?? null) : null;
      const seller_status: SellerStatus = resolveSellerStatus(umkm !== null, latestSub);
      const plan = (latestSub?.plans ?? null) as Row | null;
      return {
        id: r.id ?? null,
        email: r.email ?? null,
        full_name: r.full_name ?? null,
        role: r.role ?? null,
        is_super_admin: isSuperAdminUserId(typeof r.id === 'string' ? r.id : null),
        is_verified: r.is_verified ?? false,
        created_at: r.created_at ?? null,
        has_umkm: umkm !== null,
        umkm: umkm
          ? {
              id: umkm.id ?? null,
              business_name: umkm.business_name ?? null,
              slug: umkm.slug ?? null,
              is_verified: umkm.is_verified ?? false,
            }
          : null,
        seller_status,
        seller: umkm
          ? {
              umkm_id: umkm.id ?? null,
              business_name: umkm.business_name ?? null,
              slug: umkm.slug ?? null,
              is_verified: umkm.is_verified ?? false,
              subscription: latestSub
                ? {
                    plan_name: plan ? (asString(plan.name) ?? null) : null,
                    status: latestSub.status ?? null,
                    current_period_start: latestSub.current_period_start ?? null,
                    current_period_end: latestSub.current_period_end ?? null,
                  }
                : null,
            }
          : null,
      };
    });

    return NextResponse.json({
      users,
      total: count ?? users.length,
      limit,
      offset,
    });
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[admin/users] unexpected', err);
    // Pesan internal (stack trace, detail TLS/query) hanya ke log server;
    // client menerima pesan publik agar tidak ada informasi internal yang bocor.
    return NextResponse.json({ error: "Gagal memproses data pengguna." }, { status: 500 });
  }
}
