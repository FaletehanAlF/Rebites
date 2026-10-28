'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPinOff, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MapPlan, MapPoint } from '@/lib/delivery-map-plan';
// CSS MapLibre diimpor statis: Next menanganinya saat build (bukan saat runtime
// `await import(...)`, yang gagal resolve sebagai module).
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * Peta pengantaran (Tahap A).
 *
 * Batasan yang dijaga:
 * - Tiles dari OpenFreeMap — gratis, tanpa API key, TANPA SLA. Jangan
 *   mengklaim jaminan ketersediaan.
 * - Hanya marker toko & tujuan dari koordinat yang sudah divalidasi
 *   `buildMapPlan`. TIDAK ada marker kurir, tidak ada rute jalan, tidak ada
 *   ETA — infrastruktur GPS belum ada (docs/rencana-live-gps.md).
 * - Komponen ini di-import dinamis dengan ssr:false oleh pemanggil agar
 *   bundle peta tidak membebani halaman lain.
 */

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

export default function DeliveryMap({
  plan,
  className,
}: {
  plan: MapPlan;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const pivot = plan.center;
  const lat = pivot?.latitude ?? null;
  const lng = pivot?.longitude ?? null;
  const zoom = plan.zoom;

  useEffect(() => {
    if (lat == null || lng == null) return;
    let cancelled = false;
    let map: { remove: () => void } | null = null;
    let cleanupResize: (() => void) | null = null;

    (async () => {
      try {
        const maplibregl = (await import('maplibre-gl')).default;
        if (cancelled || !containerRef.current) return;

        const instance = new maplibregl.Map({
          container: containerRef.current,
          style: MAP_STYLE_URL,
          center: [lng, lat],
          zoom,
          // Atribusi dirender sendiri di bawah peta (selalu terlihat, tidak
          // menutupi kontrol zoom). Jangan disembunyikan di balik tombol.
          attributionControl: false,
        });
        mapRef.current = instance;
        map = instance;

        instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

        instance.on('load', () => {
          if (cancelled) return;
          setStatus('ready');

          const addMarker = (point: MapPoint, label: string, tone: 'origin' | 'destination') => {
            const el = document.createElement('div');
            const root = document.createElement('div');
            // Container kosong diisi React lewat portal-like manual paint:
            // cukup teks + dot agar tidak perlu render React di dalam canvas.
            root.style.cssText = 'display:flex;align-items:center;gap:6px;';
            root.innerHTML =
              `<span style="height:8px;width:8px;border-radius:9999px;background:${tone === 'origin' ? '#3B5240' : '#C8A882'};display:inline-block"></span>` +
              `<span style="font:600 11px/1 ui-sans-serif,system-ui;color:#1E2A22;background:#fff;border:1px solid #DEDACF;border-radius:9999px;padding:4px 8px;white-space:nowrap;box-shadow:0 1px 2px rgba(0,0,0,.06)">${label}</span>`;
            el.appendChild(root);
            new maplibregl.Marker({ element: el })
              .setLngLat([point.longitude, point.latitude])
              .addTo(instance);
          };

          if (plan.origin) addMarker(plan.origin, 'Toko', 'origin');
          if (plan.destination) addMarker(plan.destination, 'Tujuan', 'destination');

          // Tampilkan kedua titik sekaligus bila ada.
          if (plan.origin && plan.destination) {
            instance.fitBounds(
              [
                [Math.min(plan.origin.longitude, plan.destination.longitude), Math.min(plan.origin.latitude, plan.destination.latitude)],
                [Math.max(plan.origin.longitude, plan.destination.longitude), Math.max(plan.origin.latitude, plan.destination.latitude)],
              ],
              { padding: 56, maxZoom: 15, duration: 0 }
            );
          }
        });

        instance.on('error', (e: unknown) => {
          // Kegagalan muat style/tile: jangan tampilkan peta abu-abu kosong.
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
      } catch (e) {
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
      map?.remove();
      mapRef.current = null;
    };
    // Plan dianggap stabil per kombinasi titik; hindari re-init tiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, zoom]);

  if (plan.availability !== 'ready' || lat == null || lng == null) {
    return (
      <div
        className={cn(
          'flex h-[260px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-hairline bg-cream-50 px-6 text-center sm:h-[320px]',
          className
        )}
        aria-live="polite"
      >
        <MapPinOff className="h-5 w-5 text-sage-500" aria-hidden />
        <p className="max-w-xs text-sm leading-relaxed text-charcoal-500">
          {plan.message ?? 'Peta belum dapat ditampilkan.'}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative h-[260px] overflow-hidden rounded-2xl border border-hairline bg-cream-50 sm:h-[320px] lg:h-[380px]',
        className
      )}
    >
      <div ref={containerRef} className="h-full w-full" />

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-cream-50/90">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
          <span className="sr-only">Memuat peta</span>
        </div>
      )}

      {status === 'error' && (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-cream-50 px-6 text-center"
        >
          <TriangleAlert className="h-5 w-5 text-caramel-dark" aria-hidden />
          <p className="max-w-xs text-sm leading-relaxed text-charcoal-500">
            Peta tidak dapat dimuat. Informasi alamat dan status pengantaran tetap
            tersedia di bawah ini.
          </p>
          {process.env.NODE_ENV !== 'production' && errorDetail && (
            <p className="max-w-xs break-words text-[10px] text-charcoal-500/70">{errorDetail}</p>
          )}
        </div>
      )}

      {/* Atribusi wajib OpenStreetMap & OpenFreeMap — di luar canvas agar
          tidak menutupi kontrol peta dan selalu terbaca. */}
      <p className="pointer-events-none absolute bottom-1 left-2 z-10 text-[10px] leading-tight text-charcoal-500">
        © OpenStreetMap contributors · tiles by OpenFreeMap
      </p>
    </div>
  );
}
