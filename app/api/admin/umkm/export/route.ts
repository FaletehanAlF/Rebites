import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, queryFailureResponse, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { PageLimitError, PageQueryError, fetchAllPages, type PostgrestPage, } from '@/lib/server/supabase-rows';
import { ADMIN_EXPORT_ID_CHUNK, ADMIN_EXPORT_MAX_ROWS, adminExportFilename, adminExportLimitMessage, fetchRowsInChunks, } from '@/lib/admin-export-rules';
import { buildAdminExportResponse } from '@/lib/server/admin-export';
import type { XlsxColumn } from '@/lib/xlsx';
import { sanitizeSearchTerm } from '@/lib/filter-search';
import { displayBusinessName } from '@/lib/business-name';
import { formatWibDateTime } from '@/lib/wib-time';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const UMKM_SELECT = [
    'id',
    'user_id',
    'business_name',
    'category',
    'city',
    'is_verified',
    'rating',
    'is_active',
    'created_at',
    'deleted_at',
].join(', ');
const VERIFICATION_ALLOWLIST = ['verified', 'unverified'] as const;
const SUBS_SELECT = 'umkm_id, status, billing, price_paid, current_period_start, current_period_end, created_at, plans(name)';
const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
    active: 'Aktif',
    pending: 'Menunggu',
    expired: 'Kedaluwarsa',
    cancelled: 'Dibatalkan',
};
const COLUMNS: XlsxColumn[] = [
    { header: 'Nama toko', width: 28, wrap: true },
    { header: 'Pemilik', width: 24, wrap: true },
    { header: 'Email pemilik', width: 30, wrap: true },
    { header: 'Kota', width: 18 },
    { header: 'Kategori', width: 18 },
    { header: 'Terverifikasi', width: 13 },
    { header: 'Aktif', width: 10 },
    { header: 'Rating', width: 10 },
    { header: 'Jumlah produk', width: 14 },
    { header: 'Paket', width: 18 },
    { header: 'Status langganan', width: 18 },
    { header: 'Berakhir (WIB)', width: 20 },
    { header: 'Dibuat (WIB)', width: 20 },
];
type Row = Record<string, unknown>;
function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}
function asNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '')
        return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
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
        const verificationRaw = (params.get('verification') ?? '').trim().toLowerCase();
        if (verificationRaw &&
            !(VERIFICATION_ALLOWLIST as readonly string[]).includes(verificationRaw)) {
            return NextResponse.json({ error: 'Filter verification tidak valid. Nilai yang diizinkan: verified, unverified.' }, { status: 400 });
        }
        const includeDeleted = (params.get('deleted') ?? '').trim().toLowerCase() === 'include';
        const db = createAuthedServerClient(authHeader);
        let rows: Row[];
        try {
            rows = await fetchAllPages<Row>((from, to) => {
                let query = db
                    .from('umkm_profiles')
                    .select(UMKM_SELECT)
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: false });
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
                return query.range(from, to) as unknown as PromiseLike<PostgrestPage<Row>>;
            }, { maxRows: ADMIN_EXPORT_MAX_ROWS, label: 'ekspor UMKM' });
        }
        catch (err) {
            if (err instanceof PageLimitError) {
                return NextResponse.json({ error: adminExportLimitMessage('UMKM', err.observedAtLeast) }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
            }
            if (err instanceof PageQueryError) {
                console.error('[admin/umkm/export] page error', err.label, err.queryError);
                return queryFailureResponse(err.queryError, 'Gagal membuat ekspor UMKM.');
            }
            throw err;
        }
        const umkmIds = rows
            .map((row) => asString(row.id))
            .filter((value): value is string => Boolean(value));
        const userIds = Array.from(new Set(rows.map((row) => asString(row.user_id)).filter((v): v is string => Boolean(v))));
        const ownersResult = await fetchRowsInChunks<Row>(userIds, ADMIN_EXPORT_ID_CHUNK, (chunk) => db.from('profiles').select('id, full_name, email').in('id', chunk));
        if (ownersResult.error) {
            console.error('[admin/umkm/export] owners error', ownersResult.error);
            return queryFailureResponse(ownersResult.error, 'Gagal membuat ekspor UMKM.');
        }
        const subsResult = await fetchRowsInChunks<Row>(umkmIds, ADMIN_EXPORT_ID_CHUNK, (chunk) => db.from('subscriptions').select(SUBS_SELECT).in('umkm_id', chunk).order('created_at', { ascending: false }));
        if (subsResult.error) {
            console.error('[admin/umkm/export] subscriptions error', subsResult.error);
            return queryFailureResponse(subsResult.error, 'Gagal membuat ekspor UMKM.');
        }
        const productCountResult = await fetchRowsInChunks<Row>(umkmIds, ADMIN_EXPORT_ID_CHUNK, (chunk) => db.from('products').select('umkm_id').in('umkm_id', chunk));
        if (productCountResult.error) {
            console.error('[admin/umkm/export] products error', productCountResult.error);
            return queryFailureResponse(productCountResult.error, 'Gagal membuat ekspor UMKM.');
        }
        const ownerById = new Map<string, Row>();
        for (const owner of ownersResult.rows) {
            const id = asString(owner.id);
            if (id)
                ownerById.set(id, owner);
        }
        const latestSubByUmkm = new Map<string, Row>();
        for (const sub of subsResult.rows) {
            const key = asString(sub.umkm_id);
            if (key && !latestSubByUmkm.has(key))
                latestSubByUmkm.set(key, sub);
        }
        const productCountByUmkm = new Map<string, number>();
        for (const product of productCountResult.rows) {
            const key = asString(product.umkm_id);
            if (key)
                productCountByUmkm.set(key, (productCountByUmkm.get(key) ?? 0) + 1);
        }
        const dataRows: (string | number | null)[][] = rows.map((row) => {
            const umkmId = asString(row.id);
            const owner = asString(row.user_id) ? ownerById.get(asString(row.user_id) as string) ?? null : null;
            const latestSub = umkmId ? latestSubByUmkm.get(umkmId) ?? null : null;
            const plan = asRecord(latestSub?.plans);
            const subStatus = asString(latestSub?.status);
            return [
                displayBusinessName(row.business_name),
                owner ? asString(owner.full_name) ?? asString(owner.email) ?? '' : '',
                owner ? asString(owner.email) ?? '' : '',
                asString(row.city) ?? '',
                asString(row.category) ?? '',
                row.is_verified === true ? 'Terverifikasi' : 'Belum terverifikasi',
                row.is_active === false ? 'Nonaktif' : 'Aktif',
                asNumber(row.rating),
                umkmId ? productCountByUmkm.get(umkmId) ?? 0 : 0,
                plan ? asString(plan.name) ?? '' : '',
                subStatus ? SUBSCRIPTION_STATUS_LABEL[subStatus] ?? subStatus : '',
                waktuWib(latestSub?.current_period_end),
                waktuWib(row.created_at),
            ];
        });
        return buildAdminExportResponse({
            filename: adminExportFilename('umkm'),
            sheet: { name: 'UMKM', columns: COLUMNS, rows: dataRows },
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/umkm/export] unexpected', err);
        return NextResponse.json({ error: 'Gagal membuat ekspor UMKM.' }, { status: 500 });
    }
}
