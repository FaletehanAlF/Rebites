'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPinOff, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MapPlan, MapPoint } from '@/lib/delivery-map-plan';
import {
  headingAtProgress,
  pointAtProgress,
  straightRoute,
  type RouteCoordinate,
} from '@/lib/route-geometry';
import { fetchWithAuth } from '@/lib/auth-token';
// CSS MapLibre diimpor statis: Next menanganinya saat build (bukan saat runtime
// `await import(...)`, yang gagal resolve sebagai module).
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * Peta pengantaran.
 *
 * Batasan yang dijaga:
 * - Tiles dari OpenFreeMap — gratis, tanpa API key, TANPA SLA.
 * - Marker toko & tujuan hanya dari koordinat yang sudah divalidasi
 *   `buildMapPlan`. TIDAK ada penebakan dari alamat teks.
 * - GARIS RUTE mengikuti jalan nyata dari layanan routing (lewat
 *   `/api/delivery/route`). Bila layanan itu gagal, peta turun ke garis lurus
 *   dan LABELNYA BERUBAH — pembeli tidak boleh mengira garis lurus sebagai
 *   rute jalan.
 * - Marker kendaraan tetap ILUSTRASI PERJALANAN, bukan posisi kurir: tidak
 *   ada kolom koordinat kurir di database. Animasi hanya menyala ketika
 *   pemanggil menyatakan pengantaran sedang berlangsung, dan keterangan di UI
 *   menyebutnya sebagai estimasi.
 * - Animasi hanya mengubah posisi & rotasi marker DOM (`setLngLat` + satu
 *   `transform`), tanpa re-render React, tanpa layer 3D.
 * - `prefers-reduced-motion` mematikan animasi; kendaraan diletakkan di titik
 *   awal rute.
 */

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/** Warna garis rute & kendaraan. Hijau primary ReBites, bukan hijau acak. */
const ROUTE_COLOR = '#1B6B3A';

const ROUTE_SOURCE_ID = 'rebites-route';
const ROUTE_HALO_LAYER_ID = 'rebites-route-halo';
const ROUTE_LAYER_ID = 'rebites-route-line';

/**
 * Satu putaran animasi. 24 detik cukup lambat untuk terbaca, tidak membeku.
 * Kecepatan kendaraan TIDAK diklaim sebagai kecepatan nyata — ini hanya
 * tempo agar perjalanan terlihat, bukan estimasi waktu tempuh.
 */
const ANIMATION_DURATION_MS = 24_000;

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
  fitBounds: (bounds: [[number, number], [number, number]], opts?: Record<string, unknown>) => void;
  remove: () => void;
}

