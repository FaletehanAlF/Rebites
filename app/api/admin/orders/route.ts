import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { sanitizeSearchTerm } from '@/lib/filter-search';
import { deriveOrderMonitoringFlags } from '@/lib/order-monitoring-flags';
export const runtime = 'nodejs';
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
type Row = Record<string, unknown>;
const ORDERS_SELECT = [
    'id',
    'order_code',
    'created_at',
    'buyer_id',
    'umkm_id',
    'product_id',
    'product_slug',
    'vendor_slug',
    'vendor_name',
    'product_name',
    'quantity',
    'unit_price',
    'subtotal',
    'discount',
    'service_fee',
    'delivery_fee',
    'total_before_coin',
    'coin_used',
    'coin_earned',
    'total_price',
    'promo_code',
    'payment_status',
    'payment_method_id',
    'xendit_invoice_id',
    'order_status',
    'lifecycle_status',
    'progress_status',
    'delivery_option',
    'delivery_address',
    'address_snapshot',
    'shipping_snapshot',
    'courier_code',
    'courier_service_code',
    'courier_service_name',
    'shipping_rate',
    'delivery_started_at',
    'estimated_arrival_at',
    'delivery_distance_km',
    'estimated_delivery_minutes',
    'biteship_order_id',
    'biteship_tracking_id',
    'biteship_waybill_id',
    'shipment_status',
    'shipment_created_at',
    'shipment_error',
    'completed_at',
    'estimated_minutes',
    'estimated_completion_at',
].join(', ');
function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}
function asNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
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
        const rawLimit = Number(params.get('limit') ?? '20');
        const rawOffset = Number(params.get('offset') ?? '0');
        const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, Math.floor(rawLimit))) : 20;
        const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;
        const search = sanitizeSearchTerm(params.get('search'));
        const orderStatusRaw = (params.get('order_status') ?? '').trim().toLowerCase();
        if (orderStatusRaw && !isAllowed(ORDER_STATUS_ALLOWLIST, orderStatusRaw)) {
            return NextResponse.json({
                error: 'Filter order_status tidak valid. Nilai yang diizinkan: pending, paid, processing, ready_for_pickup, out_for_delivery, preparing, ready, completed, cancelled, refunded.',
            }, { status: 400 });
        }
        const paymentStatusRaw = (params.get('payment_status') ?? '').trim().toLowerCase();
        if (paymentStatusRaw && !isAllowed(PAYMENT_STATUS_ALLOWLIST, paymentStatusRaw)) {
            return NextResponse.json({ error: 'Filter payment_status tidak valid. Nilai yang diizinkan: unpaid, paid, failed, refunded.' }, { status: 400 });
        }
        const deliveryRaw = (params.get('delivery_option') ?? '').trim().toLowerCase();
        if (deliveryRaw && !isAllowed(DELIVERY_OPTION_ALLOWLIST, deliveryRaw)) {
            return NextResponse.json({ error: 'Filter delivery_option tidak valid. Nilai yang diizinkan: delivery, pickup.' }, { status: 400 });
        }
        const lifecycleRaw = (params.get('lifecycle') ?? '').trim().toLowerCase();
        if (lifecycleRaw && !isAllowed(LIFECYCLE_ALLOWLIST, lifecycleRaw)) {
            return NextResponse.json({ error: 'Filter lifecycle tidak valid. Nilai yang diizinkan: ongoing, completed.' }, { status: 400 });
        }
        const shipmentRaw = (params.get('shipment') ?? '').trim().toLowerCase();
        if (shipmentRaw && !isAllowed(SHIPMENT_ALLOWLIST, shipmentRaw)) {
            return NextResponse.json({ error: 'Filter shipment tidak valid. Nilai yang diizinkan: no_shipment, has_shipment.' }, { status: 400 });
        }
        const db = createAuthedServerClient(authHeader);
        let searchUmkmIds: string[] = [];
        let searchProductIds: string[] = [];
        let searchBuyerIds: string[] = [];
        if (search) {
            const pattern = `%${search}%`;
            const [umkmRes, productRes, buyerRes] = await Promise.all([
                db.from('umkm_profiles').select('id').or(`business_name.ilike.${pattern},slug.ilike.${pattern}`).limit(200),
                db.from('products').select('id').ilike('name', pattern).limit(200),
                db.from('profiles').select('id').or(`email.ilike.${pattern},full_name.ilike.${pattern}`).limit(200),
            ]);
            if (umkmRes.error)
                console.error('[admin/orders] search umkm error', umkmRes.error.message);
            if (productRes.error)
                console.error('[admin/orders] search products error', productRes.error.message);
            if (buyerRes.error)
                console.error('[admin/orders] search buyers error', buyerRes.error.message);
            const collect = (data: unknown): string[] => (((data ?? []) as unknown) as Row[])
                .map((r) => r.id)
                .filter((v): v is string => typeof v === 'string' && v.length > 0)
                .slice(0, 200);
            searchUmkmIds = collect(umkmRes.data);
            searchProductIds = collect(productRes.data);
            searchBuyerIds = collect(buyerRes.data);
        }
        let query = db
            .from('orders')
            .select(ORDERS_SELECT, { count: 'exact' })
            .order('created_at', { ascending: false });
        if (orderStatusRaw)
            query = query.eq('order_status', orderStatusRaw);
        if (paymentStatusRaw)
            query = query.eq('payment_status', paymentStatusRaw);
        if (deliveryRaw)
            query = query.eq('delivery_option', deliveryRaw);
        if (lifecycleRaw)
            query = query.eq('lifecycle_status', lifecycleRaw);
        if (shipmentRaw === 'no_shipment')
            query = query.is('biteship_order_id', null);
        if (shipmentRaw === 'has_shipment')
            query = query.not('biteship_order_id', 'is', null);
        if (search) {
            const invoicePattern = `%${search}%`;
            const clauses = [
                `order_code.ilike.${invoicePattern}`,
                `xendit_invoice_id.ilike.${invoicePattern}`,
                `vendor_name.ilike.${invoicePattern}`,
                `vendor_slug.ilike.${invoicePattern}`,
                `product_name.ilike.${invoicePattern}`,
            ];
            if (searchUmkmIds.length > 0)
                clauses.push(`umkm_id.in.(${searchUmkmIds.join(',')})`);
            if (searchProductIds.length > 0)
                clauses.push(`product_id.in.(${searchProductIds.join(',')})`);
            if (searchBuyerIds.length > 0)
                clauses.push(`buyer_id.in.(${searchBuyerIds.join(',')})`);
            query = query.or(clauses.join(','));
        }
        const { data, error, count } = await query.range(offset, offset + limit - 1);
        if (error) {
            console.error('[admin/orders] fetch error', error.message);
            return NextResponse.json({ error: 'Gagal memuat daftar pesanan.' }, { status: 500 });
        }
        const rows = ((data ?? []) as unknown) as Row[];
        const umkmIds = Array.from(new Set(rows.map((r) => r.umkm_id).filter((v): v is string => typeof v === 'string')));
        const buyerIds = Array.from(new Set(rows.map((r) => r.buyer_id).filter((v): v is string => typeof v === 'string')));
        const productIds = Array.from(new Set(rows.map((r) => r.product_id).filter((v): v is string => typeof v === 'string')));
        const [umkmRes, buyerRes, productRes] = await Promise.all([
            umkmIds.length > 0
                ? db.from('umkm_profiles').select('id, business_name, slug, is_verified').in('id', umkmIds)
                : Promise.resolve({ data: [] as Row[], error: null }),
            buyerIds.length > 0
                ? db.from('profiles').select('id, full_name, email').in('id', buyerIds)
                : Promise.resolve({ data: [] as Row[], error: null }),
            productIds.length > 0
                ? db.from('products').select('id, name, image_url').in('id', productIds)
                : Promise.resolve({ data: [] as Row[], error: null }),
        ]);
        if (umkmRes.error)
            console.error('[admin/orders] umkm error', umkmRes.error.message);
        if (buyerRes.error)
            console.error('[admin/orders] buyers error', buyerRes.error.message);
        if (productRes.error)
            console.error('[admin/orders] products error', productRes.error.message);
        const umkmById = new Map<string, Row>();
        for (const u of ((umkmRes.data ?? []) as unknown as Row[])) {
            if (typeof u.id === 'string')
                umkmById.set(u.id, u);
        }
        const buyerById = new Map<string, Row>();
        for (const b of ((buyerRes.data ?? []) as unknown as Row[])) {
            if (typeof b.id === 'string')
                buyerById.set(b.id, b);
        }
        const productById = new Map<string, Row>();
        for (const p of ((productRes.data ?? []) as unknown as Row[])) {
            if (typeof p.id === 'string')
                productById.set(p.id, p);
        }
        const items = rows.map((r) => {
            const umkmId = asString(r.umkm_id);
            const buyerId = asString(r.buyer_id);
            const productId = asString(r.product_id);
            const umkm = umkmId ? (umkmById.get(umkmId) ?? null) : null;
            const buyer = buyerId ? (buyerById.get(buyerId) ?? null) : null;
            const product = productId ? (productById.get(productId) ?? null) : null;
            const paymentStatus = asString(r.payment_status);
            const orderStatus = asString(r.order_status);
            const lifecycleStatus = asString(r.lifecycle_status);
            const progressStatus = asString(r.progress_status);
            const deliveryOption = asString(r.delivery_option);
            const biteshipOrderId = asString(r.biteship_order_id);
            const flags = deriveOrderMonitoringFlags({
                payment_status: paymentStatus,
                order_status: orderStatus,
                lifecycle_status: lifecycleStatus,
                progress_status: progressStatus,
                delivery_option: deliveryOption,
                biteship_order_id: biteshipOrderId,
            });
            return {
                id: r.id,
                order_code: asString(r.order_code),
                created_at: asString(r.created_at),
                buyer_id: buyerId,
                umkm_id: umkmId,
                product_id: productId,
                product_slug: asString(r.product_slug),
                vendor_slug: asString(r.vendor_slug),
                vendor_name: asString(r.vendor_name),
                product_name: asString(r.product_name),
                quantity: asNumber(r.quantity),
                unit_price: asNumber(r.unit_price),
                subtotal: asNumber(r.subtotal),
                discount: asNumber(r.discount),
                service_fee: asNumber(r.service_fee),
                delivery_fee: asNumber(r.delivery_fee),
                total_before_coin: asNumber(r.total_before_coin),
                coin_used: asNumber(r.coin_used),
                coin_earned: asNumber(r.coin_earned),
                total_price: asNumber(r.total_price),
                promo_code: asString(r.promo_code),
                payment_status: paymentStatus,
                payment_method_id: asString(r.payment_method_id),
                xendit_invoice_id: asString(r.xendit_invoice_id),
                order_status: orderStatus,
                lifecycle_status: lifecycleStatus,
                progress_status: progressStatus,
                delivery_option: deliveryOption,
                delivery_address: asString(r.delivery_address),
                address_snapshot: (r.address_snapshot as Record<string, unknown> | null) ?? null,
                shipping_snapshot: (r.shipping_snapshot as Record<string, unknown> | null) ?? null,
                courier_code: asString(r.courier_code),
                courier_service_code: asString(r.courier_service_code),
                courier_service_name: asString(r.courier_service_name),
                shipping_rate: asNumber(r.shipping_rate),
                delivery_started_at: asString(r.delivery_started_at),
                estimated_arrival_at: asString(r.estimated_arrival_at),
                delivery_distance_km: typeof r.delivery_distance_km === 'number' ? r.delivery_distance_km : null,
                estimated_delivery_minutes: asNumber(r.estimated_delivery_minutes),
                biteship_order_id: biteshipOrderId,
                biteship_tracking_id: asString(r.biteship_tracking_id),
                biteship_waybill_id: asString(r.biteship_waybill_id),
                shipment_status: asString(r.shipment_status),
                shipment_created_at: asString(r.shipment_created_at),
                shipment_error: asString(r.shipment_error),
                completed_at: asString(r.completed_at),
                estimated_minutes: asNumber(r.estimated_minutes),
                estimated_completion_at: asString(r.estimated_completion_at),
                buyer: buyer
                    ? { id: buyer.id ?? null, full_name: buyer.full_name ?? null, email: buyer.email ?? null }
                    : null,
                umkm: umkm
                    ? {
                        id: umkm.id ?? null,
                        business_name: umkm.business_name ?? null,
                        slug: umkm.slug ?? null,
                        is_verified: umkm.is_verified ?? false,
                    }
                    : {
                        id: umkmId,
                        business_name: asString(r.vendor_name),
                        slug: asString(r.vendor_slug),
                        is_verified: false,
                    },
                product: product
                    ? { id: product.id ?? null, name: product.name ?? null, image_url: product.image_url ?? null }
                    : {
                        id: productId,
                        name: asString(r.product_name),
                        image_url: null,
                    },
                flags,
            };
        });
        return NextResponse.json({
            items,
            total: count ?? items.length,
            limit,
            offset,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/orders] unexpected', err);
        return NextResponse.json({ error: "Gagal memuat pesanan." }, { status: 500 });
    }
}
