export interface CityPoint {
    latitude: number;
    longitude: number;
}
const CITY_POINTS: Record<string, CityPoint> = {
    'kota depok': { latitude: -6.4025, longitude: 106.7942 },
    depok: { latitude: -6.4025, longitude: 106.7942 },
    sukmajaya: { latitude: -6.4103, longitude: 106.8277 },
    cimanggis: { latitude: -6.3833, longitude: 106.8667 },
    beji: { latitude: -6.3806, longitude: 106.8256 },
    tapos: { latitude: -6.4269, longitude: 106.8856 },
    cinere: { latitude: -6.3403, longitude: 106.7886 },
    sawangan: { latitude: -6.4033, longitude: 106.7428 },
    'jakarta pusat': { latitude: -6.1805, longitude: 106.8284 },
    'jakarta selatan': { latitude: -6.2615, longitude: 106.8106 },
    'jakarta barat': { latitude: -6.1683, longitude: 106.7588 },
    'jakarta timur': { latitude: -6.2250, longitude: 106.9004 },
    'jakarta utara': { latitude: -6.1384, longitude: 106.8640 },
    jakarta: { latitude: -6.2088, longitude: 106.8456 },
    bandung: { latitude: -6.9175, longitude: 107.6191 },
};
export type OriginPointSource = 'store' | 'city' | 'none';
export interface ResolvedOriginPoint {
    point: CityPoint | null;
    source: OriginPointSource;
    matchedCity?: string;
}
function isEmptyCoordinate(value: unknown): boolean {
    return (value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === ''));
}
function isValidPair(lat: number, lng: number): boolean {
    if (!Number.isFinite(lat) || !Number.isFinite(lng))
        return false;
    if (lat === 0 && lng === 0)
        return false;
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}
export function resolveOriginPoint(latitude: unknown, longitude: unknown, city: unknown): ResolvedOriginPoint {
    if (!isEmptyCoordinate(latitude) && !isEmptyCoordinate(longitude)) {
        const lat = Number(latitude);
        const lng = Number(longitude);
        if (isValidPair(lat, lng)) {
            return { point: { latitude: lat, longitude: lng }, source: 'store' };
        }
    }
    const key = typeof city === 'string' ? city.trim().toLowerCase() : '';
    const hit = key ? CITY_POINTS[key] : undefined;
    if (hit) {
        return { point: hit, source: 'city', matchedCity: city as string };
    }
    return { point: null, source: 'none' };
}
export function knownCityKeys(): string[] {
    return Object.keys(CITY_POINTS).sort();
}
