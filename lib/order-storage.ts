'use client';
import { supabase } from './supabase';
import { getSellerUmkm } from './product-storage';
import { resolveImageSrc } from './image-path';
import type { StoredOrder, FulfillmentMode, AddressSnapshot, ShippingSnapshot } from './types';
import { shouldAutoComplete } from './order-expiry';
export const ORDERS_UPDATED_EVENT = 'rebites-orders-updated';
export function createOrderId(): string {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `RB-${stamp}${rand}`;
}
function dispatchUpdated(): void {
    if (typeof window === 'undefined')
        return;
    window.dispatchEvent(new Event(ORDERS_UPDATED_EVENT));
}
type OrderRow = Record<string, any>;
export function rowToStoredOrder(row: OrderRow): StoredOrder {
    return {
        orderId: row.order_code ?? row.id,
        dbId: row.id ?? undefined,
        userId: row.buyer_id ?? undefined,
        productId: row.product_slug ?? '',
        productName: row.product_name ?? '',
        vendorName: row.vendor_name ?? '',
        vendorSlug: row.vendor_slug ?? '',
        image: resolveImageSrc(row.image_url as string | null),
        quantity: row.quantity ?? 1,
        fulfillment: (row.delivery_option === 'delivery'
            ? 'delivery'
            : 'pickup') as FulfillmentMode,
        addressSnapshot: (row.address_snapshot ?? null) as AddressSnapshot | null,
        paymentMethodId: row.payment_method_id ?? 'tanpa-pembayaran',
        subtotal: row.subtotal ?? 0,
        discount: row.discount ?? 0,
        serviceFee: row.service_fee ?? 0,
        deliveryFee: row.delivery_fee ?? 0,
        totalBeforeCoin: row.total_before_coin ?? undefined,
        coinUsed: row.coin_used ?? undefined,
        total: row.total_price ?? 0,
        coinEarned: row.coin_earned ?? 0,
        createdAt: row.created_at ?? new Date().toISOString(),
        unitPrice: row.unit_price ?? undefined,
        promoCode: row.promo_code ?? null,
        status: row.lifecycle_status === 'completed' || row.lifecycle_status === 'ongoing'
            ? (row.lifecycle_status as StoredOrder['status'])
            : 'ongoing',
        orderStatus: row.order_status ?? row.lifecycle_status ?? 'ongoing',
        estimatedMinutes: row.estimated_minutes ?? undefined,
        estimatedCompletionAt: row.estimated_completion_at ?? undefined,
        completedAt: row.completed_at ?? undefined,
        distanceKm: row.distance_km ?? undefined,
        vendorAddress: row.vendor_address ?? undefined,
        vendorOpenHours: row.vendor_open_hours ?? undefined,
        preparationMinutes: row.preparation_minutes ?? undefined,
        co2eSavedKg: row.co2e_saved_kg ?? undefined,
        deliveryDistanceKm: row.delivery_distance_km ?? undefined,
        estimatedDeliveryMinutes: row.estimated_delivery_minutes ?? undefined,
        deliveryStartedAt: row.delivery_started_at ?? undefined,
        estimatedArrivalAt: row.estimated_arrival_at ?? undefined,
        shippingSnapshot: (row.shipping_snapshot ?? null) as ShippingSnapshot | null,
        courierCode: row.courier_code ?? undefined,
        courierServiceCode: row.courier_service_code ?? undefined,
        courierServiceName: row.courier_service_name ?? undefined,
        shippingRate: row.shipping_rate ?? undefined,
        biteshipOrderId: row.biteship_order_id ?? undefined,
        biteshipTrackingId: row.biteship_tracking_id ?? undefined,
        biteshipWaybillId: row.biteship_waybill_id ?? undefined,
        shipmentStatus: row.shipment_status ?? undefined,
        shipmentCreatedAt: row.shipment_created_at ?? undefined,
        shipmentError: row.shipment_error ?? undefined,
        progressStatus: row.progress_status ?? undefined,
    };
}
function storedOrderToRow(order: StoredOrder): OrderRow {
    return {
        order_code: order.orderId,
        buyer_id: order.userId,
        product_slug: order.productId,
        product_name: order.productName,
        vendor_name: order.vendorName,
        vendor_slug: order.vendorSlug,
        image_url: order.image,
        quantity: order.quantity,
        delivery_option: order.fulfillment,
        address_snapshot: order.addressSnapshot,
        payment_method_id: order.paymentMethodId,
        unit_price: order.unitPrice,
        subtotal: order.subtotal,
        discount: order.discount,
        service_fee: order.serviceFee,
        delivery_fee: order.deliveryFee,
        total_before_coin: order.totalBeforeCoin,
        coin_used: order.coinUsed,
        total_price: order.total,
        coin_earned: order.coinEarned,
        promo_code: order.promoCode ?? null,
        lifecycle_status: order.status ?? 'ongoing',
        estimated_minutes: order.estimatedMinutes,
        estimated_completion_at: order.estimatedCompletionAt ?? null,
        completed_at: order.completedAt ?? null,
        distance_km: order.distanceKm ?? null,
        vendor_address: order.vendorAddress ?? null,
        vendor_open_hours: order.vendorOpenHours ?? null,
        preparation_minutes: order.preparationMinutes,
        co2e_saved_kg: order.co2eSavedKg,
    };
}
export async function saveOrder(order: StoredOrder): Promise<void> {
    const { error } = await supabase
        .from('orders')
        .insert(storedOrderToRow(order));
    if (error) {
        console.error('[order-storage] gagal menyimpan pesanan:', error.message);
        throw error;
    }
    dispatchUpdated();
}
export async function getUserOrders(userId: string | null | undefined): Promise<StoredOrder[]> {
    if (!userId)
        return [];
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('buyer_id', userId)
        .order('created_at', { ascending: false });
    if (error) {
        console.error('[order-storage] gagal memuat pesanan:', error.message);
        throw new Error(error.message || 'Gagal memuat pesanan.');
    }
    return (data ?? []).map(rowToStoredOrder);
}
export async function getSellerOrders(): Promise<StoredOrder[]> {
    const umkm = await getSellerUmkm();
    if (!umkm)
        return [];
    const conditions = [umkm.slug, umkm.id]
        .filter((value): value is string => Boolean(value))
        .map((value) => `vendor_slug.eq.${value}`);
    if (umkm.id)
        conditions.push(`umkm_id.eq.${umkm.id}`);
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .or(conditions.join(','))
        .order('created_at', { ascending: false });
    if (error) {
        console.error('[order-storage] gagal memuat pesanan penjual:', error.message);
        return [];
    }
    return (data ?? []).map(rowToStoredOrder);
}
export async function getOrderById(orderId: string): Promise<StoredOrder | undefined> {
    await supabase.auth.getSession();
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('order_code', orderId)
        .maybeSingle();
    if (error) {
        console.error('[order-storage] gagal memuat pesanan:', error.message);
        return undefined;
    }
    if (data)
        return rowToStoredOrder(data);
    return undefined;
}
const PATCH_COLUMN_MAP: Record<string, string> = {
    status: 'lifecycle_status',
    orderStatus: 'order_status',
    completedAt: 'completed_at',
    paymentMethodId: 'payment_method_id',
    progressStatus: 'progress_status',
    note: 'note',
    deliveryDistanceKm: 'delivery_distance_km',
    estimatedDeliveryMinutes: 'estimated_delivery_minutes',
    deliveryStartedAt: 'delivery_started_at',
    estimatedArrivalAt: 'estimated_arrival_at',
    shippingSnapshot: 'shipping_snapshot',
    courierCode: 'courier_code',
    courierServiceCode: 'courier_service_code',
    courierServiceName: 'courier_service_name',
    shippingRate: 'shipping_rate',
    biteshipOrderId: 'biteship_order_id',
    biteshipTrackingId: 'biteship_tracking_id',
    biteshipWaybillId: 'biteship_waybill_id',
    shipmentStatus: 'shipment_status',
    shipmentCreatedAt: 'shipment_created_at',
    shipmentError: 'shipment_error',
};
const CLIENT_PATCHABLE_KEYS = new Set<string>(['note']);
export async function patchOrder(orderId: string, patch: Partial<StoredOrder>): Promise<StoredOrder | undefined> {
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
        if (!CLIENT_PATCHABLE_KEYS.has(key))
            continue;
        const column = PATCH_COLUMN_MAP[key] ?? key;
        payload[column] = value;
    }
    if (Object.keys(payload).length === 0)
        return undefined;
    const { data, error } = await supabase
        .from('orders')
        .update(payload)
        .eq('order_code', orderId)
        .select()
        .maybeSingle();
    if (error) {
        console.error('[order-storage] gagal update pesanan:', error.message);
        return undefined;
    }
    if (!data)
        return undefined;
    dispatchUpdated();
    return rowToStoredOrder(data);
}
export async function completeExpiredOrders(userId: string | null | undefined, preloaded?: StoredOrder[]): Promise<boolean> {
    if (!userId)
        return false;
    const orders = preloaded ?? (await getUserOrders(userId));
    const now = Date.now();
    let changed = false;
    for (const order of orders) {
        if (!shouldAutoComplete(order, now))
            continue;
        const { data: updatedRows, error: updErr } = await supabase
            .from('orders')
            .update({
            lifecycle_status: 'completed',
            order_status: 'completed',
            completed_at: new Date().toISOString(),
        })
            .eq('order_code', order.orderId)
            .eq('buyer_id', userId)
            .select('order_code');
        if (!updErr && Array.isArray(updatedRows) && updatedRows.length > 0) {
            changed = true;
            dispatchUpdated();
        }
    }
    return changed;
}
export async function reserveStock(productSlug: string, quantity: number): Promise<boolean> {
    const { data, error } = await supabase.rpc('reserve_stock', {
        p_slug: productSlug,
        p_quantity: quantity,
    });
    if (error) {
        console.error('[order-storage] reserve_stock gagal:', error.message);
        return false;
    }
    return data === true;
}
