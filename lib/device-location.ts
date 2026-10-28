/**
 * permintaan lokasi perangkat (navigator.geolocation) untuk mengisi
 * koordinat form secara aman — form alamat pembeli & pengaturan toko.
 *
 * Prinsip (selaras modul simulasi pengiriman):
 * - Hanya mengembalikan koordinat yang BENAR-BENAR diberikan perangkat;
 *   nilai tidak finite / di luar rentang sah dianggap tidak tersedia
 *   (tanpa mengarang nilai).
 * - Izin ditolak -> `denied`; perangkat tidak mendukung / error lain /
 *   tidak ada geolocation -> `unavailable`. UI wajib menyediakan fallback
 *   input manual untuk kedua alasan tersebut.
 * - Tanpa jaringan pihak ketiga: murni API browser (tidak ada fetch).
 *
 * Fungsi menerima geolocation secara opsional (dependency injection) agar
 * bisa diuji dengan objek palsu tanpa browser.
 */

export type DeviceLocationReason = 'denied' | 'unavailable';

export type DeviceLocationResult =
  | { ok: true; latitude: number; longitude: number }
  | { ok: false; reason: DeviceLocationReason };

/** Bentuk minimal Geolocation API yang dipakai (memudahkan pengujian). */
export interface DeviceGeolocationLike {
  getCurrentPosition: (
    success: (position: {
      coords?: { latitude?: unknown; longitude?: unknown };
    }) => void,
    error?: (error: { code?: unknown } | null) => void,
    options?: {
      enableHighAccuracy?: boolean;
      timeout?: number;
      maximumAge?: number;
    }
  ) => void;
}

/** GeolocationPositionError.PERMISSION_DENIED menurut spesifikasi W3C. */
const PERMISSION_DENIED = 1;

function defaultGeolocation(): DeviceGeolocationLike | null {
  if (typeof globalThis === 'undefined') return null;
  const navigatorLike = globalThis.navigator as
    | { geolocation?: DeviceGeolocationLike }
    | undefined;
  return navigatorLike?.geolocation ?? null;
}

export function requestDeviceLocation(
  geolocation: DeviceGeolocationLike | null | undefined = defaultGeolocation()
): Promise<DeviceLocationResult> {
  return new Promise((resolve) => {
    if (!geolocation || typeof geolocation.getCurrentPosition !== 'function') {
      resolve({ ok: false, reason: 'unavailable' });
      return;
    }

    let settled = false;
    const finish = (result: DeviceLocationResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      geolocation.getCurrentPosition(
        (position) => {
          const latitude = position?.coords?.latitude;
          const longitude = position?.coords?.longitude;
          if (
            typeof latitude !== 'number' ||
            typeof longitude !== 'number' ||
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
          ) {
            // Perangkat balas nilai aneh -> jangan dipakai, minta input manual.
            finish({ ok: false, reason: 'unavailable' });
            return;
          }
          finish({ ok: true, latitude, longitude });
        },
        (error) => {
          finish({
            ok: false,
            reason:
              error && typeof error === 'object' && error.code === PERMISSION_DENIED
                ? 'denied'
                : 'unavailable',
          });
        },
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
      );
    } catch {
      finish({ ok: false, reason: 'unavailable' });
    }
  });
}
