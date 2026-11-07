export interface GeoPointLike {
    latitude: number;
    longitude: number;
}
export type RouteCoordinate = [
    number,
    number
];
export const ROUTE_MAX_POINTS = 600;
export function buildRouteCacheKey(origin: GeoPointLike, destination: GeoPointLike): string {
    const r = (n: number) => n.toFixed(5);
    return `${r(origin.latitude)},${r(origin.longitude)}>${r(destination.latitude)},${r(destination.longitude)}`;
}
export function isValidRouteGeometry(value: unknown): value is RouteCoordinate[] {
    if (!Array.isArray(value) || value.length < 2)
        return false;
    for (const point of value) {
        if (!Array.isArray(point) || point.length < 2)
            return false;
        const [lng, lat] = point;
        if (typeof lng !== 'number' || typeof lat !== 'number')
            return false;
        if (!Number.isFinite(lng) || !Number.isFinite(lat))
            return false;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180)
            return false;
    }
    return true;
}
export function distanceKmBetween(a: RouteCoordinate, b: RouteCoordinate): number {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b[1] - a[1]);
    const dLon = toRad(b[0] - a[0]);
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
}
export function routePolylineKm(coords: RouteCoordinate[]): number {
    if (!Array.isArray(coords) || coords.length < 2)
        return 0;
    let total = 0;
    for (let i = 1; i < coords.length; i += 1) {
        total += distanceKmBetween(coords[i - 1], coords[i]);
    }
    return total;
}
export function pointAtProgress(coords: RouteCoordinate[], t: number): RouteCoordinate | null {
    if (!Array.isArray(coords) || coords.length === 0)
        return null;
    if (coords.length === 1)
        return coords[0];
    const clamped = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
    if (clamped === 0)
        return coords[0];
    const lengths: number[] = [];
    let total = 0;
    for (let i = 1; i < coords.length; i += 1) {
        const len = distanceKmBetween(coords[i - 1], coords[i]);
        lengths.push(len);
        total += len;
    }
    if (total <= 0)
        return coords[coords.length - 1];
    const target = total * clamped;
    let walked = 0;
    for (let i = 0; i < lengths.length; i += 1) {
        const seg = lengths[i];
        if (walked + seg >= target) {
            const ratio = seg <= 0 ? 0 : (target - walked) / seg;
            const from = coords[i];
            const to = coords[i + 1];
            return [
                from[0] + (to[0] - from[0]) * ratio,
                from[1] + (to[1] - from[1]) * ratio,
            ];
        }
        walked += seg;
    }
    return coords[coords.length - 1];
}
export function tripProgressAt(elapsedMs: number, durationMs: number): number {
    if (!Number.isFinite(durationMs) || durationMs <= 0)
        return 0;
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0)
        return 0;
    return Math.min(1, elapsedMs / durationMs);
}
export function headingAtProgress(coords: RouteCoordinate[], t: number): number {
    if (!Array.isArray(coords) || coords.length < 2)
        return 0;
    const clamped = Number.isFinite(t) ? Math.min(1, Math.max(0, t)) : 0;
    const prev = pointAtProgress(coords, Math.max(0, clamped - 0.01));
    const next = pointAtProgress(coords, Math.min(1, clamped + 0.01));
    if (!prev || !next)
        return 0;
    const dLng = next[0] - prev[0];
    const dLat = next[1] - prev[1];
    if (dLng === 0 && dLat === 0)
        return 0;
    const deg = (Math.atan2(dLng, dLat) * 180) / Math.PI;
    return (deg + 360) % 360;
}
export function simplifyRoute(coords: RouteCoordinate[], maxPoints: number = ROUTE_MAX_POINTS): RouteCoordinate[] {
    if (!Array.isArray(coords) || coords.length === 0)
        return [];
    if (coords.length <= maxPoints || maxPoints < 2)
        return coords.slice();
    const step = (coords.length - 1) / (maxPoints - 1);
    const out: RouteCoordinate[] = [];
    for (let i = 0; i < maxPoints; i += 1) {
        out.push(coords[Math.round(i * step)]);
    }
    return out;
}
export function straightRoute(origin: GeoPointLike, destination: GeoPointLike): RouteCoordinate[] {
    return [
        [origin.longitude, origin.latitude],
        [destination.longitude, destination.latitude],
    ];
}
