import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, queryFailureResponse, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { PageLimitError, PageQueryError, fetchAllPages, type PostgrestPage, } from '@/lib/server/supabase-rows';
import { ADMIN_EXPORT_ID_CHUNK, ADMIN_EXPORT_MAX_ROWS, adminExportFilename, adminExportLimitMessage, fetchRowsInChunks, } from '@/lib/admin-export-rules';
import { buildAdminExportResponse } from '@/lib/server/admin-export';
import type { XlsxColumn } from '@/lib/xlsx';
import { sanitizeSearchTerm } from '@/lib/filter-search';
import { accountStatusOrCondition, isAdminAccountStatusFilter, isAdminRoleFilter, type AdminAccountStatusFilter, type AdminRoleFilter, } from '@/lib/admin-user-filters';
import { resolveSellerStatus, type SellerStatus } from '@/lib/server/seller-status';
import { isSuperAdminUserId } from '@/lib/admin-access';
import { computeCoinBalance } from '@/lib/coin-adjustment';
import { formatWibDateTime } from '@/lib/wib-time';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const USERS_SELECT = [
    'id',
    'email',
    'full_name',
    'role',
    'is_verified',
    'created_at',
    'deleted_at',
    'account_status',
].join(', ');
const SELLER_STATUS_FILTERS: readonly SellerStatus[] = [
    'active',
    'no_subscription',
    'no_store',
];
const STATUS_PENJUAL_LABEL: Record<SellerStatus, string> = {
    active: 'Aktif',
    no_subscription: 'Langganan tidak aktif',
    no_store: 'Belum punya toko',
};
const PERAN_LABEL: Record<string, string> = {
    admin: 'Admin',
    umkm: 'UMKM',
    buyer: 'Pembeli',
};
const COLUMNS: XlsxColumn[] = [
    { header: 'Nama', width: 28, wrap: true },
    { header: 'Email', width: 30, wrap: true },
    { header: 'Peran', width: 12 },
    { header: 'Status akun', width: 14 },
    { header: 'Super Admin', width: 12 },
    { header: 'Punya toko', width: 12 },
    { header: 'Nama toko', width: 26, wrap: true },
    { header: 'Status penjual', width: 22 },
    { header: 'Paket', width: 18 },
    { header: 'Langganan berakhir (WIB)', width: 22 },
    { header: 'Saldo koin', width: 12 },
    { header: 'Terverifikasi', width: 13 },
    { header: 'Terdaftar (WIB)', width: 20 },
    { header: 'Dihapus (WIB)', width: 20 },
];
type Row = Record<string, unknown>;
function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}
function asRecord(value: unknown): Row | null {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    return value as Row;
}
function waktuWib(value: unknown): string {
    const raw = asString(value);
    if (!raw)
        return '';
    return formatWibDateTime(raw) ?? '';
}
function peranLabel(value: string | null): string {
    if (!value)
        return '-';
    return PERAN_LABEL[value] ?? value;
}
function statusAkunLabel(value: string | null): string {
    if (value === 'banned')
        return 'Diblokir';
    if (value === 'suspended')
        return 'Ditangguhkan';
    return 'Aktif';
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
        const search = sanitizeSearchTerm(params.get('search'));
        const sellerFilterRaw = (params.get('sellerStatus') ?? '').trim();
        if (sellerFilterRaw &&
            !(SELLER_STATUS_FILTERS as readonly string[]).includes(sellerFilterRaw)) {
            return NextResponse.json({ error: 'Filter tidak valid. Nilai yang diizinkan: active, no_subscription, no_store.' }, { status: 400 });
        }
        const sellerFilter = sellerFilterRaw ? (sellerFilterRaw as SellerStatus) : null;
        const includeDeleted = (params.get('deleted') ?? '').trim().toLowerCase() === 'include';
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
        const statusCondition = accountStatusOrCondition(accountStatusFilter);
        const db = createAuthedServerClient(authHeader);
        let rows: Row[];
        try {
            rows = await fetchAllPages<Row>((from, to) => {
                let query = db
                    .from('profiles')
                    .select(USERS_SELECT)
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: false });
                if (!includeDeleted)
                    query = query.is('deleted_at', null);
                if (search) {
                    const pattern = `%${search}%`;
                    query = query.or(`email.ilike.${pattern},full_name.ilike.${pattern}`);
                }
                if (roleFilter)
                    query = query.eq('role', roleFilter);
                if (statusCondition)
                    query = query.or(statusCondition);
                return query.range(from, to) as unknown as PromiseLike<PostgrestPage<Row>>;
            }, { maxRows: ADMIN_EXPORT_MAX_ROWS, label: 'ekspor pengguna' });
        }
        catch (err) {
            if (err instanceof PageLimitError) {
                return NextResponse.json({ error: adminExportLimitMessage('pengguna', err.observedAtLeast) }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
            }
            if (err instanceof PageQueryError) {
                console.error('[admin/users/export] page error', err.label, err.queryError);
                return queryFailureResponse(err.queryError, 'Gagal membuat ekspor pengguna.');
            }
            throw err;
        }
        const ids = rows
            .map((row) => asString(row.id))
            .filter((value): value is string => Boolean(value));
        const umkmResult = await fetchRowsInChunks<Row>(ids, ADMIN_EXPORT_ID_CHUNK, (chunk) => db
            .from('umkm_profiles')
            .select('id, user_id, business_name, slug, is_verified')
            .in('user_id', chunk));
        if (umkmResult.error) {
            console.error('[admin/users/export] umkm error', umkmResult.error);
            return queryFailureResponse(umkmResult.error, 'Gagal membuat ekspor pengguna.');
        }
        const umkmByUserId = new Map<string, Row>();
        for (const umkm of umkmResult.rows) {
            const key = asString(umkm.user_id);
            if (key && !umkmByUserId.has(key))
                umkmByUserId.set(key, umkm);
        }
        const umkmIds = Array.from(umkmByUserId.values())
            .map((umkm) => asString(umkm.id))
            .filter((value): value is string => Boolean(value));
        const subsResult = await fetchRowsInChunks<Row>(umkmIds, ADMIN_EXPORT_ID_CHUNK, (chunk) => db
            .from('subscriptions')
            .select('umkm_id, status, current_period_end, created_at, plans(name)')
            .in('umkm_id', chunk)
            .order('created_at', { ascending: false }));
        if (subsResult.error) {
            console.error('[admin/users/export] subs error', subsResult.error);
            return queryFailureResponse(subsResult.error, 'Gagal membuat ekspor pengguna.');
        }
        const latestSubByUmkm = new Map<string, Row>();
        for (const sub of subsResult.rows) {
            const key = asString(sub.umkm_id);
            if (key && !latestSubByUmkm.has(key))
                latestSubByUmkm.set(key, sub);
        }
        const coinsResult = await fetchRowsInChunks<Row>(ids, ADMIN_EXPORT_ID_CHUNK, (chunk) => db.from('coin_transactions').select('user_id, type, amount').in('user_id', chunk));
        if (coinsResult.error) {
            console.error('[admin/users/export] coin error', coinsResult.error);
            return queryFailureResponse(coinsResult.error, 'Gagal membuat ekspor pengguna.');
        }
        const coinRowsByUserId = new Map<string, {
            type: string;
            amount: number;
        }[]>();
        for (const row of coinsResult.rows) {
            const key = asString(row.user_id);
            if (!key)
                continue;
            const amount = Number(row.amount);
            const daftar = coinRowsByUserId.get(key) ?? [];
            daftar.push({
                type: String(row.type ?? ''),
                amount: Number.isFinite(amount) ? amount : 0,
            });
            coinRowsByUserId.set(key, daftar);
        }
        const dataRows: (string | number | null)[][] = [];
        for (const row of rows) {
            const userId = asString(row.id);
            const umkm = userId ? umkmByUserId.get(userId) ?? null : null;
            const umkmId = umkm ? asString(umkm.id) : null;
            const latestSub = umkmId ? latestSubByUmkm.get(umkmId) ?? null : null;
            const statusPenjual = resolveSellerStatus(umkm !== null, latestSub);
            if (sellerFilter && statusPenjual !== sellerFilter)
                continue;
            const plan = asRecord(latestSub?.plans);
            const planName = plan ? asString(plan.name) ?? '' : '';
            dataRows.push([
                asString(row.full_name) ?? '',
                asString(row.email) ?? '',
                peranLabel(asString(row.role)),
                statusAkunLabel(asString(row.account_status)),
                isSuperAdminUserId(userId) ? 'Ya' : 'Tidak',
                umkm ? 'Ya' : 'Tidak',
                umkm ? asString(umkm.business_name) ?? '' : '',
                STATUS_PENJUAL_LABEL[statusPenjual],
                planName,
                waktuWib(latestSub?.current_period_end),
                userId ? computeCoinBalance(coinRowsByUserId.get(userId) ?? []) : 0,
                row.is_verified === true ? 'Ya' : 'Tidak',
                waktuWib(row.created_at),
                waktuWib(row.deleted_at),
            ]);
        }
        return buildAdminExportResponse({
            filename: adminExportFilename('pengguna'),
            sheet: { name: 'Pengguna', columns: COLUMNS, rows: dataRows },
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/users/export] unexpected', err);
        return NextResponse.json({ error: 'Gagal membuat ekspor pengguna.' }, { status: 500 });
    }
}
