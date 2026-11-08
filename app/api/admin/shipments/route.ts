import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, queryFailureResponse, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { firstFailedQuery } from '@/lib/server/supabase-errors';
import { sanitizeSearchTerm } from '@/lib/filter-search';
import { TO_SHIP_STATUSES, TO_SHIP_STALE_HOURS, deriveShipmentState, type ShipmentState, } from '@/lib/shipment-state';
export const runtime = 'nodejs';
const STATE_ALLOWLIST = ['to_ship', 'in_transit', 'late', 'done'] as const;
const SHIPMENT_SELECT = [
    'id',
    'order_code',
    'created_at',
    'buyer_id',
    'umkm_id',
    'vendor_name',
    'product_name',
    'quantity',
    'payment_status',
    'order_status',
    'delivery_option',
    'delivery_address',
    'courier_code',
    'courier_service_name',
    'shipping_rate',
    'delivery_started_at',
    'estimated_arrival_at',
    'biteship_waybill_id',
    'shipment_status',
    'shipment_error',
    'completed_at',
].join(', ');
const SEARCH_ID_LIMIT = 500;
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
function countOf(result: {
    count?: number | null;
}): number {
    return typeof result.count === 'number' && Number.isFinite(result.count) ? result.count : 0;
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
        const stateRaw = (params.get('state') ?? '').trim().toLowerCase();
        if (stateRaw && !(STATE_ALLOWLIST as readonly string[]).includes(stateRaw)) {
            return NextResponse.json({
                error: 'Filter state tidak valid. Nilai yang diizinkan: to_ship, in_transit, late, done.',
            }, { status: 400 });
        }
        const state = stateRaw as ShipmentState | '';
        const search = sanitizeSearchTerm(params.get('search'));
        const db = createAuthedServerClient(authHeader);
        const now = Date.now();
        const nowIso = new Date(now).toISOString();
        const staleToShipCutoffIso = new Date(now - TO_SHIP_STALE_HOURS * 60 * 60 * 1000).toISOString();
        const summaryQueries = [
            ['ringkasan menunggu dikirim', db
                    .from('orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('delivery_option', 'delivery')
                    .eq('payment_status', 'paid')
                    .in('order_status', [...TO_SHIP_STATUSES])],
            ['ringkasan dalam perjalanan', db
                    .from('orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('delivery_option', 'delivery')
                    .eq('order_status', 'out_for_delivery')
                    .or(`estimated_arrival_at.is.null,estimated_arrival_at.gte.${nowIso}`)],
            ['ringkasan terlambat', db
                    .from('orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('delivery_option', 'delivery')
                    .eq('order_status', 'out_for_delivery')
                    .lt('estimated_arrival_at', nowIso)],
            ['ringkasan selesai', db
                    .from('orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('delivery_option', 'delivery')
                    .eq('order_status', 'completed')],
            ['ringkasan menunggu lebih dari 24 jam', db
                    .from('orders')
                    .select('id', { count: 'exact', head: true })
                    .eq('delivery_option', 'delivery')
                    .eq('payment_status', 'paid')
                    .in('order_status', [...TO_SHIP_STATUSES])
                    .lt('created_at', staleToShipCutoffIso)],
        ] as const;
        const summaryResults = await Promise.all(summaryQueries.map(([, query]) => query));
        const failedSummary = firstFailedQuery(summaryQueries.map(([label], index) => [label, summaryResults[index]] as const));
        if (failedSummary) {
            console.error('[admin/shipments] query ringkasan gagal:', failedSummary.label, failedSummary.error);
            return queryFailureResponse(failedSummary.error, 'Gagal memuat ringkasan pengiriman.');
        }
        const summary = {
            toShip: countOf(summaryResults[0]),
            inTransit: countOf(summaryResults[1]),
            late: countOf(summaryResults[2]),
            done: countOf(summaryResults[3]),
            stale: countOf(summaryResults[4]),
        };
        let query = db
            .from('orders')
            .select(SHIPMENT_SELECT, { count: 'exact' })
            .eq('delivery_option', 'delivery')
            .order('created_at', { ascending: false });
        if (state === 'to_ship') {
            query = query.eq('payment_status', 'paid').in('order_status', [...TO_SHIP_STATUSES]);
        }
        else if (state === 'in_transit') {
            query = query
                .eq('order_status', 'out_for_delivery')
                .or(`estimated_arrival_at.is.null,estimated_arrival_at.gte.${nowIso}`);
        }
        else if (state === 'late') {
            query = query
                .eq('order_status', 'out_for_delivery')
                .lt('estimated_arrival_at', nowIso);
        }
        else if (state === 'done') {
            query = query.eq('order_status', 'completed');
        }
        else {
            query = query
                .eq('payment_status', 'paid')
                .in('order_status', [...TO_SHIP_STATUSES, 'out_for_delivery']);
        }
        if (search) {
            const pattern = `%${search}%`;
            const found = await db
                .from('orders')
                .select('id')
                .eq('delivery_option', 'delivery')
                .or(`order_code.ilike.${pattern},vendor_name.ilike.${pattern},product_name.ilike.${pattern},biteship_waybill_id.ilike.${pattern}`)
                .limit(SEARCH_ID_LIMIT);
            if (found.error) {
                console.error('[admin/shipments] pencarian gagal', found.error.message);
                return queryFailureResponse(found.error, 'Gagal mencari pengiriman.');
            }
            const ids = ((found.data ?? []) as unknown as Row[])
                .map((row) => asString(row.id))
                .filter((value): value is string => Boolean(value));
            if (ids.length === 0) {
                return NextResponse.json({ items: [], total: 0, limit, offset, summary });
            }
            query = query.in('id', ids);
        }
        const { data, error, count } = await query.range(offset, offset + limit - 1);
        if (error) {
            console.error('[admin/shipments] fetch error', error.message);
            return queryFailureResponse(error, 'Gagal memuat daftar pengiriman.');
        }
        const rows = ((data ?? []) as unknown) as Row[];
        const umkmIds = Array.from(new Set(rows.map((r) => asString(r.umkm_id)).filter((v): v is string => Boolean(v))));
        const buyerIds = Array.from(new Set(rows.map((r) => asString(r.buyer_id)).filter((v): v is string => Boolean(v))));
        const [umkmRes, buyerRes] = await Promise.all([
            umkmIds.length > 0
                ? db.from('umkm_profiles').select('id, business_name, city').in('id', umkmIds)
                : Promise.resolve({ data: [] as Row[], error: null }),
            buyerIds.length > 0
                ? db.from('profiles').select('id, full_name').in('id', buyerIds)
                : Promise.resolve({ data: [] as Row[], error: null }),
        ]);
        if (umkmRes.error)
            console.error('[admin/shipments] umkm error', umkmRes.error.message);
        if (buyerRes.error)
            console.error('[admin/shipments] buyer error', buyerRes.error.message);
        const umkmById = new Map<string, Row>();
        for (const row of ((umkmRes.data ?? []) as unknown as Row[])) {
            const id = asString(row.id);
            if (id)
                umkmById.set(id, row);
        }
        const buyerById = new Map<string, Row>();
        for (const row of ((buyerRes.data ?? []) as unknown as Row[])) {
            const id = asString(row.id);
            if (id)
                buyerById.set(id, row);
        }
        const items = rows.map((row) => {
            const umkmId = asString(row.umkm_id);
            const buyerId = asString(row.buyer_id);
            const umkm = umkmId ? umkmById.get(umkmId) ?? null : null;
            const buyer = buyerId ? buyerById.get(buyerId) ?? null : null;
            const orderStatus = asString(row.order_status);
            const paymentStatus = asString(row.payment_status);
            const estimatedArrivalAt = asString(row.estimated_arrival_at);
            const deliveryOption = asString(row.delivery_option);
            return {
                id: asString(row.id) ?? '',
                orderCode: asString(row.order_code),
                createdAt: asString(row.created_at),
                storeName: asString(umkm?.business_name) ?? asString(row.vendor_name),
                storeCity: asString(umkm?.city),
                buyerName: asString(buyer?.full_name),
                productName: asString(row.product_name),
                quantity: asNumber(row.quantity),
                courierCode: asString(row.courier_code),
                courierService: asString(row.courier_service_name),
                deliveryAddress: asString(row.delivery_address),
                shippingRate: asNumber(row.shipping_rate),
                orderStatus,
                paymentStatus,
                deliveryStartedAt: asString(row.delivery_started_at),
                estimatedArrivalAt,
                waybillId: asString(row.biteship_waybill_id),
                shipmentStatus: asString(row.shipment_status),
                shipmentError: asString(row.shipment_error),
                completedAt: asString(row.completed_at),
                state: deriveShipmentState({
                    payment_status: paymentStatus,
                    order_status: orderStatus,
                    estimated_arrival_at: estimatedArrivalAt,
                    delivery_option: deliveryOption,
                }),
            };
        });
        return NextResponse.json({
            items,
            total: count ?? items.length,
            limit,
            offset,
            summary,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/shipments] unexpected', err);
        return NextResponse.json({ error: 'Gagal memproses data pengiriman.' }, { status: 500 });
    }
}
