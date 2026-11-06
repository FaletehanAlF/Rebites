import { NextRequest, NextResponse } from 'next/server';
import {
  createAuthedServerClient,
  getAdminUser,
  getUserFromBearer,
  isSupabaseUnavailable,
  upstreamUnavailableResponse,
} from '@/lib/server/supabase';
import { sanitizeSearchTerm } from '@/lib/filter-search';

export const runtime = 'nodejs';

/**
 * GET /api/admin/subscriptions?limit=20&offset=0&search=&status=&plan=
 * Daftar subscription untuk Admin Main (read-only, satu baris = satu subscription).
 *
 * - status mentah ditampilkan apa adanya; kolom `effective` dihitung SERVER-SIDE.
 * - Definisi "aktif" mereplikasi lib/subscription-storage.ts getActiveSubscription:
 *     status === 'active' DAN current_period_end > now.
 * - Tidak ada dedupe per UMKM; tidak ada mutasi data.
 * - Auth: Authorization: Bearer <supabase access_token admin>
 */

const STATUS_ALLOWLIST = ['active', 'pending', 'expired', 'cancelled', 'trial'] as const;

type RawStatus = (typeof STATUS_ALLOWLIST)[number];
type Effective = 'active' | 'lapsed' | 'pending' | 'expired' | 'trial';

type Row = Record<string, unknown>;

const SUBS_SELECT = [
  'id',
  'umkm_id',
  'plan_id',
  'status',
  'billing',
  'price_paid',
  'current_period_start',
  'current_period_end',
  'xendit_invoice_id',
  'xendit_status',
  'created_at',
].join(', ');

