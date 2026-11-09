'use client';
import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPinOff, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MapPlan, MapPoint } from '@/lib/delivery-map-plan';
import { headingAtProgress, pointAtProgress, straightRoute, tripProgressAt, type RouteCoordinate, } from '@/lib/route-geometry';
import { projectOntoRoute } from '@/lib/courier-location';
import { fetchWithAuth } from '@/lib/auth-token';
import { buildVehicleMarkerHtml, vehicleMotionStyles } from '@/lib/map-vehicle-marker';
import 'maplibre-gl/dist/maplibre-gl.css';
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const ROUTE_COLOR = '#1B6B3A';
const ROUTE_SOURCE_ID = 'rebites-route';
const ROUTE_HALO_LAYER_ID = 'rebites-route-halo';
const ROUTE_LAYER_ID = 'rebites-route-line';
const TRIP_DURATION_MS = 40000;
type VehicleMode = 'completed' | 'live' | 'illustration-done' | 'illustration';
const VEHICLE_LEGEND: Record<VehicleMode, string> = {
    completed: 'Motor di tujuan (selesai)',
    live: 'Posisi kurir (live)',
    'illustration-done': 'Ilustrasi sampai di tujuan',
    illustration: 'Motor ilustratif',
};
interface RouteApiPayload {
    source?: unknown;
    coordinates?: unknown;
    fallbackReason?: unknown;
}
interface MapLibreInstance {
    addControl: (control: unknown, position?: string) => void;
    on: (event: string, handler: (e?: unknown) => void) => void;
    resize: () => void;
    addSource: (id: string, source: unknown) => void;
    getSource: (id: string) => unknown;
    getLayer: (id: string) => unknown;
    removeLayer: (id: string) => void;
    removeSource: (id: string) => void;
    addLayer: (layer: unknown) => void;
    fitBounds: (bounds: [
        [
            number,
            number
        ],
        [
            number,
            number
        ]
    ], opts?: Record<string, unknown>) => void;
    remove: () => void;
}
function prefersReducedMotion(): boolean {
    return (typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
function applyVehicleMotionState(vehicleEl: HTMLElement, moving: boolean) {
    const root = vehicleEl.querySelector<HTMLElement>('[data-vehicle-root]');
    const shadow = vehicleEl.querySelector<HTMLElement>('[data-vehicle-shadow]');
    const styles = vehicleMotionStyles(moving);
    if (root)
        root.style.transform = styles.root;
    if (shadow) {
        shadow.style.transform = styles.shadow;
        shadow.style.opacity = styles.shadowOpacity;
    }
}
export default function DeliveryMap({ plan, className, animateRoute = false, courierPosition = null, completed = false, }: {
    plan: MapPlan;
    className?: string;
    animateRoute?: boolean;
    courierPosition?: {
        latitude: number;
        longitude: number;
    } | null;
    completed?: boolean;
}) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreInstance | null>(null);
    const vehicleRef = useRef<{
        setLngLat: (lngLat: [
            number,
            number
        ]) => void;
        getElement: () => HTMLElement;
    } | null>(null);
    const frameRef = useRef<number | null>(null);
    const tripStartRef = useRef<number | null>(null);
    const [tripFinished, setTripFinished] = useState(false);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [errorDetail, setErrorDetail] = useState<string | null>(null);
    const [route, setRoute] = useState<RouteCoordinate[] | null>(null);
    const [routeSource, setRouteSource] = useState<'road' | 'straight' | null>(null);
    const pivot = plan.center;
    const lat = pivot?.latitude ?? null;
    const lng = pivot?.longitude ?? null;
    const zoom = plan.zoom;
    const originLat = plan.origin?.latitude ?? null;
    const originLng = plan.origin?.longitude ?? null;
    const destinationLat = plan.destination?.latitude ?? null;
    const destinationLng = plan.destination?.longitude ?? null;
    useEffect(() => {
        if (originLat == null ||
            originLng == null ||
            destinationLat == null ||
            destinationLng == null) {
            setRoute(null);
            setRouteSource(null);
            return;
        }
        let cancelled = false;
        const fallback = straightRoute({ latitude: originLat, longitude: originLng }, { latitude: destinationLat, longitude: destinationLng });
        (async () => {
            try {
                const res = await fetchWithAuth('/api/delivery/route', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        originLatitude: originLat,
                        originLongitude: originLng,
                        destinationLatitude: destinationLat,
                        destinationLongitude: destinationLng,
                    }),
                });
                if (!res.ok)
                    throw new Error(`HTTP ${res.status}`);
                const json = (await res.json()) as RouteApiPayload;
                const coords = json.coordinates;
                if (!Array.isArray(coords) || coords.length < 2)
                    throw new Error('geometry kosong');
                if (cancelled)
                    return;
                setRoute(coords as RouteCoordinate[]);
                setRouteSource(json.source === 'road' ? 'road' : 'straight');
            }
            catch {
                if (cancelled)
                    return;
                setRoute(fallback);
                setRouteSource('straight');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [originLat, originLng, destinationLat, destinationLng]);
    useEffect(() => {
        tripStartRef.current = null;
        setTripFinished(false);
    }, [originLat, originLng, destinationLat, destinationLng]);
    useEffect(() => {
        if (lat == null || lng == null)
            return;
        let cancelled = false;
        let map: MapLibreInstance | null = null;
        let cleanupResize: (() => void) | null = null;
        (async () => {
            try {
                const maplibregl = (await import('maplibre-gl')).default;
                if (cancelled || !containerRef.current)
                    return;
                const instance = new maplibregl.Map({
                    container: containerRef.current,
                    style: MAP_STYLE_URL,
                    center: [lng, lat],
                    zoom,
                    attributionControl: false,
                }) as unknown as MapLibreInstance;
                mapRef.current = instance;
                map = instance;
                instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
                instance.on('load', () => {
                    if (cancelled)
                        return;
                    setStatus('ready');
                    const addMarker = (point: MapPoint, label: string, tone: 'origin' | 'destination') => {
                        const el = document.createElement('div');
                        const root = document.createElement('div');
                        root.style.cssText = 'display:flex;align-items:center;gap:6px;';
                        root.innerHTML =
                            `<span style="height:8px;width:8px;border-radius:9999px;background:${tone === 'origin' ? '#3B5240' : '#C8A882'};display:inline-block"></span>` +
                                `<span style="font:600 11px/1 ui-sans-serif,system-ui;color:#1E2A22;background:#fff;border:1px solid #DEDACF;border-radius:9999px;padding:4px 8px;white-space:nowrap;box-shadow:0 1px 2px rgba(0,0,0,.06)">${label}</span>`;
                        el.appendChild(root);
                        new maplibregl.Marker({ element: el })
                            .setLngLat([point.longitude, point.latitude])
                            .addTo(instance as never);
                    };
                    if (plan.origin)
                        addMarker(plan.origin, 'Toko', 'origin');
                    if (plan.destination)
                        addMarker(plan.destination, 'Tujuan', 'destination');
                    if (plan.origin && plan.destination) {
                        instance.fitBounds([
                            [
                                Math.min(plan.origin.longitude, plan.destination.longitude),
                                Math.min(plan.origin.latitude, plan.destination.latitude),
                            ],
                            [
                                Math.max(plan.origin.longitude, plan.destination.longitude),
                                Math.max(plan.origin.latitude, plan.destination.latitude),
                            ],
                        ], { padding: 56, maxZoom: 15, duration: 0 });
                    }
                });
                instance.on('error', (e: unknown) => {
                    const msg = e instanceof Error ? e.message : String(e);
                    console.error('[delivery-map] map error', msg);
                    if (!cancelled) {
                        setErrorDetail(msg);
                        setStatus('error');
                    }
                });
                const ro = new ResizeObserver(() => instance.resize());
                ro.observe(containerRef.current);
                cleanupResize = () => ro.disconnect();
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                console.error('[delivery-map] gagal memuat maplibre', msg);
                if (!cancelled) {
                    setErrorDetail(msg);
                    setStatus('error');
                }
            }
        })();
        return () => {
            cancelled = true;
            cleanupResize?.();
            if (frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
            vehicleRef.current = null;
            map?.remove();
            mapRef.current = null;
        };
// eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lat, lng, zoom]);
    useEffect(() => {
        const map = mapRef.current;
        if (!map || status !== 'ready' || !route || route.length < 2)
            return;
        let cancelled = false;
        (async () => {
            const maplibregl = (await import('maplibre-gl')).default;
            if (cancelled || !mapRef.current)
                return;
            [ROUTE_LAYER_ID, ROUTE_HALO_LAYER_ID].forEach((id) => {
                if (map.getLayer(id))
                    map.removeLayer(id);
            });
            if (map.getSource(ROUTE_SOURCE_ID))
                map.removeSource(ROUTE_SOURCE_ID);
            map.addSource(ROUTE_SOURCE_ID, {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'LineString', coordinates: route },
                },
            });
            map.addLayer({
                id: ROUTE_HALO_LAYER_ID,
                type: 'line',
                source: ROUTE_SOURCE_ID,
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: { 'line-color': ROUTE_COLOR, 'line-width': 10, 'line-opacity': 0.16 },
            });
            map.addLayer({
                id: ROUTE_LAYER_ID,
                type: 'line',
                source: ROUTE_SOURCE_ID,
                layout: { 'line-cap': 'round', 'line-join': 'round' },
                paint: {
                    'line-color': ROUTE_COLOR,
                    'line-width': 4,
                    'line-opacity': 0.9,
                    ...(routeSource === 'straight' ? { 'line-dasharray': [2, 1.4] } : {}),
                },
            });
            if (!vehicleRef.current) {
                const vehicleEl = document.createElement('div');
                vehicleEl.style.cssText = 'pointer-events:none;will-change:transform;';
                vehicleEl.innerHTML = buildVehicleMarkerHtml();
                const startPoint: [
                    number,
                    number
                ] = (completed && plan.destination)
                    ? [plan.destination.longitude, plan.destination.latitude]
                    : route[0] as [
                        number,
                        number
                    ];
                const marker = new maplibregl.Marker({
                    element: vehicleEl,
                    anchor: 'center',
                    rotationAlignment: 'map',
                })
                    .setLngLat(startPoint)
                    .addTo(map as never);
                vehicleRef.current = marker as unknown as {
                    setLngLat: (lngLat: [
                        number,
                        number
                    ]) => void;
                    getElement: () => HTMLElement;
                };
                applyVehicleMotionState(vehicleEl, false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [route, routeSource, status, completed, plan]);
    useEffect(() => {
        const map = mapRef.current;
        const vehicle = vehicleRef.current;
        if (!map || !vehicle || status !== 'ready' || !route || route.length < 2)
            return;
        if (completed) {
            if (plan.destination) {
                vehicle.setLngLat([plan.destination.longitude, plan.destination.latitude]);
            }
            applyVehicleMotionState(vehicle.getElement(), false);
            return;
        }
        if (!courierPosition)
            return;
        const projection = projectOntoRoute(route, courierPosition);
        if (!projection)
            return;
        vehicle.setLngLat(projection.position);
        applyVehicleMotionState(vehicle.getElement(), true);
        tripStartRef.current = performance.now() - projection.progress * TRIP_DURATION_MS;
        const heading = headingAtProgress(route, projection.progress);
        const inner = vehicle.getElement().querySelector('[data-vehicle-inner]');
        if (inner instanceof HTMLElement) {
            inner.style.transform = `rotate(${heading}deg)`;
        }
    }, [courierPosition, route, status, completed, plan]);
    useEffect(() => {
        if (completed ||
            !animateRoute ||
            courierPosition != null ||
            status !== 'ready' ||
            prefersReducedMotion() ||
            !route ||
            route.length < 2) {
            return;
        }
        if (tripStartRef.current === null)
            tripStartRef.current = performance.now();
        const step = (now: number) => {
            const vehicle = vehicleRef.current;
            if (!vehicle) {
                frameRef.current = requestAnimationFrame(step);
                return;
            }
            const startedAt = tripStartRef.current ?? now;
            const t = tripProgressAt(now - startedAt, TRIP_DURATION_MS);
            const point = pointAtProgress(route, t);
            if (point) {
                vehicle.setLngLat(point);
                const heading = headingAtProgress(route, t);
                const inner = vehicle.getElement().querySelector('[data-vehicle-inner]');
                if (inner instanceof HTMLElement) {
                    inner.style.transform = `rotate(${heading}deg)`;
                }
            }
            if (t >= 1) {
                applyVehicleMotionState(vehicle.getElement(), false);
                setTripFinished(true);
                frameRef.current = null;
                return;
            }
            frameRef.current = requestAnimationFrame(step);
        };
        const markerEl = vehicleRef.current?.getElement();
        if (markerEl)
            applyVehicleMotionState(markerEl, true);
        frameRef.current = requestAnimationFrame(step);
        return () => {
            if (frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
        };
    }, [animateRoute, courierPosition, status, route, completed]);
    if (plan.availability !== 'ready' || lat == null || lng == null) {
        return (<div className={cn('flex h-[260px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline bg-cream-50 px-6 text-center sm:h-[320px]', className)} aria-live="polite">

        <MapPinOff className="h-5 w-5 text-sage-500" aria-hidden/>

        <p className="max-w-xs text-sm leading-relaxed text-charcoal-500">

          {plan.message ?? 'Peta belum dapat ditampilkan.'}

        </p>

      </div>);
    }
    return (<div className={cn('relative h-[260px] overflow-hidden rounded-2xl border border-hairline bg-cream-50 sm:h-[320px] lg:h-[380px]', className)}>

      <div ref={containerRef} className="h-full w-full"/>



      {status === 'loading' && (<div className="absolute inset-0 flex items-center justify-center bg-cream-50/90">

          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden/>

          <span className="sr-only">Memuat peta</span>

        </div>)}



      {status === 'error' && (<div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-cream-50 px-6 text-center">

          <TriangleAlert className="h-5 w-5 text-caramel-dark" aria-hidden/>

          <p className="max-w-xs text-sm leading-relaxed text-charcoal-500">

            Peta tidak dapat dimuat. Informasi alamat dan status pengantaran tetap

            tersedia di bawah ini.

          </p>

          {process.env.NODE_ENV !== 'production' && errorDetail && (<p className="max-w-xs break-words text-[10px] text-charcoal-500/70">{errorDetail}</p>)}

        </div>)}



      

      {status === 'ready' && routeSource && (<p className="pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2 py-1 text-[10px] font-semibold text-charcoal-700 shadow-sm">

          <span aria-hidden className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: ROUTE_COLOR }}/>

          {routeSource === 'road' ? 'Rute jalan' : 'Rute perkiraan'}

        </p>)}



      

      {status === 'ready' && (<p className="pointer-events-none absolute bottom-8 left-2 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2 py-1 text-[10px] font-semibold text-charcoal-700 shadow-sm">

          <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: ROUTE_COLOR }}/>

          {VEHICLE_LEGEND[completed
                ? 'completed'
                : courierPosition
                    ? 'live'
                    : tripFinished
                        ? 'illustration-done'
                        : 'illustration']}

        </p>)}



      

      <p className="pointer-events-none absolute bottom-1 left-2 z-10 text-[10px] leading-tight text-charcoal-500">

        © OpenStreetMap contributors · tiles by OpenFreeMap

      </p>

    </div>);
}
