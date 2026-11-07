import type { FulfillmentMode, GeoPoint } from './types';
export const VENDOR_PREPARATION_MINUTES: Record<string, number> = {
    'warkop-pak-iman': 8,
    'warung-nusantara': 12,
    'dapur-ibu-tini': 15,
};
const DEFAULT_PREPARATION_MINUTES = 12;
const MIN_PREPARATION_MINUTES = 1;
const MAX_PREPARATION_MINUTES = 120;
export function getVendorPreparationMinutes(vendorSlug?: string): number {
    if (!vendorSlug)
        return DEFAULT_PREPARATION_MINUTES;
    const slug = vendorSlug.trim().toLowerCase();
    if (!slug)
        return DEFAULT_PREPARATION_MINUTES;
    const exact = VENDOR_PREPARATION_MINUTES[slug];
    if (typeof exact === 'number')
        return clampPreparation(exact);
    const keys = Object.keys(VENDOR_PREPARATION_MINUTES);
    let bestKey = '';
    let bestMinutes = DEFAULT_PREPARATION_MINUTES;
    for (const key of keys) {
        if (!slug.startsWith(`${key}-`))
            continue;
        if (key.length > bestKey.length) {
            bestKey = key;
            bestMinutes = VENDOR_PREPARATION_MINUTES[key];
        }
    }
    return clampPreparation(bestMinutes);
}
function clampPreparation(minutes: number): number {
    if (!Number.isFinite(minutes))
        return DEFAULT_PREPARATION_MINUTES;
    return Math.min(MAX_PREPARATION_MINUTES, Math.max(MIN_PREPARATION_MINUTES, Math.round(minutes)));
}
export const COURIER_AVG_SPEED_KM_PER_HOUR = 18;
export const HANDOVER_MINUTES = 6;
export const MAX_TRAVEL_MINUTES = 120;
export function calculateTravelMinutes(distanceKm: number): number {
    if (!Number.isFinite(distanceKm) || distanceKm <= 0)
        return 0;
    const driving = (distanceKm / COURIER_AVG_SPEED_KM_PER_HOUR) * 60;
    return Math.min(MAX_TRAVEL_MINUTES, Math.max(1, Math.round(HANDOVER_MINUTES + driving)));
}
export interface OrderEstimate {
    preparationMinutes: number;
    travelMinutes: number;
    estimatedMinutes: number;
}
export function estimateOrderMinutes({ fulfillment, distanceKm = 0, vendorSlug, }: {
    fulfillment: FulfillmentMode;
    distanceKm?: number;
    vendorSlug?: string;
}): OrderEstimate {
    const preparationMinutes = getVendorPreparationMinutes(vendorSlug);
    const travelMinutes = fulfillment === 'delivery' ? calculateTravelMinutes(distanceKm) : 0;
    return {
        preparationMinutes,
        travelMinutes,
        estimatedMinutes: preparationMinutes + travelMinutes,
    };
}
export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}
