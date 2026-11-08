export type DeviceLocationReason = 'denied' | 'unavailable';
export type DeviceLocationResult = {
    ok: true;
    latitude: number;
    longitude: number;
} | {
    ok: false;
    reason: DeviceLocationReason;
};
export interface DeviceGeolocationLike {
    getCurrentPosition: (success: (position: {
        coords?: {
            latitude?: unknown;
            longitude?: unknown;
        };
    }) => void, error?: (error: {
        code?: unknown;
    } | null) => void, options?: {
        enableHighAccuracy?: boolean;
        timeout?: number;
        maximumAge?: number;
    }) => void;
}
const PERMISSION_DENIED = 1;
function defaultGeolocation(): DeviceGeolocationLike | null {
    if (typeof globalThis === 'undefined')
        return null;
    const navigatorLike = globalThis.navigator as {
        geolocation?: DeviceGeolocationLike;
    } | undefined;
    return navigatorLike?.geolocation ?? null;
}
export function requestDeviceLocation(geolocation: DeviceGeolocationLike | null | undefined = defaultGeolocation()): Promise<DeviceLocationResult> {
    return new Promise((resolve) => {
        if (!geolocation || typeof geolocation.getCurrentPosition !== 'function') {
            resolve({ ok: false, reason: 'unavailable' });
            return;
        }
        let settled = false;
        const finish = (result: DeviceLocationResult) => {
            if (settled)
                return;
            settled = true;
            resolve(result);
        };
        try {
            geolocation.getCurrentPosition((position) => {
                const latitude = position?.coords?.latitude;
                const longitude = position?.coords?.longitude;
                if (typeof latitude !== 'number' ||
                    typeof longitude !== 'number' ||
                    !Number.isFinite(latitude) ||
                    !Number.isFinite(longitude) ||
                    latitude < -90 ||
                    latitude > 90 ||
                    longitude < -180 ||
                    longitude > 180) {
                    finish({ ok: false, reason: 'unavailable' });
                    return;
                }
                finish({ ok: true, latitude, longitude });
            }, (error) => {
                finish({
                    ok: false,
                    reason: error && typeof error === 'object' && error.code === PERMISSION_DENIED
                        ? 'denied'
                        : 'unavailable',
                });
            }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
        }
        catch {
            finish({ ok: false, reason: 'unavailable' });
        }
    });
}
