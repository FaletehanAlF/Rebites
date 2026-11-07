import { NextRequest, NextResponse } from 'next/server';
import { getUserFromBearer } from '@/lib/server/supabase';
import { isValidCoordinatePair } from '@/lib/shipping-tariff';
import { isValidRouteGeometry, simplifyRoute, straightRoute, buildRouteCacheKey, routePolylineKm, type RouteCoordinate, } from '@/lib/route-geometry';
export const runtime = 'nodejs';
const DEFAULT_ROUTING_URL = 'https://router.project-osrm.org';
const ROUTING_TIMEOUT_MS = 6000;
const ROUTE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const ROUTE_CACHE_MAX = 300;
interface CacheEntry {
    payload: RoutePayload;
    expiresAt: number;
}
interface RoutePayload {
    source: 'road' | 'straight';
    coordinates: RouteCoordinate[];
    distanceKm: number;
    durationMinutes: number | null;
    fallbackReason: string | null;
}
const cache = new Map<string, CacheEntry>();
function pruneCache(now: number): void {
    if (cache.size < ROUTE_CACHE_MAX) {
        cache.forEach((entry, key) => {
            if (entry.expiresAt <= now)
                cache.delete(key);
        });
        return;
    }
    cache.clear();
}
function routingBaseUrl(): string {
    const raw = process.env.DELIVERY_ROUTING_URL;
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    const base = trimmed || DEFAULT_ROUTING_URL;
    return base.replace(/\/+$/, '');
}
async function fetchRoadRoute(origin: {
    latitude: number;
    longitude: number;
}, destination: {
    latitude: number;
    longitude: number;
}): Promise<{
    coordinates: RouteCoordinate[];
    distanceKm: number;
    durationMinutes: number | null;
} | null> {
    const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const url = `${routingBaseUrl()}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ROUTING_TIMEOUT_MS);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { Accept: 'application/json' },
        });
        if (!res.ok)
            return null;
        const json = (await res.json()) as {
            code?: unknown;
            routes?: Array<{
                distance?: unknown;
                duration?: unknown;
                geometry?: {
                    coordinates?: unknown;
                };
            }>;
        };
        if (json?.code !== 'Ok')
            return null;
        const first = json.routes?.[0];
        if (!first)
            return null;
        const geometry = first.geometry?.coordinates;
        if (!isValidRouteGeometry(geometry))
            return null;
        const distanceKm = typeof first.distance === 'number' && Number.isFinite(first.distance) && first.distance > 0
            ? first.distance / 1000
            : routePolylineKm(geometry);
        const durationMinutes = typeof first.duration === 'number' && Number.isFinite(first.duration) && first.duration > 0
            ? Math.round(first.duration / 60)
            : null;
        return { coordinates: simplifyRoute(geometry), distanceKm, durationMinutes };
    }
    catch {
        return null;
    }
    finally {
        clearTimeout(timer);
    }
}
export async function POST(req: NextRequest) {
    const user = await getUserFromBearer(req.headers.get('authorization'));
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
    const body = (await req.json().catch(() => null)) as {
        originLatitude?: unknown;
        originLongitude?: unknown;
        destinationLatitude?: unknown;
        destinationLongitude?: unknown;
    } | null;
    const originLat = body?.originLatitude;
    const originLng = body?.originLongitude;
    const destLat = body?.destinationLatitude;
    const destLng = body?.destinationLongitude;
    if (!isValidCoordinatePair(originLat, originLng) ||
        !isValidCoordinatePair(destLat, destLng)) {
        return NextResponse.json({ error: 'Koordinat tidak lengkap atau tidak sah.', code: 'coordinates_invalid' }, { status: 400 });
    }
    const origin = { latitude: Number(originLat), longitude: Number(originLng) };
    const destination = { latitude: Number(destLat), longitude: Number(destLng) };
    const key = buildRouteCacheKey(origin, destination);
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
        return NextResponse.json(cached.payload, {
            headers: { 'Cache-Control': 'private, max-age=3600' },
        });
    }
    const road = await fetchRoadRoute(origin, destination);
    let payload: RoutePayload;
    if (road) {
        payload = {
            source: 'road',
            coordinates: road.coordinates,
            distanceKm: Math.round(road.distanceKm * 100) / 100,
            durationMinutes: road.durationMinutes,
            fallbackReason: null,
        };
    }
    else {
        const straight = straightRoute(origin, destination);
        payload = {
            source: 'straight',
            coordinates: straight,
            distanceKm: Math.round(routePolylineKm(straight) * 100) / 100,
            durationMinutes: null,
            fallbackReason: 'Layanan rute jalan sedang tidak dapat dihubungi.',
        };
    }
    pruneCache(now);
    cache.set(key, {
        payload,
        expiresAt: now + (payload.source === 'road' ? ROUTE_CACHE_TTL_MS : 60000),
    });
    return NextResponse.json(payload, {
        headers: { 'Cache-Control': 'private, max-age=3600' },
    });
}
