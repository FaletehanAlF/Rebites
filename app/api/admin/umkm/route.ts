import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { sanitizeSearchTerm } from '@/lib/filter-search';
import { displayBusinessName } from '@/lib/business-name';
export const runtime = 'nodejs';
const UMKM_SELECT = [
    'id',
    'user_id',
    'business_name',
    'description',
    'category',
    'address',
    'city',
    'logo_url',
    'slug',
    'is_verified',
    'rating',
    'is_open',
    'is_active',
    'created_at',
    'deleted_at',
].join(', ');
type Row = Record<string, unknown>;
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const admin = await getAdminUser(authHeader);
        if (!admin) {
            const user = await getUserFromBearer(authHeader);
            return NextResponse.json({ error: user ? 'Akses ditolak. Hanya admin.' : 'Unauthorized. Silakan login ulang.' }, { status: user ? 403 : 401 });
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
        const VERIFICATION_ALLOWLIST = ['verified', 'unverified'] as const;
        const verificationRaw = (params.get('verification') ?? '').trim().toLowerCase();
        if (verificationRaw && !(VERIFICATION_ALLOWLIST as readonly string[]).includes(verificationRaw)) {
            return NextResponse.json({ error: 'Filter verification tidak valid. Nilai yang diizinkan: verified, unverified.' }, { status: 400 });
        }
        const db = createAuthedServerClient(authHeader);
        const includeDeleted = (params.get('deleted') ?? '').trim().toLowerCase() === 'include';
        let query = db
            .from('umkm_profiles')
            .select(UMKM_SELECT, { count: 'exact' })
            .order('created_at', { ascending: false });
        if (!includeDeleted)
            query = query.is('deleted_at', null);
        if (verificationRaw === 'verified')
            query = query.eq('is_verified', true);
        if (verificationRaw === 'unverified')
            query = query.eq('is_verified', false);
        if (search) {
            const pattern = `%${search}%`;
            query = query.or(`business_name.ilike.${pattern},city.ilike.${pattern}`);
        }
        const { data, error, count } = await query.range(offset, offset + limit - 1);
        if (error) {
            console.error('[admin/umkm] fetch error', error.message);
            return NextResponse.json({ error: 'Gagal memuat daftar UMKM.' }, { status: 500 });
        }
        const rows = ((data ?? []) as unknown) as Row[];
        const ids = rows
            .map((r) => r.id)
            .filter((v): v is string => typeof v === 'string');
        const userIds = rows
            .map((r) => r.user_id)
            .filter((v): v is string => typeof v === 'string' && v.length > 0);
        const [ownersRes, subsRes, productsRes] = await Promise.all([
            userIds.length > 0
                ? db.from('profiles').select('id, full_name, email').in('id', userIds)
                : Promise.resolve({ data: [] as Row[], error: null }),
            ids.length > 0
                ? db
                    .from('subscriptions')
                    .select('id, umkm_id, status, billing, price_paid, current_period_start, current_period_end, plans(id, slug, name)')
                    .in('umkm_id', ids)
                    .order('created_at', { ascending: false })
                    .limit(Math.min(1000, Math.max(ids.length, 20)))
                : Promise.resolve({ data: [] as Row[], error: null }),
            ids.length > 0
                ? db.from('products').select('umkm_id').in('umkm_id', ids).limit(1000)
                : Promise.resolve({ data: [] as Row[], error: null }),
        ]);
        if (ownersRes.error) {
            console.error('[admin/umkm] owners error', ownersRes.error.message);
        }
        if (subsRes.error) {
            console.error('[admin/umkm] subscriptions error', subsRes.error.message);
        }
        if (productsRes.error) {
            console.error('[admin/umkm] products error', productsRes.error.message);
        }
        const owners = new Map<string, Row>();
        for (const o of ((ownersRes.data ?? []) as unknown as Row[])) {
            if (typeof o.id === 'string')
                owners.set(o.id, o);
        }
        const latestSub = new Map<string, Row>();
        for (const s of ((subsRes.data ?? []) as unknown as Row[])) {
            const key = s.umkm_id;
            if (typeof key === 'string' && !latestSub.has(key))
                latestSub.set(key, s);
        }
        const productCount = new Map<string, number>();
        for (const p of ((productsRes.data ?? []) as unknown as Row[])) {
            const key = p.umkm_id;
            if (typeof key === 'string')
                productCount.set(key, (productCount.get(key) ?? 0) + 1);
        }
        const umkm = rows.map((r) => {
            const owner = typeof r.user_id === 'string' ? owners.get(r.user_id) ?? null : null;
            const sub = typeof r.id === 'string' ? latestSub.get(r.id) ?? null : null;
            const plan = sub && sub.plans && typeof sub.plans === 'object' && !Array.isArray(sub.plans)
                ? (sub.plans as Row)
                : null;
            return {
                id: r.id,
                user_id: r.user_id ?? null,
                business_name: displayBusinessName(r.business_name),
                description: r.description ?? null,
                category: r.category ?? null,
                address: r.address ?? null,
                city: r.city ?? null,
                logo_url: r.logo_url ?? null,
                slug: r.slug ?? null,
                is_verified: r.is_verified ?? false,
                rating: r.rating ?? null,
                is_open: r.is_open ?? null,
                is_active: r.is_active !== false,
                created_at: r.created_at ?? null,
                deleted_at: r.deleted_at ?? null,
                owner: owner
                    ? { id: owner.id, full_name: owner.full_name ?? null, email: owner.email ?? null }
                    : null,
                subscription: sub
                    ? {
                        id: sub.id,
                        status: sub.status ?? null,
                        billing: sub.billing ?? null,
                        price_paid: sub.price_paid ?? null,
                        current_period_start: sub.current_period_start ?? null,
                        current_period_end: sub.current_period_end ?? null,
                        plan: plan
                            ? { id: plan.id ?? null, slug: plan.slug ?? null, name: plan.name ?? null }
                            : null,
                    }
                    : null,
                product_count: typeof r.id === 'string' ? (productCount.get(r.id) ?? 0) : 0,
            };
        });
        return NextResponse.json({
            umkm,
            total: count ?? umkm.length,
            limit,
            offset,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/umkm] unexpected', err);
        return NextResponse.json({ error: "Gagal memproses data UMKM." }, { status: 500 });
    }
}
