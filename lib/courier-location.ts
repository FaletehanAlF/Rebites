export const STALE_AFTER_MS = 90000;
export const UNAVAILABLE_AFTER_MS = 10 * 60000;
export const MIN_SEND_INTERVAL_MS = 5000;
export const TARGET_SEND_INTERVAL_MS = 10000;
export interface CourierLocationPoint {
    latitude: number;
    longitude: number;
    recordedAt: string;
}
export type LocationFreshness = 'aktif' | 'terlambat' | 'tidak_tersedia';
export function resolveLocationFreshness(recordedAt: string | null | undefined, now: number): LocationFreshness {
    if (!recordedAt)
        return 'tidak_tersedia';
    const ts = new Date(recordedAt).getTime();
    if (!Number.isFinite(ts))
        return 'tidak_tersedia';
    const age = now - ts;
    if (age < 0)
        return 'terlambat';
    if (age <= STALE_AFTER_MS)
        return 'aktif';
    if (age <= UNAVAILABLE_AFTER_MS)
        return 'terlambat';
    return 'tidak_tersedia';
}
export function isPositionDisplayable(freshness: LocationFreshness): boolean {
    return freshness !== 'tidak_tersedia';
}
export function nextSendDelayMs(lastSentAt: number | null | undefined, now: number, minIntervalMs: number = MIN_SEND_INTERVAL_MS, targetIntervalMs: number = TARGET_SEND_INTERVAL_MS): number | null {
    if (lastSentAt == null || !Number.isFinite(lastSentAt))
        return null;
    const elapsed = now - lastSentAt;
    if (!Number.isFinite(elapsed))
        return null;
    if (elapsed < 0)
        return 0;
    if (elapsed >= targetIntervalMs)
        return null;
    if (elapsed >= minIntervalMs)
        return null;
    return minIntervalMs - elapsed;
}
export function formatPositionAge(recordedAt: string | null | undefined, now: number): string | null {
    if (!recordedAt)
        return null;
    const ts = new Date(recordedAt).getTime();
    if (!Number.isFinite(ts))
        return null;
    const age = now - ts;
    if (age < 0)
        return 'baru saja';
    const seconds = Math.floor(age / 1000);
    if (seconds < 60)
        return `${Math.max(1, seconds)} detik lalu`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)
        return `${minutes} menit lalu`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    return `${days} hari lalu`;
}
export function isValidCourierPosition(latitude: unknown, longitude: unknown): boolean {
    if (typeof latitude !== 'number' || typeof longitude !== 'number')
        return false;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
        return false;
    if (latitude < -90 || latitude > 90)
        return false;
    if (longitude < -180 || longitude > 180)
        return false;
    if (latitude === 0 && longitude === 0)
        return false;
    return true;
}
export type RoutePoint = [
    number,
    number
];
export interface RouteProjection {
    position: RoutePoint;
    progress: number;
}
export function projectOntoRoute(route: readonly RoutePoint[], point: {
    latitude: number;
    longitude: number;
}): RouteProjection | null {
    if (!Array.isArray(route) || route.length < 2)
        return null;
    if (!isValidCourierPosition(point.latitude, point.longitude))
        return null;
    const targetLng = point.longitude;
    const targetLat = point.latitude;
    const segmentLengths: number[] = [];
    let totalLength = 0;
    for (let i = 0; i < route.length - 1; i += 1) {
        const [lng1, lat1] = route[i];
        const [lng2, lat2] = route[i + 1];
        const dx = (lng2 - lng1) * Math.cos((lat1 * Math.PI) / 180);
        const dy = lat2 - lat1;
        const length = Math.sqrt(dx * dx + dy * dy);
        segmentLengths.push(length);
        totalLength += length;
    }
    if (totalLength <= 0)
        return null;
    let bestDistance = Number.POSITIVE_INFINITY;
    let bestPosition: RoutePoint = [route[0][0], route[0][1]];
    let bestProgress = 0;
    let travelled = 0;
    for (let i = 0; i < route.length - 1; i += 1) {
        const [lng1, lat1] = route[i];
        const [lng2, lat2] = route[i + 1];
        const dx = (lng2 - lng1) * Math.cos((lat1 * Math.PI) / 180);
        const dy = lat2 - lat1;
        const segLenSq = dx * dx + dy * dy;
        let t = 0;
        if (segLenSq > 0) {
            const tx = (targetLng - lng1) * Math.cos((lat1 * Math.PI) / 180);
            const ty = targetLat - lat1;
            t = (tx * dx + ty * dy) / segLenSq;
            t = Math.min(1, Math.max(0, t));
        }
        const projLng = lng1 + (lng2 - lng1) * t;
        const projLat = lat1 + (lat2 - lat1) * t;
        const ex = (targetLng - projLng) * Math.cos((lat1 * Math.PI) / 180);
        const ey = targetLat - projLat;
        const distance = Math.sqrt(ex * ex + ey * ey);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestPosition = [projLng, projLat];
            bestProgress =
                totalLength > 0 ? (travelled + segmentLengths[i] * t) / totalLength : 0;
        }
        travelled += segmentLengths[i];
    }
    return {
        position: bestPosition,
        progress: Math.min(1, Math.max(0, bestProgress)),
    };
}
