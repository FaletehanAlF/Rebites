import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from './supabase';
import { BITESHIP_API_BASE, REQUEST_TIMEOUT_MS, getBiteshipApiKey, } from './biteship';
const ORDERS_PATH = '/v1/orders';
const DUPLICATE_REFERENCE_CODE = 40002060;
export type ShipmentSkippedReason = 'pickup';
export type ShipmentFailureReason = 'not_found' | 'validation' | 'biteship_error' | 'timeout' | 'invalid_response';
export interface ShipmentIdentifiers {
    biteshipOrderId: string;
    trackingId: string | null;
    waybillId: string | null;
    shipmentStatus: string | null;
}
export type ShipmentResult = {
    ok: true;
    status: 'created';
    identifiers: ShipmentIdentifiers;
} | {
    ok: true;
    status: 'already_created' | 'recovered';
    identifiers: ShipmentIdentifiers;
} | {
    ok: true;
    status: 'skipped';
    reason: ShipmentSkippedReason;
} | {
    ok: false;
    reason: ShipmentFailureReason;
    message: string;
};
interface BiteshipOrderItem {
    name: string;
    category: string;
    value: number;
    quantity: number;
    weight: number;
    length?: number;
    width?: number;
    height?: number;
}
interface BiteshipCreateOrderBody {
    origin_contact_name: string;
    origin_contact_phone: string;
    origin_address: string;
    origin_postal_code: number;
    destination_contact_name: string;
    destination_contact_phone: string;
    destination_address: string;
    destination_postal_code: number;
    courier_company: string;
    courier_type: string;
    delivery_type: 'now';
    reference_id: string;
    items: BiteshipOrderItem[];
}
interface BiteshipCreateOrderResponse {
    success?: boolean;
    message?: string;
    code?: number | string;
    id?: string;
    courier?: {
        tracking_id?: string;
        waybill_id?: string;
        company?: string;
        type?: string;
    } | null;
    status?: string;
    price?: number;
    details?: {
        order_id?: string;
        waybill_id?: string;
        reference_id?: string;
    } | null;
}
function nonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
function positiveInt(value: unknown): number | null {
    if (value == null)
        return null;
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num) || num <= 0)
        return null;
    const int = Math.floor(num);
    return int >= 1 ? int : null;
}
function joinAddressParts(parts: Array<unknown>): string | null {
    const cleaned = parts
        .map((p) => (typeof p === 'string' ? p.trim() : ''))
        .filter((p) => p.length > 0);
    const unique = cleaned.filter((p, i) => cleaned.indexOf(p) === i);
    return unique.length > 0 ? unique.join(', ') : null;
}
async function writeShipmentFields(service: SupabaseClient, orderCode: string, fields: Record<string, unknown>): Promise<boolean> {
    const { error } = await service
        .from('orders')
        .update(fields)
        .eq('order_code', orderCode);
    if (error) {
        console.error('[biteship-shipment] tulis shipment gagal', error.message, { orderCode });
        return false;
    }
    return true;
}
async function saveShipmentError(service: SupabaseClient, orderCode: string, message: string): Promise<void> {
    await writeShipmentFields(service, orderCode, { shipment_error: message.slice(0, 500) });
}
export async function createBiteshipShipment(orderCode: string): Promise<ShipmentResult> {
    const code = typeof orderCode === 'string' ? orderCode.trim() : '';
    if (!code) {
        return { ok: false, reason: 'validation', message: 'orderCode wajib diisi.' };
    }
    const service = createServiceClient();
    const { data: order, error: fetchError } = await service
        .from('orders')
        .select('order_code, payment_status, delivery_option, courier_code, courier_service_code, quantity, product_name, unit_price, address_snapshot, shipping_snapshot, biteship_order_id')
        .eq('order_code', code)
        .maybeSingle();
    if (fetchError || !order) {
        return { ok: false, reason: 'not_found', message: 'Order tidak ditemukan.' };
    }
    const row = order as Record<string, unknown>;
    if (row.delivery_option !== 'delivery') {
        return { ok: true, status: 'skipped', reason: 'pickup' };
    }
    const existingShipmentId = nonEmptyString(row.biteship_order_id);
    if (existingShipmentId) {
        const { data: current } = await service
            .from('orders')
            .select('biteship_order_id, biteship_tracking_id, biteship_waybill_id, shipment_status')
            .eq('order_code', code)
            .maybeSingle();
        const cur = (current ?? row) as Record<string, unknown>;
        return {
            ok: true,
            status: 'already_created',
            identifiers: {
                biteshipOrderId: existingShipmentId,
                trackingId: nonEmptyString(cur.biteship_tracking_id),
                waybillId: nonEmptyString(cur.biteship_waybill_id),
                shipmentStatus: nonEmptyString(cur.shipment_status),
            },
        };
    }
    if (row.payment_status !== 'paid') {
        const message = 'Order belum dibayar; shipment hanya untuk payment paid.';
        await saveShipmentError(service, code, message);
        return { ok: false, reason: 'validation', message };
    }
    const courierCode = nonEmptyString(row.courier_code);
    const courierServiceCode = nonEmptyString(row.courier_service_code);
    if (!courierCode || !courierServiceCode) {
        const message = 'Pilihan kurir order belum tersedia.';
        await saveShipmentError(service, code, message);
        return { ok: false, reason: 'validation', message };
    }
    const snapshot = row.shipping_snapshot as Record<string, unknown> | null;
    const origin = snapshot?.origin as Record<string, unknown> | null;
    const pkg = snapshot?.package as Record<string, unknown> | null;
    if (!snapshot || !origin || !pkg) {
        const message = 'Shipping snapshot order belum tersedia.';
        await saveShipmentError(service, code, message);
        return { ok: false, reason: 'validation', message };
    }
    const originPostal = nonEmptyString(origin.postalCode);
    const originPhone = nonEmptyString(origin.phone);
    const originName = nonEmptyString(origin.businessName);
    const originAddress = joinAddressParts([origin.address, origin.city]);
    if (!originPostal || !originPhone || !originName || !originAddress) {
        const message = 'Data origin seller belum lengkap (nama/alamat/postal/telepon).';
        await saveShipmentError(service, code, message);
        return { ok: false, reason: 'validation', message };
    }
    const dest = row.address_snapshot as Record<string, unknown> | null;
    const destPostal = nonEmptyString(dest?.postalCode);
    const destName = nonEmptyString(dest?.receiverName);
    const destPhone = nonEmptyString(dest?.phone);
    const destAddress = joinAddressParts([dest?.fullAddress, dest?.district, dest?.city, dest?.province]);
    if (!destPostal || !destName || !destPhone || !destAddress) {
        const message = 'Data alamat tujuan belum lengkap (nama/telepon/alamat/postal).';
        await saveShipmentError(service, code, message);
        return { ok: false, reason: 'validation', message };
    }
    const quantity = positiveInt(row.quantity);
    const productName = nonEmptyString(row.product_name);
    const weightGram = positiveInt(pkg.weightGram);
    const unitPrice = positiveInt(row.unit_price);
    if (!quantity || !productName || !weightGram || !unitPrice) {
        const message = 'Data package order belum lengkap (quantity/nama/berat/nilai).';
        await saveShipmentError(service, code, message);
        return { ok: false, reason: 'validation', message };
    }
    const body: BiteshipCreateOrderBody = {
        origin_contact_name: originName,
        origin_contact_phone: originPhone,
        origin_address: originAddress,
        origin_postal_code: Number(originPostal),
        destination_contact_name: destName,
        destination_contact_phone: destPhone,
        destination_address: destAddress,
        destination_postal_code: Number(destPostal),
        courier_company: courierCode,
        courier_type: courierServiceCode,
        delivery_type: 'now',
        reference_id: code,
        items: [
            {
                name: productName,
                category: 'food_and_drink',
                value: unitPrice,
                quantity,
                weight: weightGram,
                ...(positiveInt(pkg.lengthCm) != null ? { length: positiveInt(pkg.lengthCm) as number } : {}),
                ...(positiveInt(pkg.widthCm) != null ? { width: positiveInt(pkg.widthCm) as number } : {}),
                ...(positiveInt(pkg.heightCm) != null ? { height: positiveInt(pkg.heightCm) as number } : {}),
            },
        ],
    };
    let apiKey: string;
    try {
        apiKey = getBiteshipApiKey();
    }
    catch (e) {
        const message = e instanceof Error ? e.message : 'BITESHIP_API_KEY belum tersedia.';
        await saveShipmentError(service, code, message);
        return { ok: false, reason: 'validation', message };
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
        res = await fetch(`${BITESHIP_API_BASE}${ORDERS_PATH}`, {
            method: 'POST',
            headers: {
                authorization: apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
    }
    catch (e) {
        if ((e as Error).name === 'AbortError') {
            const message = 'Biteship timeout (10s) - shipment belum dibuat.';
            await saveShipmentError(service, code, message);
            return { ok: false, reason: 'timeout', message };
        }
        const message = e instanceof Error ? e.message : 'Gagal menghubungi Biteship.';
        await saveShipmentError(service, code, message);
        return { ok: false, reason: 'biteship_error', message };
    }
    finally {
        clearTimeout(timeout);
    }
    const json = (await res.json().catch(() => null)) as BiteshipCreateOrderResponse | null;
    if (!res.ok) {
        const responseCode = Number(json?.code);
        if (responseCode === DUPLICATE_REFERENCE_CODE) {
            const recoveredOrderId = nonEmptyString(json?.details?.order_id);
            const recoveredWaybill = nonEmptyString(json?.details?.waybill_id);
            if (recoveredOrderId) {
                await writeShipmentFields(service, code, {
                    biteship_order_id: recoveredOrderId,
                    biteship_tracking_id: null,
                    biteship_waybill_id: recoveredWaybill,
                    shipment_status: 'confirmed',
                    shipment_created_at: new Date().toISOString(),
                    shipment_error: null,
                });
                return {
                    ok: true,
                    status: 'recovered',
                    identifiers: {
                        biteshipOrderId: recoveredOrderId,
                        trackingId: null,
                        waybillId: recoveredWaybill,
                        shipmentStatus: 'confirmed',
                    },
                };
            }
        }
        const message = (json && typeof json.message === 'string' && json.message) || `Biteship error ${res.status}`;
        console.error('[biteship-shipment] create gagal', { orderCode: code, status: res.status, message });
        await saveShipmentError(service, code, message);
        return { ok: false, reason: 'biteship_error', message };
    }
    const createdId = nonEmptyString(json?.id);
    if (!createdId) {
        const message = 'Respons Biteship tidak valid (tanpa order id).';
        console.error('[biteship-shipment] respons malformed', { orderCode: code });
        await saveShipmentError(service, code, message);
        return { ok: false, reason: 'invalid_response', message };
    }
    const trackingId = nonEmptyString(json?.courier?.tracking_id);
    const waybillId = nonEmptyString(json?.courier?.waybill_id);
    const shipmentStatus = nonEmptyString(json?.status);
    await writeShipmentFields(service, code, {
        biteship_order_id: createdId,
        biteship_tracking_id: trackingId,
        biteship_waybill_id: waybillId,
        shipment_status: shipmentStatus,
        shipment_created_at: new Date().toISOString(),
        shipment_error: null,
    });
    return {
        ok: true,
        status: 'created',
        identifiers: {
            biteshipOrderId: createdId,
            trackingId,
            waybillId,
            shipmentStatus,
        },
    };
}
