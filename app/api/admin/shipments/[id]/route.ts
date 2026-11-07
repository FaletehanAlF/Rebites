import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, queryFailureResponse, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { deriveShipmentState } from '@/lib/shipment-state';
export const runtime = 'nodejs';
const DETAIL_SELECT = [
    'id',
    'order_code',
    'created_at',
    'buyer_id',
    'umkm_id',
    'product_id',
    'vendor_name',
    'product_name',
    'quantity',
    'unit_price',
    'subtotal',
    'discount',
    'service_fee',
    'delivery_fee',
    'total_price',
    'payment_status',
    'payment_method_id',
    'order_status',
    'delivery_option',
    'delivery_address',
    'address_snapshot',
    'shipping_snapshot',
    'courier_code',
    'courier_service_name',
    'shipping_rate',
    'delivery_started_at',
    'estimated_arrival_at',
    'delivery_distance_km',
    'distance_km',
    'estimated_delivery_minutes',
    'biteship_waybill_id',
    'shipment_status',
    'shipment_error',
    'completed_at',
].join(', ');
type Row = Record<string, unknown>;
function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}
function asNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
function asCoordinate(value: unknown, min: number, max: number): number | null {
    if (value === null || value === undefined)
        return null;
    if (typeof value === 'string' && value.trim() === '')
        return null;
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed))
        return null;
    if (parsed < min || parsed > max)
        return null;
    return parsed;
}
export async function GET(req: NextRequest, { params }: {
    params: {
        id: string;
    };
}) {
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
        const id = params.id?.trim();
        if (!id) {
            return NextResponse.json({ error: 'ID pesanan wajib.' }, { status: 400 });
        }
        const db = createAuthedServerClient(authHeader);
        const { data, error } = await db
            .from('orders')
            .select(DETAIL_SELECT)
            .eq('id', id)
            .maybeSingle();
        if (error) {
            console.error('[admin/shipments/:id] fetch error', error.message);
            return queryFailureResponse(error, 'Gagal memuat detail pengiriman.');
        }
        if (!data) {
            return NextResponse.json({ error: 'Kiriman tidak ditemukan.' }, { status: 404 });
        }
        const row = data as unknown as Row;
        const productId = asString(row.product_id);
        const buyerId = asString(row.buyer_id);
        const umkmId = asString(row.umkm_id);
        const [productRes, buyerRes, umkmRes, assignmentRes] = await Promise.all([
            productId
                ? db.from('products').select('id, name, image_url').eq('id', productId).maybeSingle()
                : Promise.resolve({ data: null as Row | null, error: null }),
            buyerId
                ? db.from('profiles').select('id, full_name').eq('id', buyerId).maybeSingle()
                : Promise.resolve({ data: null as Row | null, error: null }),
            umkmId
                ? db.from('umkm_profiles').select('id, business_name, city').eq('id', umkmId).maybeSingle()
                : Promise.resolve({ data: null as Row | null, error: null }),
            db
                .from('delivery_assignments')
                .select('courier_user_id, status')
                .eq('order_id', id)
                .maybeSingle(),
        ]);
        if (productRes.error)
            console.error('[admin/shipments/:id] product error', productRes.error.message);
        if (buyerRes.error)
            console.error('[admin/shipments/:id] buyer error', buyerRes.error.message);
        if (umkmRes.error)
            console.error('[admin/shipments/:id] umkm error', umkmRes.error.message);
        if (assignmentRes.error) {
            console.error('[admin/shipments/:id] assignment error', assignmentRes.error.message);
        }
        const product = (productRes.data ?? null) as Row | null;
        const buyer = (buyerRes.data ?? null) as Row | null;
        const umkm = (umkmRes.data ?? null) as Row | null;
        const courierUserId = asString((assignmentRes.data as Row | null)?.courier_user_id);
        let courierName: string | null = null;
        let courierVehicle: string | null = null;
        if (courierUserId) {
            const courierRes = await db
                .from('couriers')
                .select('full_name, vehicle_type')
                .eq('user_id', courierUserId)
                .maybeSingle();
            if (courierRes.error) {
                console.error('[admin/shipments/:id] courier error', courierRes.error.message);
            }
            else {
                const courier = (courierRes.data ?? null) as Row | null;
                courierName = asString(courier?.full_name);
                courierVehicle = asString(courier?.vehicle_type);
            }
        }
        const shippingSnapshot = (row.shipping_snapshot ?? null) as Row | null;
        const origin = (shippingSnapshot?.origin ?? null) as Row | null;
        const destination = (row.address_snapshot ?? null) as Row | null;
        let originLatitude = asCoordinate(origin?.latitude, -90, 90);
        let originLongitude = asCoordinate(origin?.longitude, -180, 180);
        let destinationLatitude = asCoordinate(destination?.latitude, -90, 90);
        let destinationLongitude = asCoordinate(destination?.longitude, -180, 180);
        if (originLatitude === 0 && originLongitude === 0) {
            originLatitude = null;
            originLongitude = null;
        }
        if (destinationLatitude === 0 && destinationLongitude === 0) {
            destinationLatitude = null;
            destinationLongitude = null;
        }
        const orderStatus = asString(row.order_status);
        const paymentStatus = asString(row.payment_status);
        const estimatedArrivalAt = asString(row.estimated_arrival_at);
        const deliveryOption = asString(row.delivery_option);
        const detail = {
            id: asString(row.id) ?? '',
            orderCode: asString(row.order_code),
            createdAt: asString(row.created_at),
            storeName: asString(umkm?.business_name) ?? asString(row.vendor_name),
            storeCity: asString(umkm?.city),
            buyerName: asString(buyer?.full_name),
            productName: asString(product?.name) ?? asString(row.product_name),
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
            productId,
            productImageUrl: asString(product?.image_url),
            unitPrice: asNumber(row.unit_price),
            subtotal: asNumber(row.subtotal),
            discount: asNumber(row.discount),
            serviceFee: asNumber(row.service_fee),
            totalPrice: asNumber(row.total_price),
            paymentMethodId: asString(row.payment_method_id),
            estimatedDeliveryMinutes: asNumber(row.estimated_delivery_minutes),
            distanceKm: asNumber(row.delivery_distance_km) ?? asNumber(row.distance_km),
            originLatitude,
            originLongitude,
            destinationLatitude,
            destinationLongitude,
            courierName,
            courierVehicle,
        };
        return NextResponse.json({ detail });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[admin/shipments/:id] unexpected', err);
        return NextResponse.json({ error: 'Gagal memproses detail pengiriman.' }, { status: 500 });
    }
}
