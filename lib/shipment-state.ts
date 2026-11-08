export type ShipmentState = 'to_ship' | 'in_transit' | 'late' | 'done' | 'inactive';
export interface ShipmentStateSource {
    payment_status?: unknown;
    order_status?: unknown;
    estimated_arrival_at?: unknown;
    delivery_option?: unknown;
}
export const SHIPMENT_STATE_LABEL: Record<ShipmentState, string> = {
    to_ship: 'Menunggu dikirim',
    in_transit: 'Dalam perjalanan',
    late: 'Terlambat',
    done: 'Selesai',
    inactive: 'Tidak aktif',
};
function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}
function toEpoch(value: unknown): number | null {
    const raw = asString(value);
    if (!raw || !raw.trim())
        return null;
    const ms = new Date(raw).getTime();
    return Number.isFinite(ms) ? ms : null;
}
export const TO_SHIP_STATUSES = ['paid', 'processing', 'preparing', 'ready'] as const;
export function deriveShipmentState(source: ShipmentStateSource, now: number = Date.now()): ShipmentState {
    const orderStatus = (asString(source.order_status) ?? '').trim().toLowerCase();
    const paymentStatus = (asString(source.payment_status) ?? '').trim().toLowerCase();
    const deliveryOption = (asString(source.delivery_option) ?? '').trim().toLowerCase();
    if (deliveryOption && deliveryOption !== 'delivery')
        return 'inactive';
    if (orderStatus === 'completed')
        return 'done';
    if (orderStatus === 'out_for_delivery') {
        const eta = toEpoch(source.estimated_arrival_at);
        if (eta !== null && eta < now)
            return 'late';
        return 'in_transit';
    }
    if (paymentStatus === 'paid' &&
        (TO_SHIP_STATUSES as readonly string[]).includes(orderStatus)) {
        return 'to_ship';
    }
    return 'inactive';
}
export function shipmentNeedsAttention(state: ShipmentState): boolean {
    return state === 'to_ship' || state === 'late';
}
export const TO_SHIP_STALE_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;
export function shipmentToShipAgeHours(createdAt: unknown, state: ShipmentState, now: number = Date.now()): number | null {
    if (state !== 'to_ship')
        return null;
    const created = toEpoch(createdAt);
    if (created === null)
        return null;
    const age = (now - created) / HOUR_MS;
    return age < 0 ? null : age;
}
export function shipmentToShipAgeLabel(ageHours: number | null): string | null {
    if (ageHours === null || !Number.isFinite(ageHours) || ageHours < 0)
        return null;
    if (ageHours < 48)
        return `Menunggu ${Math.floor(ageHours)} jam`;
    return `Menunggu ${Math.floor(ageHours / 24)} hari`;
}
export function staleToShipAgeLabel(createdAt: unknown, state: ShipmentState, now: number = Date.now()): string | null {
    const age = shipmentToShipAgeHours(createdAt, state, now);
    if (age === null || age <= TO_SHIP_STALE_HOURS)
        return null;
    return shipmentToShipAgeLabel(age);
}
export function isShipmentToShipStale(createdAt: unknown, state: ShipmentState, now: number = Date.now()): boolean {
    return staleToShipAgeLabel(createdAt, state, now) !== null;
}
