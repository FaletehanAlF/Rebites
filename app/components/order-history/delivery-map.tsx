'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPinOff, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MapPlan, MapPoint } from '@/lib/delivery-map-plan';
import {
  headingAtProgress,
  pointAtProgress,
  straightRoute,
  tripProgressAt,
  type RouteCoordinate,
} from '@/lib/route-geometry';
import { projectOntoRoute } from '@/lib/courier-location';
import { fetchWithAuth } from '@/lib/auth-token';
import { buildVehicleMarkerHtml, vehicleMotionStyles } from '@/lib/map-vehicle-marker';
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
 * - Marker kendaraan punya DUA sumber yang tidak pernah jalan bersamaan:
 *   posisi kurir NYATA (`courierPosition`, dari tabel `delivery_locations`),
 *   atau — selama kurir belum mengirim posisi — animasi ILUSTRATIF sepanjang
 *   rute. Keterangan di UI menyebut yang mana yang sedang dipakai.
 * - Animasi hanya mengubah posisi & rotasi marker DOM (`setLngLat` + satu
 *   `transform`), tanpa re-render React, tanpa layer 3D/WebGL tambahan.
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
 * Durasi SATU KALI jalan dari titik awal ke tujuan, dalam milidetik.
 *
 * 40 detik dipilih supaya perjalanannya pelan: kendaraan tidak melesat
 * melewati peta, dan posisinya sempat terbaca di sepanjang jalan. Kecepatan
 * ini TIDAK diklaim sebagai waktu tempuh nyata — itu tetap milik estimasi
 * pesanan.
 */
const TRIP_DURATION_MS = 40_000;

/**
 * Apa yang sedang ditunjukkan ikon motor. Dipakai untuk keterangan di peta —
 * pemakai harus selalu bisa membedakan posisi NYATA dari ilustrasi.
 */
type VehicleMode = 'completed' | 'live' | 'illustration-done' | 'illustration';

const VEHICLE_LEGEND: Record<VehicleMode, string> = {
  completed: 'Motor di tujuan (selesai)',
  live: 'Posisi kurir (live)',
  // Ilustrasi sudah sampai ujung rute sementara pesanan masih berjalan.
  // Tidak ada putaran kedua (itu akan berarti kendaraan berjalan mundur),
  // jadi keadaannya dikatakan apa adanya.
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
  fitBounds: (bounds: [[number, number], [number, number]], opts?: Record<string, unknown>) => void;
  remove: () => void;
}

/**
 * Apakah pengguna meminta gerak dikurangi?
 *
 * Dipakai di dua tempat (pembuatan marker dan loop animasi) supaya keduanya
 * tidak bisa berbeda pendapat soal kapan animasi boleh jalan.
 */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Keadaan visual kendaraan: sedang berjalan atau berhenti di tujuan.
 *
 * Saat berjalan, badan kendaraan sedikit terangkat dari bayangannya; saat
 * berhenti ia turun kembali. Ini penanda keadaan, bukan hiasan: tanpa
 * perbedaan itu, motor yang sedang melaju dan motor yang sudah sampai
 * terlihat sama. Hanya `transform` dan `opacity` yang disentuh — tidak ada
 * properti layout yang berubah.
 */
function applyVehicleMotionState(vehicleEl: HTMLElement, moving: boolean) {
  const root = vehicleEl.querySelector<HTMLElement>('[data-vehicle-root]');
  const shadow = vehicleEl.querySelector<HTMLElement>('[data-vehicle-shadow]');
  const styles = vehicleMotionStyles(moving);
  if (root) root.style.transform = styles.root;
  if (shadow) {
    shadow.style.transform = styles.shadow;
    shadow.style.opacity = styles.shadowOpacity;
  }
}

