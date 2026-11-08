import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { resolveSellerStatus, type SellerStatus, } from '@/lib/server/seller-status';
import { isSuperAdminUserId } from '@/lib/admin-access';
import { sanitizeSearchTerm } from '@/lib/filter-search';
import { accountStatusOrCondition, isAdminAccountStatusFilter, isAdminRoleFilter, type AdminAccountStatusFilter, type AdminRoleFilter, } from '@/lib/admin-user-filters';
import { computeCoinBalance } from '@/lib/coin-adjustment';
export const runtime = 'nodejs';
const USERS_SELECT = [
    'id',
    'email',
    'full_name',
    'role',
    'avatar_url',
    'is_verified',
    'created_at',
    'deleted_at',
    'account_status',
].join(', ');
const UMKM_SELECT = ['id', 'user_id', 'business_name', 'slug', 'is_verified'].join(', ');
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
        const sellerFilterRaw = (params.get('sellerStatus') ?? '').trim();
        const includeDeleted = (params.get('deleted') ?? '').trim().toLowerCase() === 'include';
        const sellerFilter: SellerStatus | null = (SELLER_STATUS_FILTERS as readonly string[]).includes(sellerFilterRaw)
            ? (sellerFilterRaw as SellerStatus)
            : null;
        if (sellerFilterRaw && !sellerFilter) {
            return NextResponse.json({ error: 'Filter tidak valid. Nilai yang diizinkan: active, no_subscription, no_store.' }, { status: 400 });
        }
        const roleRaw = (params.get('role') ?? '').trim();
        if (roleRaw && !isAdminRoleFilter(roleRaw)) {
            return NextResponse.json({ error: 'Filter peran tidak valid. Nilai yang diizinkan: admin, umkm, buyer.' }, { status: 400 });
        }
        const roleFilter: AdminRoleFilter | null = roleRaw ? (roleRaw as AdminRoleFilter) : null;
        const accountStatusRaw = (params.get('accountStatus') ?? '').trim();
        if (accountStatusRaw && !isAdminAccountStatusFilter(accountStatusRaw)) {
            return NextResponse.json({
                error: 'Filter status akun tidak valid. Nilai yang diizinkan: active, suspended, banned.',
            }, { status: 400 });
        }
        const accountStatusFilter: AdminAccountStatusFilter | null = accountStatusRaw
            ? (accountStatusRaw as AdminAccountStatusFilter)
            : null;
        const db = createAuthedServerClient(authHeader);
        let idFilter: {
            op: 'in' | 'not-in';
            ids: string[];
        } | null = null;
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
                if (uid && umkmId && !umkmByOwner.has(uid))
                    umkmByOwner.set(uid, umkmId);
            }
            if (sellerFilter === 'no_store') {
                if (ownerIds.length > 0)
                    idFilter = { op: 'not-in', ids: ownerIds };
            }
            else {
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
                    if (key && !latestByUmkm.has(key))
                        latestByUmkm.set(key, s);
                }
                const now = Date.now();
                const activeOwnerIds: string[] = [];
                umkmByOwner.forEach((umkmId, uid) => {
                    const latest = latestByUmkm.get(umkmId) ?? null;
                    const active = latest !== null &&
                        latest.status === 'active' &&
                        typeof latest.current_period_end === 'string' &&
                        Number.isFinite(new Date(latest.current_period_end as string).getTime()) &&
                        new Date(latest.current_period_end as string).getTime() > now;
                    if (active)
                        activeOwnerIds.push(uid);
                });
                if (sellerFilter === 'active') {
                    if (activeOwnerIds.length === 0) {
                        return NextResponse.json({ users: [], total: 0, limit, offset });
                    }
                    idFilter = { op: 'in', ids: activeOwnerIds };
                }
                else {
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
        if (!includeDeleted)
            query = query.is('deleted_at', null);
        if (search) {
            const pattern = `%${search}%`;
            query = query.or(`email.ilike.${pattern},full_name.ilike.${pattern}`);
        }
        if (roleFilter) {
            query = query.eq('role', roleFilter);
        }
        const statusCondition = accountStatusOrCondition(accountStatusFilter);
        if (statusCondition) {
            query = query.or(statusCondition);
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
        const { data: coinData, error: coinErr } = ids.length > 0
            ? await db
                .from('coin_transactions')
                .select('user_id, type, amount')
                .in('user_id', ids)
                .limit(20000)
            : { data: [] as Row[], error: null };
        if (coinErr) {
            console.error('[admin/users] coin error', coinErr.message);
        }
        const coinRowsByUserId = new Map<string, {
            type: string;
            amount: number;
        }[]>();
        for (const row of ((coinData ?? []) as unknown) as Row[]) {
            const key = row.user_id;
            if (typeof key !== 'string')
                continue;
            const amount = Number(row.amount);
            const daftar = coinRowsByUserId.get(key) ?? [];
            daftar.push({ type: String(row.type ?? ''), amount: Number.isFinite(amount) ? amount : 0 });
            coinRowsByUserId.set(key, daftar);
        }
        const users = rows.map((r) => {
            const umkm = typeof r.id === 'string' ? (umkmByUserId.get(r.id) ?? null) : null;
            const umkmId = umkm ? asString(umkm.id) : null;
            const latestSub = umkmId ? (latestSubByUmkm.get(umkmId) ?? null) : null;
            const seller_status: SellerStatus = resolveSellerStatus(umkm !== null, latestSub);
            const plan = (latestSub?.plans ?? null) as Row | null;
            return {
                id: r.id ?? null,
                email: r.email ?? null,
                full_name: r.full_name ?? null,
                role: r.role ?? null,
                avatar_url: r.avatar_url ?? null,
                is_super_admin: isSuperAdminUserId(typeof r.id === 'string' ? r.id : null),
                is_verified: r.is_verified ?? false,
                created_at: r.created_at ?? null,
                deleted_at: r.deleted_at ?? null,
                account_status: r.account_status ?? null,
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
                coin_balance: computeCoinBalance(typeof r.id === 'string' ? (coinRowsByUserId.get(r.id) ?? []) : []),
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
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/users] unexpected', err);
        return NextResponse.json({ error: "Gagal memproses data pengguna." }, { status: 500 });
    }
}