function sanitizeSlug(raw: string | null): string {
  if (!raw) return '';
  return raw.trim().slice(0, 100).replace(/[%(),]/g, '');
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Effective status (server-side, display-only, tanpa mutasi DB):
 * 1. active + period_end > now        => active
 * 2. active + period_end <= now/invalid => lapsed
 * 3. pending                          => pending
 * 4. expired                          => expired
 * 5. cancelled                        => expired
 * 6. trial                            => trial
 */
function computeEffective(status: unknown, periodEnd: unknown, now: number): Effective {
  const s = typeof status === 'string' ? status.trim().toLowerCase() : '';
  if (s === 'pending') return 'pending';
  if (s === 'expired') return 'expired';
  if (s === 'cancelled') return 'expired';
  if (s === 'trial') return 'trial';
  if (s === 'active') {
    if (typeof periodEnd === 'string' && periodEnd) {
      const endMs = new Date(periodEnd).getTime();
      if (Number.isFinite(endMs) && endMs > now) return 'active';
    }
    return 'lapsed';
  }
  // Status tak dikenal: aman = tidak pernah diklaim aktif.
  return 'expired';
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

    const statusRaw = (params.get('status') ?? '').trim().toLowerCase();
    const statusFilter: RawStatus | null = (STATUS_ALLOWLIST as readonly string[]).includes(
      statusRaw
    )
      ? (statusRaw as RawStatus)
      : null;
    if (statusRaw && !statusFilter) {
      return NextResponse.json(
        { error: 'Filter status tidak valid. Nilai yang diizinkan: active, pending, expired, cancelled, trial.' },
        { status: 400 }
      );
    }

    const planSlug = sanitizeSlug(params.get('plan')).toLowerCase();

    const db = createAuthedServerClient(authHeader);

    // Validasi plan terhadap plans.slug yang memang ada (toleran legacy).
    let planId: string | null = null;
    if (planSlug) {
      const { data: planRow, error: planErr } = await db
        .from('plans')
        .select('id, slug')
        .eq('slug', planSlug)
        .maybeSingle();
      if (planErr) {
        console.error('[admin/subscriptions] plan lookup error', planErr.message);
        return NextResponse.json({ error: 'Gagal memuat daftar langganan.' }, { status: 500 });
      }
      const found = (planRow as Row | null) ?? null;
      if (!found || typeof found.id !== 'string') {
        return NextResponse.json(
          { error: 'Filter paket tidak valid. Gunakan slug paket yang tersedia.' },
          { status: 400 }
        );
      }
      planId = found.id as string;
    }

    // Search diprioritaskan ke business_name, slug, xendit_invoice_id.
    // Strategi aman untuk tabel kecil: petakan UMKM yang cocok lebih dulu,
    // lalu filter subscriptions via umkm_id IN + xendit_invoice_id ILIKE
    // dalam SATU query sehingga total/count tetap benar (tanpa post-filter).
    let searchUmkmIds: string[] | null = null;
    if (search) {
      const pattern = `%${search}%`;
      const { data: matchedUmkm, error: matchErr } = await db
        .from('umkm_profiles')
        .select('id')
        .or(`business_name.ilike.${pattern},slug.ilike.${pattern}`)
        .limit(500);
      if (matchErr) {
        console.error('[admin/subscriptions] search umkm error', matchErr.message);
        return NextResponse.json({ error: 'Gagal memuat daftar langganan.' }, { status: 500 });
      }
      searchUmkmIds = (((matchedUmkm ?? []) as unknown) as Row[])
        .map((r) => r.id)
        .filter((v): v is string => typeof v === 'string' && v.length > 0);
    }

    let query = db
      .from('subscriptions')
      .select(SUBS_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }
    if (planId) {
      query = query.eq('plan_id', planId);
    }
    if (search) {
      const invoicePattern = `%${search}%`;
      if (searchUmkmIds && searchUmkmIds.length > 0) {
        // Batasi panjang IN agar URL/OR tidak meledak; tabel kecil sehingga aman.
        const capped = searchUmkmIds.slice(0, 200);
        query = query.or(`umkm_id.in.(${capped.join(',')}),xendit_invoice_id.ilike.${invoicePattern}`);
      } else {
        query = query.ilike('xendit_invoice_id', invoicePattern);
      }
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1);

    if (error) {
      console.error('[admin/subscriptions] fetch error', error.message);
      return NextResponse.json({ error: 'Gagal memuat daftar langganan.' }, { status: 500 });
    }

    const rows = ((data ?? []) as unknown) as Row[];
    const now = Date.now();

    // Batch queries (bukan N+1): umkm, plans, owners via umkm.user_id.
    const umkmIds = Array.from(
      new Set(rows.map((r) => r.umkm_id).filter((v): v is string => typeof v === 'string'))
    );
    const planIds = Array.from(
      new Set(rows.map((r) => r.plan_id).filter((v): v is string => typeof v === 'string'))
    );

    const [umkmRes, plansRes] = await Promise.all([
      umkmIds.length > 0
        ? db
            .from('umkm_profiles')
            .select('id, user_id, business_name, slug, is_verified')
            .in('id', umkmIds)
        : Promise.resolve({ data: [] as Row[], error: null }),
      planIds.length > 0
        ? db.from('plans').select('id, slug, name').in('id', planIds)
        : Promise.resolve({ data: [] as Row[], error: null }),
    ]);

    if (umkmRes.error) {
      console.error('[admin/subscriptions] umkm error', umkmRes.error.message);
    }
    if (plansRes.error) {
      console.error('[admin/subscriptions] plans error', plansRes.error.message);
    }

    const umkmById = new Map<string, Row>();
    for (const u of ((umkmRes.data ?? []) as unknown as Row[])) {
      if (typeof u.id === 'string') umkmById.set(u.id, u);
    }
    const planById = new Map<string, Row>();
    for (const p of ((plansRes.data ?? []) as unknown as Row[])) {
      if (typeof p.id === 'string') planById.set(p.id, p);
    }

    const ownerIds = Array.from(
      new Set(
        Array.from(umkmById.values())
          .map((u) => u.user_id)
          .filter((v): v is string => typeof v === 'string' && v.length > 0)
      )
    );
    const { data: ownersData, error: ownersErr } =
      ownerIds.length > 0
        ? await db.from('profiles').select('id, full_name, email').in('id', ownerIds)
        : { data: [] as Row[], error: null };
    if (ownersErr) {
      console.error('[admin/subscriptions] owners error', ownersErr.message);
    }
    const ownerById = new Map<string, Row>();
    for (const o of ((ownersData ?? []) as unknown as Row[])) {
      if (typeof o.id === 'string') ownerById.set(o.id, o);
    }

    const items = rows.map((r) => {
      const umkmId = asString(r.umkm_id);
      const planIdValue = asString(r.plan_id);
      const umkm = umkmId ? (umkmById.get(umkmId) ?? null) : null;
      const plan = planIdValue ? (planById.get(planIdValue) ?? null) : null;
      const ownerUserId = umkm ? asString(umkm.user_id) : null;
      const owner = ownerUserId ? (ownerById.get(ownerUserId) ?? null) : null;
      const status = asString(r.status);
      const effective = computeEffective(status, r.current_period_end, now);
      return {
        id: r.id,
        umkm: umkm
          ? {
              id: umkm.id ?? null,
              business_name: umkm.business_name ?? null,
              slug: umkm.slug ?? null,
              is_verified: umkm.is_verified ?? false,
            }
          : {
              id: umkmId,
              business_name: null,
              slug: null,
              is_verified: false,
            },
        owner: owner
          ? {
              id: owner.id ?? null,
              full_name: owner.full_name ?? null,
              email: owner.email ?? null,
            }
          : null,
        plan: plan
          ? {
              id: plan.id ?? null,
              name: plan.name ?? null,
              slug: plan.slug ?? null,
            }
          : {
              id: planIdValue,
              name: null,
              slug: null,
            },
        status,
        effective,
        billing: asString(r.billing),
        price_paid: typeof r.price_paid === 'number' ? r.price_paid : null,
        current_period_start: asString(r.current_period_start),
        current_period_end: asString(r.current_period_end),
        xendit_invoice_id: asString(r.xendit_invoice_id),
        xendit_status: asString(r.xendit_status),
        created_at: asString(r.created_at),
      };
    });

    return NextResponse.json({
      items,
      total: count ?? items.length,
      limit,
      offset,
    });
  } catch (err) {
    if (isSupabaseUnavailable(err)) return upstreamUnavailableResponse();
    console.error('[admin/subscriptions] unexpected', err);
    // Pesan internal (stack trace, detail TLS/query) hanya ke log server;
    // client menerima pesan publik agar tidak ada informasi internal yang bocor.
    return NextResponse.json({ error: "Gagal memuat langganan." }, { status: 500 });
  }
}
