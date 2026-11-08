export interface MapPoint {
    latitude: number;
    longitude: number;
}
export type MapAvailability = 'ready' | 'no-coordinates' | 'no-order';
export interface MapPlan {
    availability: MapAvailability;
    origin: MapPoint | null;
    destination: MapPoint | null;
    center: MapPoint | null;
    zoom: number;
    message: string | null;
}
function toPoint(lat: unknown, lng: unknown): MapPoint | null {
    const isEmpty = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
    if (isEmpty(lat) || isEmpty(lng))
        return null;
    const la = typeof lat === 'number' ? lat : Number(lat);
    const lo = typeof lng === 'number' ? lng : Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(lo))
        return null;
    if (la < -90 || la > 90 || lo < -180 || lo > 180)
        return null;
    if (la === 0 && lo === 0)
        return null;
    return { latitude: la, longitude: lo };
}
export interface MapPlanInput {
    hasOrder: boolean;
    originLatitude?: unknown;
    originLongitude?: unknown;
    destinationLatitude?: unknown;
    destinationLongitude?: unknown;
}
export interface ParsedCoordinatePair {
    ok: boolean;
    latitude?: number | null;
    longitude?: number | null;
}
export function resolveFormCoordinates(latitudeInput: unknown, longitudeInput: unknown, parsePair: (lat: unknown, lng: unknown) => ParsedCoordinatePair): MapPoint | null {
    const pair = parsePair(latitudeInput, longitudeInput);
    if (!pair.ok)
        return null;
    return toPoint(pair.latitude, pair.longitude);
}
export function buildMapPlan(input: MapPlanInput): MapPlan {
    if (!input.hasOrder) {
        return {
            availability: 'no-order',
            origin: null,
            destination: null,
            center: null,
            zoom: 13,
            message: 'Memuat data pesanan…',
        };
    }
    const origin = toPoint(input.originLatitude, input.originLongitude);
    const destination = toPoint(input.destinationLatitude, input.destinationLongitude);
    if (!origin && !destination) {
        return {
            availability: 'no-coordinates',
            origin: null,
            destination: null,
            center: null,
            zoom: 13,
            message: 'Lokasi toko dan alamat tujuan belum memiliki titik koordinat, jadi peta belum dapat ditampilkan.',
        };
    }
    const center = origin && destination
        ? {
            latitude: (origin.latitude + destination.latitude) / 2,
            longitude: (origin.longitude + destination.longitude) / 2,
        }
        : (origin ?? destination)!;
    let zoom = 15;
    if (origin && destination) {
        const span = Math.max(Math.abs(origin.latitude - destination.latitude), Math.abs(origin.longitude - destination.longitude));
        if (span > 1)
            zoom = 10;
        else if (span > 0.3)
            zoom = 12;
        else if (span > 0.05)
            zoom = 13;
        else
            zoom = 14;
    }
    return {
        availability: 'ready',
        origin,
        destination,
        center,
        zoom,
        message: null,
    };
}
