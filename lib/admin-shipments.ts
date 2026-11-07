'use client';
import { fetchAdminWithAuth } from './admin-auth';
import { AuthError } from './auth-token';
import type { ShipmentState } from './shipment-state';
export interface AdminShipmentItem {
    id: string;
    orderCode: string | null;
    createdAt: string | null;
    storeName: string | null;
    storeCity: string | null;
    buyerName: string | null;
    productName: string | null;
    quantity: number | null;
    courierCode: string | null;
    courierService: string | null;
    deliveryAddress: string | null;
    shippingRate: number | null;
    orderStatus: string | null;
    paymentStatus: string | null;
    deliveryStartedAt: string | null;
    estimatedArrivalAt: string | null;
    waybillId: string | null;
    shipmentStatus: string | null;
    shipmentError: string | null;
    completedAt: string | null;
    state: ShipmentState;
}
export interface AdminShipmentSummary {
    toShip: number;
    inTransit: number;
    late: number;
    done: number;
    stale: number;
}
export interface AdminShipmentsResult {
    items: AdminShipmentItem[];
    total: number;
    limit: number;
    offset: number;
    summary: AdminShipmentSummary;
}
export interface AdminShipmentsFilters {
    limit?: number;
    offset?: number;
    search?: string;
    state?: '' | ShipmentState;
}
export class AdminShipmentsApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'AdminShipmentsApiError';
        this.status = status;
    }
}
export async function fetchAdminShipments(filters: AdminShipmentsFilters = {}): Promise<AdminShipmentsResult> {
    const { limit = 20, offset = 0, search = '', state = '' } = filters;
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search.trim())
        params.set('search', search.trim());
    if (state)
        params.set('state', state);
    let res: Response;
    try {
        res = await fetchAdminWithAuth(`/api/admin/shipments?${params.toString()}`, {
            cache: 'no-store',
        });
    }
    catch (err) {
        if (err instanceof AuthError) {
            throw new AdminShipmentsApiError(err.message, err.status);
        }
        throw err;
    }
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new AdminShipmentsApiError(json?.error ?? 'Gagal memuat daftar pengiriman.', res.status);
    }
    const json = (await res.json().catch(() => null)) as AdminShipmentsResult | null;
    if (!json || !Array.isArray(json.items)) {
        throw new AdminShipmentsApiError('Respons daftar pengiriman tidak valid.', 500);
    }
    return {
        items: json.items,
        total: json.total ?? json.items.length,
        limit: json.limit ?? limit,
        offset: json.offset ?? offset,
        summary: json.summary ?? { toShip: 0, inTransit: 0, late: 0, done: 0, stale: 0 },
    };
}
export interface AdminShipmentDetail extends AdminShipmentItem {
    productId: string | null;
    productImageUrl: string | null;
    unitPrice: number | null;
    subtotal: number | null;
    discount: number | null;
    serviceFee: number | null;
    totalPrice: number | null;
    paymentMethodId: string | null;
    estimatedDeliveryMinutes: number | null;
    distanceKm: number | null;
    originLatitude: number | null;
    originLongitude: number | null;
    destinationLatitude: number | null;
    destinationLongitude: number | null;
    courierName: string | null;
    courierVehicle: string | null;
}
export async function fetchAdminShipmentDetail(id: string): Promise<AdminShipmentDetail> {
    let res: Response;
    try {
        res = await fetchAdminWithAuth(`/api/admin/shipments/${encodeURIComponent(id)}`, {
            cache: 'no-store',
        });
    }
    catch (err) {
        if (err instanceof AuthError) {
            throw new AdminShipmentsApiError(err.message, err.status);
        }
        throw err;
    }
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new AdminShipmentsApiError(json?.error ?? 'Gagal memuat detail pengiriman.', res.status);
    }
    const json = (await res.json().catch(() => null)) as {
        detail?: AdminShipmentDetail;
    } | null;
    if (!json?.detail || typeof json.detail.id !== 'string') {
        throw new AdminShipmentsApiError('Respons detail pengiriman tidak valid.', 500);
    }
    return json.detail;
}
