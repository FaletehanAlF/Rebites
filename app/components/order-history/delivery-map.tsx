'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPinOff, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MapPlan, MapPoint } from '@/lib/delivery-map-plan';
// CSS MapLibre diimpor statis: Next menanganinya saat build (bukan saat runtime
// `await import(...)`, yang gagal resolve sebagai module).
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * Peta pengantaran.
 *
 * Batasan yang dijaga:
 * - Tiles dari OpenFreeMap — gratis, tanpa API key, TANPA SLA. Jangan
 *   mengklaim jaminan ketersediaan.
 * - Marker toko & tujuan hanya dari koordinat yang sudah divalidasi
 *   `buildMapPlan`. TIDAK ada penebakan dari alamat teks.
 * - GARIS RUTE adalah garis lurus antara dua titik nyata, BUKAN rute jalan.
 *   Repo ini belum punya layanan routing, jadi menggambarnya mengikuti jalan
 *   berarti mengarang belokan yang tidak pernah diverifikasi. Pemanggil wajib
 *   memberi keterangan bahwa garis ini perkiraan.
 * - Marker kendaraan adalah ILUSTRASI PERJALANAN, bukan posisi kurir. Tidak
 *   ada GPS kurir di database (tidak ada kolom koordinat kurir), sehingga
 *   animasi hanya boleh menyala ketika pemanggil menyatakan pengantaran
 *   sedang berlangsung, dan keterangan di UI harus menyebutnya sebagai
 *   estimasi.
 * - Animasi hanya mengubah posisi marker DOM (`setLngLat`), yaitu satu
 *   `transform` per frame — tidak ada re-render React, tidak ada layer 3D,
 *   tidak ada efek tambahan. Ini jalur termurah yang tersedia di MapLibre.
 * - `prefers-reduced-motion` mematikan animasi; kendaraan diletakkan di titik
 *   awal rute.
 */

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/** Warna garis rute. Hijau primary ReBites, bukan hijau acak. */
const ROUTE_COLOR = '#1B6B3A';

const ROUTE_SOURCE_ID = 'rebites-route';
const ROUTE_HALO_LAYER_ID = 'rebites-route-halo';
const ROUTE_LAYER_ID = 'rebites-route-line';

/** Satu putaran animasi. 22 detik cukup lambat untuk terbaca, tidak membeku. */
const ANIMATION_DURATION_MS = 22_000;

