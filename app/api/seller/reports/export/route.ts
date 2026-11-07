import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getUserFromBearer, isSupabaseUnavailable, queryFailureResponse, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { PageLimitError, PageQueryError, fetchAllPages, type PostgrestPage, } from '@/lib/server/supabase-rows';
import { buildXlsxWorkbook } from '@/lib/xlsx';
import { buildSellerOrderFilter, buildSellerReport, buildSellerReportSheets, parseSellerReportPeriod, sellerReportFilename, type SellerReportOrder, } from '@/lib/seller-report';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const EXPORT_MAX_ROWS = 5000;
const EXPORT_SELECT = [
    'order_code',
    'created_at',
    'product_name',
    'quantity',
    'total_price',
    'order_status',
    'lifecycle_status',
].join(', ');
type OrderExportRow = Record<string, unknown>;
function asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}
function asNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed))
            return parsed;
    }
    return 0;
}
function toReportOrder(row: OrderExportRow): SellerReportOrder {
    return {
        orderCode: asString(row.order_code) || asString(row.id),
        createdAt: asString(row.created_at),
        productName: asString(row.product_name),
        quantity: asNumber(row.quantity),
        total: asNumber(row.total_price),
        orderStatus: asString(row.order_status) || null,
        status: asString(row.lifecycle_status) || null,
    };
}
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const user = await getUserFromBearer(authHeader);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
        }
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
        }
        const db = createAuthedServerClient(authHeader);
        const umkmResult = await db
            .from('umkm_profiles')
            .select('id, slug, business_name')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (umkmResult.error) {
            console.error('[seller/reports/export] umkm error', umkmResult.error.message);
            return queryFailureResponse(umkmResult.error, 'Gagal memuat data toko.');
        }
        const umkm = umkmResult.data as {
            id?: string | null;
            slug?: string | null;
            business_name?: string | null;
        } | null;
        if (!umkm?.id && !umkm?.slug) {
            return NextResponse.json({ error: 'Akun ini belum memiliki toko.' }, { status: 403 });
        }
        const orderFilter = buildSellerOrderFilter({
            id: umkm.id ?? null,
            slug: umkm.slug ?? null,
        });
        if (!orderFilter) {
            return NextResponse.json({ error: 'Akun ini belum memiliki toko.' }, { status: 403 });
        }
        let rows: OrderExportRow[];
        try {
            rows = await fetchAllPages<OrderExportRow>((from, to) => {
                const query = db
                    .from('orders')
                    .select(EXPORT_SELECT)
                    .or(orderFilter)
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: false });
                return query.range(from, to) as unknown as PromiseLike<PostgrestPage<OrderExportRow>>;
            }, { maxRows: EXPORT_MAX_ROWS, label: 'ekspor laporan penjualan' });
        }
        catch (err) {
            if (err instanceof PageLimitError) {
                return NextResponse.json({
                    error: `Pesanan melebihi batas ekspor ${EXPORT_MAX_ROWS.toLocaleString('id-ID')} baris. Persempit rentang laporan.`,
                }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
            }
            if (err instanceof PageQueryError) {
                console.error('[seller/reports/export] page error', err.label, err.queryError);
                return queryFailureResponse(err.queryError, 'Gagal membuat ekspor laporan.');
            }
            throw err;
        }
        const period = parseSellerReportPeriod(req.nextUrl.searchParams.get('periode'));
        const report = buildSellerReport(rows.map(toReportOrder), { period });
        if (report.summary.orders === 0) {
            return new NextResponse(null, {
                status: 204,
                headers: { 'Cache-Control': 'no-store' },
            });
        }
        const workbook = buildXlsxWorkbook({ sheets: buildSellerReportSheets(report) });
        const filename = sellerReportFilename(period, {
            storeSlug: umkm.slug ?? null,
        });
        return new NextResponse(new Uint8Array(workbook), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Cache-Control': 'no-store',
                'X-Content-Type-Options': 'nosniff',
                'X-Export-Row-Count': String(report.summary.orders),
            },
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[seller/reports/export] unexpected', err);
        return NextResponse.json({ error: 'Gagal membuat ekspor laporan.' }, { status: 500 });
    }
}
