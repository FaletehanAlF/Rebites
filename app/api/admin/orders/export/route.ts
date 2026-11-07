import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, queryFailureResponse, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { PageLimitError, PageQueryError, fetchAllPages, type PostgrestPage, } from '@/lib/server/supabase-rows';
import { ADMIN_EXPORT_ID_CHUNK, ADMIN_EXPORT_MAX_ROWS, adminExportFilename, adminExportLimitMessage, fetchRowsInChunks, } from '@/lib/admin-export-rules';
import { buildAdminExportResponse } from '@/lib/server/admin-export';
import type { XlsxColumn } from '@/lib/xlsx';
import { sanitizeSearchTerm } from '@/lib/filter-search';
import { formatWibDateTime } from '@/lib/wib-time';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const ORDER_STATUS_ALLOWLIST = [
    'pending',
    'paid',
    'processing',
    'ready_for_pickup',
    'out_for_delivery',
    'preparing',
    'ready',
    'completed',
    'cancelled',
    'refunded',
] as const;
const PAYMENT_STATUS_ALLOWLIST = ['unpaid', 'paid', 'failed', 'refunded'] as const;
const DELIVERY_OPTION_ALLOWLIST = ['delivery', 'pickup'] as const;
const LIFECYCLE_ALLOWLIST = ['ongoing', 'completed'] as const;
const SHIPMENT_ALLOWLIST = ['no_shipment', 'has_shipment'] as const;
const ORDERS_SELECT = [
    'id',
    'order_code',
    'created_at',
    'buyer_id',
    'umkm_id',
    'product_id',
    'product_name',
    'quantity',
    'total_price',
    'payment_status',
    'order_status',
    'delivery_option',
    'courier_code',
    'courier_service_name',
    'biteship_waybill_id',
    'estimated_arrival_at',
    'completed_at',
].join(', ');
const ORDER_STATUS_LABEL: Record<string, string> = {
    pending: 'Menunggu',
    paid: 'Dibayar',
    processing: 'Diproses',
    ready_for_pickup: 'Siap diambil',
    out_for_delivery: 'Diantar',
    preparing: 'Disiapkan',
    ready: 'Siap',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
    refunded: 'Dana dikembalikan',
};
const PAYMENT_STATUS_LABEL: Record<string, string> = {
    unpaid: 'Belum dibayar',
    paid: 'Lunas',
    failed: 'Gagal / Kedaluwarsa',
    refunded: 'Dana dikembalikan',
};
const DELIVERY_OPTION_LABEL: Record<string, string> = {
    delivery: 'Diantar',
    pickup: 'Ambil sendiri',
};
const COLUMNS: XlsxColumn[] = [
    { header: 'Kode pesanan', width: 20 },
    { header: 'Dibuat (WIB)', width: 20 },
    { header: 'Pembeli', width: 24, wrap: true },
    { header: 'Toko', width: 26, wrap: true },
    { header: 'Produk', width: 26, wrap: true },
    { header: 'Jumlah', width: 8 },
    { header: 'Total', width: 14 },
    { header: 'Status pesanan', width: 16 },
    { header: 'Status pembayaran', width: 18 },
    { header: 'Opsi kirim', width: 14 },
    { header: 'Kurir', width: 18, wrap: true },
    { header: 'Resi', width: 22 },
    { header: 'Estimasi tiba (WIB)', width: 20 },
    { header: 'Selesai (WIB)', width: 20 },
];
type Row = Record<string, unknown>;
function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}
function asNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
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
function isAllowed(list: readonly string[], raw: string): boolean {
    return list.includes(raw);
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
        const orderStatus = (params.get('order_status') ?? '').trim().toLowerCase();
        if (orderStatus && !isAllowed(ORDER_STATUS_ALLOWLIST, orderStatus)) {
            return NextResponse.json({ error: 'Filter order_status tidak valid.' }, { status: 400 });
        }
        const paymentStatus = (params.get('payment_status') ?? '').trim().toLowerCase();
        if (paymentStatus && !isAllowed(PAYMENT_STATUS_ALLOWLIST, paymentStatus)) {
            return NextResponse.json({ error: 'Filter payment_status tidak valid.' }, { status: 400 });
        }
        const deliveryOption = (params.get('delivery_option') ?? '').trim().toLowerCase();
        if (deliveryOption && !isAllowed(DELIVERY_OPTION_ALLOWLIST, deliveryOption)) {
            return NextResponse.json({ error: 'Filter delivery_option tidak valid.' }, { status: 400 });
        }
        const lifecycle = (params.get('lifecycle') ?? '').trim().toLowerCase();
        if (lifecycle && !isAllowed(LIFECYCLE_ALLOWLIST, lifecycle)) {
            return NextResponse.json({ error: 'Filter lifecycle tidak valid.' }, { status: 400 });
        }
        const shipment = (params.get('shipment') ?? '').trim().toLowerCase();
        if (shipment && !isAllowed(SHIPMENT_ALLOWLIST, shipment)) {
            return NextResponse.json({ error: 'Filter shipment tidak valid.' }, { status: 400 });
        }
        const db = createAuthedServerClient(authHeader);
        let searchUmkmIds: string[] = [];
        let searchProductIds: string[] = [];
        let searchBuyerIds: string[] = [];
        if (search) {
            const pattern = `%${search}%`;
            const [umkmRes, productRes, buyerRes] = await Promise.all([
                db
                    .from('umkm_profiles')
                    .select('id')
                    .or(`business_name.ilike.${pattern},slug.ilike.${pattern}`)
                    .limit(200),
                db.from('products').select('id').ilike('name', pattern).limit(200),
                db
                    .from('profiles')
                    .select('id')
                    .or(`email.ilike.${pattern},full_name.ilike.${pattern}`)
                    .limit(200),
            ]);
            if (umkmRes.error) {
                console.error('[admin/orders/export] search umkm error', umkmRes.error.message);
                return queryFailureResponse(umkmRes.error, 'Gagal mencari pesanan untuk ekspor.');
            }
            if (productRes.error) {
                console.error('[admin/orders/export] search products error', productRes.error.message);
                return queryFailureResponse(productRes.error, 'Gagal mencari pesanan untuk ekspor.');
            }
            if (buyerRes.error) {
                console.error('[admin/orders/export] search buyers error', buyerRes.error.message);
                return queryFailureResponse(buyerRes.error, 'Gagal mencari pesanan untuk ekspor.');
            }
            const collect = (data: unknown): string[] => (((data ?? []) as unknown) as Row[])
                .map((row) => row.id)
                .filter((value): value is string => typeof value === 'string' && value.length > 0)
                .slice(0, 200);
            searchUmkmIds = collect(umkmRes.data);
            searchProductIds = collect(productRes.data);
            searchBuyerIds = collect(buyerRes.data);
        }
        let rows: Row[];
        try {
            rows = await fetchAllPages<Row>((from, to) => {
                let query = db
                    .from('orders')
                    .select(ORDERS_SELECT)
                    .order('created_at', { ascending: false })
                    .order('id', { ascending: false });
                if (orderStatus)
                    query = query.eq('order_status', orderStatus);
                if (paymentStatus)
                    query = query.eq('payment_status', paymentStatus);
                if (deliveryOption)
                    query = query.eq('delivery_option', deliveryOption);
                if (lifecycle)
                    query = query.eq('lifecycle_status', lifecycle);
                if (shipment === 'no_shipment')
                    query = query.is('biteship_order_id', null);
                if (shipment === 'has_shipment')
                    query = query.not('biteship_order_id', 'is', null);
                if (search) {
                    const clauses = [
                        `order_code.ilike.%${search}%`,
                        `xendit_invoice_id.ilike.%${search}%`,
                        `vendor_name.ilike.%${search}%`,
                        `product_name.ilike.%${search}%`,
                    ];
                    if (searchUmkmIds.length > 0)
                        clauses.push(`umkm_id.in.(${searchUmkmIds.join(',')})`);
                    if (searchProductIds.length > 0) {
                        clauses.push(`product_id.in.(${searchProductIds.join(',')})`);
                    }
                    if (searchBuyerIds.length > 0) {
                        clauses.push(`buyer_id.in.(${searchBuyerIds.join(',')})`);
                    }
                    query = query.or(clauses.join(','));
                }
                return query.range(from, to) as unknown as PromiseLike<PostgrestPage<Row>>;
            }, { maxRows: ADMIN_EXPORT_MAX_ROWS, label: 'ekspor pesanan' });
        }
        catch (err) {
            if (err instanceof PageLimitError) {
                return NextResponse.json({ error: adminExportLimitMessage('pesanan', err.observedAtLeast) }, { status: 413, headers: { 'Cache-Control': 'no-store' } });
            }
            if (err instanceof PageQueryError) {
                console.error('[admin/orders/export] page error', err.label, err.queryError);
                return queryFailureResponse(err.queryError, 'Gagal membuat ekspor pesanan.');
            }
            throw err;
        }
        const umkmIds = Array.from(new Set(rows.map((row) => asString(row.umkm_id)).filter((v): v is string => Boolean(v))));
        const buyerIds = Array.from(new Set(rows.map((row) => asString(row.buyer_id)).filter((v): v is string => Boolean(v))));
        const productIds = Array.from(new Set(rows.map((row) => asString(row.product_id)).filter((v): v is string => Boolean(v))));
        const umkmResult = await fetchRowsInChunks<Row>(umkmIds, ADMIN_EXPORT_ID_CHUNK, (chunk) => db.from('umkm_profiles').select('id, business_name').in('id', chunk));
        if (umkmResult.error) {
            console.error('[admin/orders/export] umkm error', umkmResult.error);
            return queryFailureResponse(umkmResult.error, 'Gagal membuat ekspor pesanan.');
        }
        const buyerResult = await fetchRowsInChunks<Row>(buyerIds, ADMIN_EXPORT_ID_CHUNK, (chunk) => db.from('profiles').select('id, full_name, email').in('id', chunk));
        if (buyerResult.error) {
            console.error('[admin/orders/export] buyers error', buyerResult.error);
            return queryFailureResponse(buyerResult.error, 'Gagal membuat ekspor pesanan.');
        }
        const productResult = await fetchRowsInChunks<Row>(productIds, ADMIN_EXPORT_ID_CHUNK, (chunk) => db.from('products').select('id, name').in('id', chunk));
        if (productResult.error) {
            console.error('[admin/orders/export] products error', productResult.error);
            return queryFailureResponse(productResult.error, 'Gagal membuat ekspor pesanan.');
        }
        const umkmById = new Map<string, Row>();
        for (const row of umkmResult.rows) {
            const id = asString(row.id);
            if (id)
                umkmById.set(id, row);
        }
        const buyerById = new Map<string, Row>();
        for (const row of buyerResult.rows) {
            const id = asString(row.id);
            if (id)
                buyerById.set(id, row);
        }
        const productById = new Map<string, Row>();
        for (const row of productResult.rows) {
            const id = asString(row.id);
            if (id)
                productById.set(id, row);
        }
        const dataRows: (string | number | null)[][] = rows.map((row) => {
            const umkmId = asString(row.umkm_id);
            const buyerId = asString(row.buyer_id);
            const productId = asString(row.product_id);
            const umkm = umkmId ? umkmById.get(umkmId) ?? null : null;
            const buyer = buyerId ? buyerById.get(buyerId) ?? null : null;
            const product = productId ? productById.get(productId) ?? null : null;
            return [
                asString(row.order_code) ?? '',
                waktuWib(row.created_at),
                buyer ? asString(buyer.full_name) ?? asString(buyer.email) ?? '' : '',
                umkm ? asString(umkm.business_name) ?? '' : asString(row.vendor_name) ?? '',
                product ? asString(product.name) ?? '' : asString(row.product_name) ?? '',
                asNumber(row.quantity),
                asNumber(row.total_price),
                label(ORDER_STATUS_LABEL, asString(row.order_status)),
                label(PAYMENT_STATUS_LABEL, asString(row.payment_status)),
                label(DELIVERY_OPTION_LABEL, asString(row.delivery_option)),
                asString(row.courier_service_name) ?? asString(row.courier_code) ?? '',
                asString(row.biteship_waybill_id) ?? '',
                waktuWib(row.estimated_arrival_at),
                waktuWib(row.completed_at),
            ];
        });
        return buildAdminExportResponse({
            filename: adminExportFilename('pesanan'),
            sheet: { name: 'Pesanan', columns: COLUMNS, rows: dataRows },
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/orders/export] unexpected', err);
        return NextResponse.json({ error: 'Gagal membuat ekspor pesanan.' }, { status: 500 });
    }
}