export default function DeliveryMap({
  plan,
  className,
  /** true = pengantaran sedang berjalan; menyalakan animasi kendaraan. */
  animateRoute = false,
}: {
  plan: MapPlan;
  className?: string;
  animateRoute?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // `unknown` dipakai agar tipe MapLibre tidak bocor ke props pemanggil yang
  // meng-import komponen ini secara dinamis.
  const mapRef = useRef<MapLibreInstance | null>(null);
  const vehicleRef = useRef<{
    setLngLat: (lngLat: [number, number]) => void;
    getElement: () => HTMLElement;
  } | null>(null);
  const frameRef = useRef<number | null>(null);
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

  /**
   * Ambil rute jalan dari server.
   *
   * Kegagalan apa pun (belum login, jaringan, penyedia routing mati) TIDAK
   * boleh mengosongkan peta: peta turun ke garis lurus dan labelnya berubah
   * menjadi "Rute perkiraan". Yang dilarang adalah menampilkan garis lurus
   * sambil menyebutnya rute jalan.
   */
  useEffect(() => {
    if (
      originLat == null ||
      originLng == null ||
      destinationLat == null ||
      destinationLng == null
    ) {
      setRoute(null);
      setRouteSource(null);
      return;
    }

    let cancelled = false;
    const fallback = straightRoute(
      { latitude: originLat, longitude: originLng },
      { latitude: destinationLat, longitude: destinationLng }
    );

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
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as RouteApiPayload;
        const coords = json.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) throw new Error('geometry kosong');
        if (cancelled) return;
        setRoute(coords as RouteCoordinate[]);
        setRouteSource(json.source === 'road' ? 'road' : 'straight');
      } catch {
        if (cancelled) return;
        setRoute(fallback);
        setRouteSource('straight');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [originLat, originLng, destinationLat, destinationLng]);

  // --- Inisialisasi peta -----------------------------------------------------
  useEffect(() => {
    if (lat == null || lng == null) return;
    let cancelled = false;
    let map: MapLibreInstance | null = null;
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
        }) as unknown as MapLibreInstance;
        mapRef.current = instance;
        map = instance;

        instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

        instance.on('load', () => {
          if (cancelled) return;
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

          if (plan.origin) addMarker(plan.origin, 'Toko', 'origin');
          if (plan.destination) addMarker(plan.destination, 'Tujuan', 'destination');

          if (plan.origin && plan.destination) {
            instance.fitBounds(
              [
                [
                  Math.min(plan.origin.longitude, plan.destination.longitude),
                  Math.min(plan.origin.latitude, plan.destination.latitude),
                ],
                [
                  Math.max(plan.origin.longitude, plan.destination.longitude),
                  Math.max(plan.origin.latitude, plan.destination.latitude),
                ],
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
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      vehicleRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
    // Plan dianggap stabil per kombinasi titik; hindari re-init tiap render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, zoom]);

  // --- Gambar rute + buat marker kendaraan ----------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready' || !route || route.length < 2) return;

    let cancelled = false;

    (async () => {
      const maplibregl = (await import('maplibre-gl')).default;
      if (cancelled || !mapRef.current) return;

      // Hapus layer lama sebelum memasang yang baru, supaya rute tidak
      // menumpuk saat data berubah.
      [ROUTE_LAYER_ID, ROUTE_HALO_LAYER_ID].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);

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
          // Putus-putus hanya untuk garis lurus (bukan rute jalan) — bentuk
          // garis itu sendiri sudah memberi tahu bahwa ia perkiraan.
          ...(routeSource === 'straight' ? { 'line-dasharray': [2, 1.4] } : {}),
        },
      });

      // Marker kendaraan: motor hijau datar di dalam DOM. Bukan 3D, bukan
      // model, jadi biaya per frame hanya satu transform.
      if (!vehicleRef.current) {
        const vehicleEl = document.createElement('div');
        vehicleEl.style.cssText = 'pointer-events:none;will-change:transform;';
        vehicleEl.innerHTML =
          '<div data-vehicle-inner style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;' +
          'border-radius:9999px;background:#fff;border:2px solid ' +
          ROUTE_COLOR +
          ';box-shadow:0 2px 6px rgba(27,43,32,.22);transition:transform 120ms linear">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' +
          ROUTE_COLOR +
          '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<circle cx="5.5" cy="17" r="3.2"></circle>' +
          '<circle cx="18.5" cy="17" r="3.2"></circle>' +
          '<path d="M5.5 17h3.5l3-6h3l3.5 6"></path>' +
          '<path d="M12 11 10.5 7.5h3"></path>' +
          '</svg></div>';

        const marker = new maplibregl.Marker({
          element: vehicleEl,
          // Titik jangkar di tengah lingkaran, bukan di ujungnya.
          anchor: 'center',
          rotationAlignment: 'map',
        })
          .setLngLat(route[0])
          .addTo(map as never);

        vehicleRef.current = marker as unknown as {
          setLngLat: (lngLat: [number, number]) => void;
          getElement: () => HTMLElement;
        };
      } else {
        vehicleRef.current.setLngLat(route[0]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [route, routeSource, status]);

  /**
   * Animasi kendaraan dipisah dari efek inisialisasi peta.
   *
   * Memisahkan berarti perubahan status pengantaran tidak akan membuang dan
   * membangun ulang peta (tile + style dimuat ulang = kedipan dan boros).
   * Loop hanya menyentuh marker; berhenti bersih saat unmount, saat animasi
   * dimatikan, dan saat preferensi gerak dikurangi.
   *
   * Gerakan memakai PANJANG SEGMEN (`pointAtProgress`), bukan indeks titik,
   * sehingga kendaraan tidak melaju cepat di segmen panjang lalu merayap di
   * segmen pendek.
   */
  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!animateRoute || status !== 'ready' || reduceMotion || !route || route.length < 2) {
      return;
    }

    let startedAt: number | null = null;

    const step = (now: number) => {
      const vehicle = vehicleRef.current;
      if (!vehicle) {
        // Marker belum terpasang (peta sedang memuat ulang); berhenti saja —
        // efek akan jalan lagi begitu status kembali 'ready'.
        frameRef.current = null;
        return;
      }
      if (startedAt === null) startedAt = now;
      const elapsed = (now - startedAt) % ANIMATION_DURATION_MS;
      const raw = elapsed / ANIMATION_DURATION_MS;
      // Bolak-balik (0->1->0) supaya kendaraan tidak "melompat" ke titik awal
      // tiap putaran. Halus tanpa easing tambahan per frame.
      const forward = raw <= 0.5;
      const t = forward ? raw * 2 : (1 - raw) * 2;

      const point = pointAtProgress(route, t);
      if (point) {
        vehicle.setLngLat(point);
        // Arah ikon mengikuti arah jalan; saat kembali, hadapnya dibalik.
        const heading = headingAtProgress(route, t) + (forward ? 0 : 180);
        const inner = vehicle.getElement().querySelector('[data-vehicle-inner]');
        if (inner instanceof HTMLElement) {
          inner.style.transform = `rotate(${heading}deg)`;
        }
      }
      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [animateRoute, status, route]);

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

      {/* Legenda rute: menjelaskan arti garis hijau tanpa harus menebak.
          Label berubah sesuai sumber rute — garis lurus TIDAK disebut rute. */}
      {status === 'ready' && routeSource && (
        <p className="pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2 py-1 text-[10px] font-semibold text-charcoal-700 shadow-sm">
          <span
            aria-hidden
            className="inline-block h-0.5 w-4 rounded-full"
            style={{ backgroundColor: ROUTE_COLOR }}
          />
          {routeSource === 'road' ? 'Rute jalan' : 'Rute perkiraan'}
        </p>
      )}

      {/* Atribusi wajib OpenStreetMap & OpenFreeMap — di luar canvas agar
          tidak menutupi kontrol peta dan selalu terbaca. */}
      <p className="pointer-events-none absolute bottom-1 left-2 z-10 text-[10px] leading-tight text-charcoal-500">
        © OpenStreetMap contributors · tiles by OpenFreeMap
      </p>
    </div>
  );
}
