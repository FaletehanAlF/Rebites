export const REBITES_COURIER_CODE = 'rebites';
export const REBITES_SERVICE_CODE = 'rebites_standard';
export const REBITES_COURIER_NAME = 'Kurir ReBites';
export const REBITES_SERVICE_NAME = 'Antar (Estimasi Lokal)';
export const ROAD_FACTOR = 1.3;
export function getDeliveryTariffConfig() {
    const base = Number(process.env.DELIVERY_BASE_FEE_IDR ?? '3000');
    const perKm = Number(process.env.DELIVERY_PER_KM_FEE_IDR ?? '1000');
    const minFee = Number(process.env.DELIVERY_MIN_FEE_IDR ?? '3000');
    const maxFee = Number(process.env.DELIVERY_MAX_FEE_IDR ?? '10000');
    return {
        baseFee: Number.isFinite(base) && base >= 0 ? base : 3000,
        perKmFee: Number.isFinite(perKm) && perKm >= 0 ? perKm : 1000,
        minFee: Number.isFinite(minFee) && minFee >= 0 ? minFee : 3000,
        maxFee: Number.isFinite(maxFee) && maxFee > 0 ? maxFee : 10000,
    };
}
export function haversineKm(a: {
    latitude: number;
    longitude: number;
}, b: {
    latitude: number;
    longitude: number;
}): number {
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
export function estimateRoadDistanceKm(straightKm: number): number {
    if (!Number.isFinite(straightKm) || straightKm < 0)
        return 0;
    return straightKm * ROAD_FACTOR;
}
export function calculateDeliveryFee(distanceKm: number): number {
    const cfg = getDeliveryTariffConfig();
    const raw = cfg.baseFee + cfg.perKmFee * distanceKm;
    const clamped = Math.min(cfg.maxFee, Math.max(cfg.minFee, raw));
    return Math.round(clamped / 100) * 100;
}
export function isValidCoordinatePair(lat: unknown, lng: unknown): boolean {
    const isEmpty = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
    if (isEmpty(lat) || isEmpty(lng))
        return false;
    const la = typeof lat === 'number' ? lat : Number(lat);
    const lo = typeof lng === 'number' ? lng : Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(lo))
        return false;
    if (la === 0 && lo === 0)
        return false;
    return la >= -90 && la <= 90 && lo >= -180 && lo <= 180;
}
