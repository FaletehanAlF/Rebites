import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, queryFailureResponse, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { PageLimitError, PageQueryError, fetchAllPages, type PostgrestPage, } from '@/lib/server/supabase-rows';
import { ADMIN_EXPORT_MAX_ROWS, adminExportFilename, adminExportLimitMessage, } from '@/lib/admin-export-rules';
import { buildAdminExportResponse } from '@/lib/server/admin-export';
import type { XlsxColumn } from '@/lib/xlsx';
import { sanitizeSearchTermKeepingWords } from '@/lib/filter-search';
import { formatWibDateTime } from '@/lib/wib-time';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PRODUCT_SELECT = [
    'id',
    'name',
    'category',
    'original_price',
    'surplus_price',
    'stock',
    'status',
    'verification_status',
    'rejection_reason',
    'created_at',
    'deleted_at',
    'umkm:umkm_profiles(id, business_name, city, is_verified)',
].join(', ');
const VERIFICATION_STATUSES = ['pending', 'approved', 'rejected'] as const;
const OPERATIONAL_STATUSES = ['available', 'sold_out', 'hidden'] as const;
const VERIFICATION_LABEL: Record<string, string> = {
    approved: 'Aktif',
    rejected: 'Ditunda Admin',
    pending: 'Antrean Lama',
};
const OPERATIONAL_LABEL: Record<string, string> = {
    available: 'Tersedia',
    sold_out: 'Stok Habis',
    hidden: 'Disembunyikan',
};
const COLUMNS: XlsxColumn[] = [
    { header: 'Nama produk', width: 30, wrap: true },
    { header: 'Toko', width: 26, wrap: true },
    { header: 'Kota', width: 18 },
    { header: 'Kategori', width: 18 },
    { header: 'Harga normal', width: 14 },
    { header: 'Harga surplus', width: 14 },
    { header: 'Stok', width: 8 },
    { header: 'Status verifikasi', width: 16 },
    { header: 'Alasan tunda', width: 40, wrap: true },
    { header: 'Status operasional', width: 18 },
    { header: 'Dibuat (WIB)', width: 20 },
    { header: 'Dihapus (WIB)', width: 20 },
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
function label(map: Record<string, string>, value: string | null): string {
    if (!value)
        return '-';
    return map[value] ?? value;
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
        const verificationStatus = (params.get('verificationStatus') ?? '').trim();
        if (verificationStatus &&
            !(VERIFICATION_STATUSES as readonly string[]).includes(verificationStatus)) {
            return NextResponse.json({ error: 'Filter status verifikasi tidak dikenal.' }, { status: 400 });
        }
        const status = (params.get('status') ?? '').trim();
        if (status && !(OPERATIONAL_STATUSES as readonly string[]).includes(status)) {
            return NextResponse.json({ error: 'Filter status operasional tidak dikenal.' }, { status: 400 });
        }
        const umkmId = (params.get('umkmId') ?? '').trim();
        const q = sanitizeSearchTermKeepingWords(params.get('q'));
        const db = createAuthedServerClient(authHeader);
        let rows: Row[];
        try {
            rows = await fetchAllPages<Row>((from, to) => {
                let query = db
                    .from('products')
                    .select(PRODUCT_SELECT)
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: false });
                if (verificationStatus)
                    query = query.eq('verification_status', verificationStatus);
                if (status)
                    query = query.eq('status', status);
                if (umkmId)
                    query = query.eq('umkm_id', umkmId);
                if (q)
                    query = query.or(`name.ilike.%${q}%,category.ilike.%${q}%`);
                return query.range(from, to) as unknown as PromiseLike<PostgrestPage<Row>>;
            }, { maxRows: ADMIN_EXPORT_MAX_ROWS, label: 'ekspor produk' });
        }
        catch (err) {
            if (err instanceof PageLimitError) {
                return NextResponse.json({ error: adminExportLimitMessage('produk', err.observedAtLeast) }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
            }
            if (err instanceof PageQueryError) {
                console.error('[admin/products/export] page error', err.label, err.queryError);
                return queryFailureResponse(err.queryError, 'Gagal membuat ekspor produk.');
            }
            throw err;
        }
        const dataRows: (string | number | null)[][] = rows.map((row) => {
            const umkm = asRecord(row.umkm);
            return [
                asString(row.name) ?? '',
                umkm ? asString(umkm.business_name) ?? '' : '',
                umkm ? asString(umkm.city) ?? '' : '',
                asString(row.category) ?? '',
                asNumber(row.original_price),
                asNumber(row.surplus_price),
                asNumber(row.stock),
                label(VERIFICATION_LABEL, asString(row.verification_status)),
                asString(row.rejection_reason) ?? '',
                label(OPERATIONAL_LABEL, asString(row.status)),
                waktuWib(row.created_at),
                waktuWib(row.deleted_at),
            ];
        });
        return buildAdminExportResponse({
            filename: adminExportFilename('produk'),
            sheet: { name: 'Produk', columns: COLUMNS, rows: dataRows },
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/products/export] unexpected', err);
        return NextResponse.json({ error: 'Gagal membuat ekspor produk.' }, { status: 500 });
    }
}