/** Interpolasi linear antar dua titik — cukup untuk garis lurus. */
function lerpPoint(from: MapPoint, to: MapPoint, t: number): [number, number] {
  return [
    from.longitude + (to.longitude - from.longitude) * t,
    from.latitude + (to.latitude - from.latitude) * t,
  ];
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
  const mapRef = useRef<unknown>(null);
  const vehicleRef = useRef<{ setLngLat: (lngLat: [number, number]) => void } | null>(null);
  const frameRef = useRef<number | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const pivot = plan.center;
  const lat = pivot?.latitude ?? null;
  const lng = pivot?.longitude ?? null;
  const zoom = plan.zoom;
  const hasRoute = plan.origin != null && plan.destination != null;

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

          // Garis rute: dua layer supaya tepinya lembut tanpa blur/shadow.
          if (plan.origin && plan.destination) {
            const route: [number, number][] = [
              [plan.origin.longitude, plan.origin.latitude],
              [plan.destination.longitude, plan.destination.latitude],
            ];
            instance.addSource(ROUTE_SOURCE_ID, {
              type: 'geojson',
              data: {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: route },
              },
            });
            instance.addLayer({
              id: ROUTE_HALO_LAYER_ID,
              type: 'line',
              source: ROUTE_SOURCE_ID,
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: { 'line-color': ROUTE_COLOR, 'line-width': 10, 'line-opacity': 0.16 },
            });
            instance.addLayer({
              id: ROUTE_LAYER_ID,
              type: 'line',
              source: ROUTE_SOURCE_ID,
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: {
                'line-color': ROUTE_COLOR,
                'line-width': 4,
                'line-opacity': 0.9,
                // Putus-putus menandai "perkiraan", bukan rute jalan nyata.
                'line-dasharray': [2, 1.4],
              },
            });

            // Marker kendaraan: SVG datar di dalam DOM. Bukan 3D, bukan model,
            // jadi biaya per frame hanya satu transform.
            const vehicleEl = document.createElement('div');
            vehicleEl.style.cssText = 'pointer-events:none;will-change:transform;';
            vehicleEl.innerHTML =
              '<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;' +
              'border-radius:9999px;background:#fff;border:2px solid ' +
              ROUTE_COLOR +
              ';box-shadow:0 2px 6px rgba(27,43,32,.22)">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' +
              ROUTE_COLOR +
              '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              '<circle cx="5.5" cy="17.5" r="3"></circle>' +
              '<circle cx="18.5" cy="17.5" r="3"></circle>' +
              '<path d="M15 6h3l1.5 4.5"></path>' +
              '<path d="M5.5 17.5 9 8h4l3 9.5"></path>' +
              '<path d="M9 8h4"></path>' +
              '</svg></div>';

            const vehicle = new maplibregl.Marker({
              element: vehicleEl,
              // Titik jangkar di tengah lingkaran, bukan di ujungnya.
              anchor: 'center',
            })
              .setLngLat(route[0])
              .addTo(instance);
            vehicleRef.current = vehicle as unknown as {
              setLngLat: (lngLat: [number, number]) => void;
            };
          }

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
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      vehicleRef.current = null;
      map?.remove();
      mapRef.current = null;
    };
    // Plan dianggap stabil per kombinasi titik; hindari re-init tiap render.
    // `hasRoute` ikut karena menentukan apakah source/layer rute dibuat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, zoom, hasRoute]);

  /**
   * Animasi kendaraan dipisah dari efek inisialisasi peta.
   *
   * Memisahkan berarti perubahan status pengantaran tidak akan membuang dan
   * membangun ulang peta (tile + style dimuat ulang = kedipan dan boros).
   * Loop hanya menyentuh marker; berhenti bersih saat unmount, saat animasi
   * dimatikan, dan saat preferensi gerak dikurangi.
   *
   * Dependensi memakai ANGKA koordinat, bukan objek `plan.origin` —
   * `buildMapPlan` membuat objek baru tiap render, sehingga dependensi objek
   * akan me-restart loop animasi di setiap render dan gerakannya tersendat.
   * Loop juga menunggu `status === 'ready'`; tanpa itu ia memutar
   * requestAnimationFrame selamanya ketika peta gagal dimuat.
   */
  const originLat = plan.origin?.latitude ?? null;
  const originLng = plan.origin?.longitude ?? null;
  const destinationLat = plan.destination?.latitude ?? null;
  const destinationLng = plan.destination?.longitude ?? null;

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (
      !animateRoute ||
      status !== 'ready' ||
      reduceMotion ||
      originLat == null ||
      originLng == null ||
      destinationLat == null ||
      destinationLng == null
    ) {
      return;
    }

    const from: MapPoint = { latitude: originLat, longitude: originLng };
    const to: MapPoint = { latitude: destinationLat, longitude: destinationLng };
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
      const t = elapsed / ANIMATION_DURATION_MS;
      // Bolak-balik (0→1→0) supaya kendaraan tidak "melompat" ke titik awal
      // tiap putaran. Halus tanpa easing tambahan per frame.
      const eased = t <= 0.5 ? t * 2 : (1 - t) * 2;
      vehicle.setLngLat(lerpPoint(from, to, eased));
      frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [animateRoute, status, originLat, originLng, destinationLat, destinationLng]);

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
          Hanya muncul saat rute memang digambar. */}
      {status === 'ready' && hasRoute && (
        <p className="pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2 py-1 text-[10px] font-semibold text-charcoal-700 shadow-sm">
          <span aria-hidden className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: ROUTE_COLOR }} />
          Rute perkiraan
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
