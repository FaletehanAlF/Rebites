'use client';
import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPinOff, RotateCcw, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import 'maplibre-gl/dist/maplibre-gl.css';
const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const DEFAULT_VIEW = { latitude: -6.38, longitude: 106.83, zoom: 12 };
export interface LocationPickerMapProps {
    latitude: number | null;
    longitude: number | null;
    onPick: (latitude: number, longitude: number) => void;
    initialLatitude?: number | null;
    initialLongitude?: number | null;
    className?: string;
}
export default function LocationPickerMap({ latitude, longitude, onPick, initialLatitude = null, initialLongitude = null, className, }: LocationPickerMapProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const onPickRef = useRef(onPick);
    onPickRef.current = onPick;
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [errorDetail, setErrorDetail] = useState<string | null>(null);
    const hasPoint = latitude != null && longitude != null;
    useEffect(() => {
        let cancelled = false;
        let map: any = null;
        (async () => {
            try {
                const maplibregl = (await import('maplibre-gl')).default;
                if (cancelled || !containerRef.current)
                    return;
                map = new maplibregl.Map({
                    container: containerRef.current,
                    style: MAP_STYLE_URL,
                    center: [DEFAULT_VIEW.longitude, DEFAULT_VIEW.latitude],
                    zoom: DEFAULT_VIEW.zoom,
                    attributionControl: false,
                });
                mapRef.current = map;
                map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
                map.on('load', () => {
                    if (cancelled)
                        return;
                    setStatus('ready');
                    map.on('click', (e: {
                        lngLat: {
                            lat: number;
                            lng: number;
                        };
                    }) => {
                        onPickRef.current(Number(e.lngLat.lat.toFixed(6)), Number(e.lngLat.lng.toFixed(6)));
                    });
                });
                map.on('error', (e: unknown) => {
                    const msg = e instanceof Error ? e.message : String(e);
                    console.error('[location-picker] map error', msg);
                    if (!cancelled) {
                        setErrorDetail(msg);
                        setStatus('error');
                    }
                });
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                console.error('[location-picker] gagal memuat maplibre', msg);
                if (!cancelled) {
                    setErrorDetail(msg);
                    setStatus('error');
                }
            }
        })();
        return () => {
            cancelled = true;
            markerRef.current?.remove();
            markerRef.current = null;
            map?.remove();
            mapRef.current = null;
        };
    }, []);
    useEffect(() => {
        const map = mapRef.current;
        if (!map || status !== 'ready')
            return;
        (async () => {
            const maplibregl = (await import('maplibre-gl')).default;
            if (!hasPoint) {
                markerRef.current?.remove();
                markerRef.current = null;
                return;
            }
            const lngLat: [
                number,
                number
            ] = [longitude as number, latitude as number];
            if (!markerRef.current) {
                const el = document.createElement('div');
                el.style.cssText =
                    'height:16px;width:16px;border-radius:9999px;background:#3B5240;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);cursor:grab';
                const marker = new maplibregl.Marker({ element: el, draggable: true })
                    .setLngLat(lngLat)
                    .addTo(map);
                marker.on('dragend', () => {
                    const p = marker.getLngLat();
                    onPickRef.current(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)));
                });
                markerRef.current = marker;
            }
            else {
                markerRef.current.setLngLat(lngLat);
            }
            map.easeTo({ center: lngLat, duration: 300 });
        })();
    }, [status, hasPoint, latitude, longitude]);
    const canRevert = initialLatitude != null &&
        initialLongitude != null &&
        (latitude !== initialLatitude || longitude !== initialLongitude);
    return (<div className={cn('space-y-2', className)}>

      <div className="relative h-[220px] overflow-hidden rounded-xl border border-hairline bg-cream-50 sm:h-[260px]">

        <div ref={containerRef} className="h-full w-full"/>



        {status === 'loading' && (<div className="absolute inset-0 flex items-center justify-center bg-cream-50/90">

            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden/>

            <span className="sr-only">Memuat peta</span>

          </div>)}



        {status === 'error' && (<div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-cream-50 px-5 text-center">

            <TriangleAlert className="h-4 w-4 text-caramel-dark" aria-hidden/>

            <p className="text-xs leading-relaxed text-charcoal-500">

              Peta tidak dapat dimuat. Isi latitude dan longitude secara manual di

              bawah.

            </p>

            {process.env.NODE_ENV !== 'production' && errorDetail && (<p className="max-w-full break-words text-[10px] text-charcoal-500/70">

                {errorDetail}

              </p>)}

          </div>)}



        {status === 'ready' && !hasPoint && (<div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-lg bg-white/95 px-3 py-2 text-[11px] leading-relaxed text-charcoal-500 shadow-sm ring-1 ring-hairline">

            <MapPinOff className="mr-1 inline h-3 w-3 align-[-2px] text-sage-500" aria-hidden/>

            Belum ada titik. Klik pada peta untuk menandai lokasi.

          </div>)}



        <p className="pointer-events-none absolute bottom-1 left-2 z-10 text-[10px] leading-tight text-charcoal-500">

          © OpenStreetMap contributors · tiles by OpenFreeMap

        </p>

      </div>



      <div className="flex flex-wrap items-center justify-between gap-2">

        <p className="text-[11px] text-charcoal-500" aria-live="polite">

          {hasPoint
            ? `Titik dipilih: ${latitude!.toFixed(6)}, ${longitude!.toFixed(6)}`
            : 'Klik peta atau geser marker untuk memilih titik.'}

        </p>

        {canRevert && (<button type="button" onClick={() => {
                onPick(initialLatitude as number, initialLongitude as number);
            }} className="inline-flex items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-[11px] font-semibold text-charcoal-700 transition-colors hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">

            <RotateCcw className="h-3 w-3" aria-hidden/>

            Kembalikan

          </button>)}

      </div>

    </div>);
}