export default function DeliveryMap({
  plan,
  className,
  /** true = pengantaran sedang berjalan; menyalakan animasi kendaraan. */
  animateRoute = false,
  /**
   * Posisi kurir NYATA (dari GPS perangkat kurir).
   *
   * Kalau ada, markerKendaraan mengikuti posisi ini — bukan animasi
   * ilustratif. Posisi diproyeksikan ke rute supaya motor meluncur tepat di
   * atas jalan, bukan meleset ke gang kecil.
   *
   * `null` berarti kurir belum mengirim posisi: animasi ilustratif yang
   * dipakai, dan label UI menjelaskan bahwa itu ilustrasi.
   */
  courierPosition = null,
  /** true = pesanan sudah selesai; kendaraan ditempatkan di tujuan. */
  completed = false,
}: {
  plan: MapPlan;
  className?: string;
  animateRoute?: boolean;
  courierPosition?: { latitude: number; longitude: number } | null;
  completed?: boolean;
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
  /**
   * Waktu mulai perjalanan ilustratif (`performance.now()`).
   *
   * Disimpan di ref, bukan variabel lokal effect, supaya effect yang terpasang
   * ulang (rute jalan baru datang, status berubah, posisi GPS sempat hilang)
   * MELANJUTKAN perjalanan yang sedang berjalan. Kalau waktunya ikut direset,
   * kendaraan melompat kembali ke titik awal lalu melaju dari sana lagi —
   * gerakan mundur yang justru harus dihindari.
   */
  const tripStartRef = useRef<number | null>(null);
  /** Ilustrasi sudah sampai ujung rute (pesanan mungkin masih berjalan). */
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

  // --- Perjalanan ilustratif milik satu pesanan ------------------------------
  /**
   * Mulai ulang catatan perjalanan ketika titik toko/tujuan berubah.
   *
   * Ref dan status di bawah hidup selama komponen terpasang, sedangkan halaman
   * ini bisa berpindah ke pesanan lain tanpa melepas komponen. Tanpa
   * pengaturan ulang, perjalanan pesanan sebelumnya ikut terbawa: motor
   * langsung muncul di ujung rute ("Ilustrasi sampai di tujuan") padahal
   * pengantaran baru dimulai.
   */
  useEffect(() => {
    tripStartRef.current = null;
    setTripFinished(false);
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

      // Marker kendaraan: ikon motor dari `lib/map-vehicle-marker.ts`.
      // Ikonnya digambar (bukan model 3D/WebGL), jadi biaya per frame animasi
      // tetap satu `transform`.
      //
      // POSISI TIDAK DIUBAH DI SINI. Setelah marker ada, yang memiliki
      // posisinya hanya loop animasi dan pembacaan posisi GPS. Sebelumnya
      // cabang `else` di bawah memindahkan marker kembali ke titik awal setiap
      // kali rute/peta dimuat ulang — itu salah satu sebab kendaraan terlihat
      // melompat mundur.
      if (!vehicleRef.current) {
        const vehicleEl = document.createElement('div');
        vehicleEl.style.cssText = 'pointer-events:none;will-change:transform;';
        vehicleEl.innerHTML = buildVehicleMarkerHtml();

        const startPoint: [number, number] = (completed && plan.destination)
          ? [plan.destination.longitude, plan.destination.latitude]
          : route[0] as [number, number];

        const marker = new maplibregl.Marker({
          element: vehicleEl,
          // Titik jangkar di tengah sprite.
          anchor: 'center',
          rotationAlignment: 'map',
        })
          .setLngLat(startPoint)
          .addTo(map as never);

        vehicleRef.current = marker as unknown as {
          setLngLat: (lngLat: [number, number]) => void;
          getElement: () => HTMLElement;
        };
        // Pesanan selesai -> kendaraan berhenti di tujuan sejak awal. Selain
        // itu keadaan awal "berhenti": yang menyalakan mode berjalan hanya
        // loop animasi atau pembacaan posisi GPS, sehingga motor tidak
        // terlihat melaju saat pesanan masih disiapkan.
        applyVehicleMotionState(vehicleEl, false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [route, routeSource, status, completed, plan]);

  /**
   * Marker kendaraan mengikuti POSISI KURIR NYATA bila tersedia.
   *
   * Dipisah dari animasi ilustratif: bila posisi GPS kurir ada, marker
   * DIPINDAH ke titik itu (diproyeksikan ke rute) dan animasi illustratif
   * DIMATIKAN. Dua-duanya tidak pernah berjalan bersamaan — kalau animasi
   * tetap jalan, motor akan melompat balik dan forth saat posisi GPS juga
   * bergerak, dan pengguna tidak tahu mana yang benar.
   *
   * Arah ikon mengikuti arah jalan di titik tersebut.
   */
  useEffect(() => {
    const map = mapRef.current;
    const vehicle = vehicleRef.current;
    if (!map || !vehicle || status !== 'ready' || !route || route.length < 2) return;

    if (completed) {
      if (plan.destination) {
        vehicle.setLngLat([plan.destination.longitude, plan.destination.latitude]);
      }
      applyVehicleMotionState(vehicle.getElement(), false);
      return;
    }

    if (!courierPosition) return;

    const projection = projectOntoRoute(route, courierPosition);
    if (!projection) return;

    vehicle.setLngLat(projection.position);
    applyVehicleMotionState(vehicle.getElement(), true);
    // Kalau posisi GPS nanti hilang (mis. kurir menutup aplikasi), animasi
    // ilustratif MELANJUTKAN dari titik terakhir kurir — bukan melompat
    // kembali ke titik awal rute.
    tripStartRef.current = performance.now() - projection.progress * TRIP_DURATION_MS;
    const heading = headingAtProgress(route, projection.progress);
    const inner = vehicle.getElement().querySelector('[data-vehicle-inner]');
    if (inner instanceof HTMLElement) {
      inner.style.transform = `rotate(${heading}deg)`;
    }
  }, [courierPosition, route, status, completed, plan]);

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
   *
   * ARAH: satu kali jalan dari titik awal ke tujuan, lalu BERHENTI di sana.
   * Versi sebelumnya memakai pola pulang-pergi (0→1→0) supaya tidak ada
   * lompatan saat putaran berulang; akibatnya motor terlihat MUNDUR di
   * tengah jalan — persis yang tidak boleh terjadi pada pelacakan
   * pengantaran. Sekali jalan tidak punya gerakan mundur sama sekali.
   */
  useEffect(() => {
    // Posisi kurir nyata menang: animasi ilustratif harus mati supaya
    // marker tidak bergerak mengabaikan posisi GPS.
    if (
      completed ||
      !animateRoute ||
      courierPosition != null ||
      status !== 'ready' ||
      prefersReducedMotion() ||
      !route ||
      route.length < 2
    ) {
      return;
    }

    // Waktu mulai disimpan di ref supaya effect yang terpasang ulang
    // MELANJUTKAN perjalanan, bukan mengulangnya dari titik awal.
    if (tripStartRef.current === null) tripStartRef.current = performance.now();

    const step = (now: number) => {
      const vehicle = vehicleRef.current;
      if (!vehicle) {
        // Marker belum terpasang: pembuatannya berjalan asinkron (impor
        // MapLibre), jadi frame pertama bisa datang lebih dulu. Tunggu di
        // frame berikutnya — kalau loop berhenti di sini, motor tidak akan
        // pernah jalan sampai ada dependency effect yang kebetulan berubah.
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
        // Sampai di tujuan: berhenti di sana. Tidak ada putaran kedua.
        applyVehicleMotionState(vehicle.getElement(), false);
        setTripFinished(true);
        frameRef.current = null;
        return;
      }

      frameRef.current = requestAnimationFrame(step);
    };

    const markerEl = vehicleRef.current?.getElement();
    if (markerEl) applyVehicleMotionState(markerEl, true);
    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [animateRoute, courierPosition, status, route, completed]);

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

      {/* Legenda motor: menjelaskan apakah motor yang terlihat adalah posisi
          kurir NYATA atau animasi ilustratif. Tanpa ini, pengguna bisa
          mengira motor hijau menunjukkan lokasi kurir padahal cuma ilustrasi. */}
      {status === 'ready' && (
        <p className="pointer-events-none absolute bottom-8 left-2 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2 py-1 text-[10px] font-semibold text-charcoal-700 shadow-sm">
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: ROUTE_COLOR }}
          />
          {VEHICLE_LEGEND[
            completed
              ? 'completed'
              : courierPosition
                ? 'live'
                : tripFinished
                  ? 'illustration-done'
                  : 'illustration'
          ]}
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
