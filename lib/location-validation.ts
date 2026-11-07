export const POSTAL_CODE_RE = /^[0-9]{5}$/;
export function normalizePostalCode(input: unknown): string | null {
    if (typeof input !== 'string')
        return null;
    const trimmed = input.trim();
    if (!trimmed)
        return null;
    return trimmed;
}
export function isValidPostalCode(input: unknown): boolean {
    const normalized = normalizePostalCode(input);
    if (normalized === null)
        return false;
    return POSTAL_CODE_RE.test(normalized);
}
export function isValidOptionalPostalCode(input: unknown): boolean {
    if (input === null || input === undefined)
        return true;
    if (typeof input === 'string' && input.trim() === '')
        return true;
    return isValidPostalCode(input);
}
export function parseCoordinate(input: unknown): number | null {
    if (input === null || input === undefined)
        return null;
    if (typeof input === 'string' && input.trim() === '')
        return null;
    const num = typeof input === 'number' ? input : Number(input);
    if (!Number.isFinite(num))
        return null;
    return num;
}
export function isValidLatitude(input: unknown): boolean {
    if (input === null || input === undefined)
        return true;
    if (typeof input === 'string' && input.trim() === '')
        return true;
    const num = parseCoordinate(input);
    if (num === null)
        return false;
    return num >= -90 && num <= 90;
}
export function isValidLongitude(input: unknown): boolean {
    if (input === null || input === undefined)
        return true;
    if (typeof input === 'string' && input.trim() === '')
        return true;
    const num = parseCoordinate(input);
    if (num === null)
        return false;
    return num >= -180 && num <= 180;
}
export type CoordinatePairParseResult = {
    ok: true;
    latitude: number | null;
    longitude: number | null;
} | {
    ok: false;
    error: string;
};
function parseFormCoordinate(value: unknown): number | null {
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string')
        return null;
    const normalized = value.trim().replace(',', '.');
    if (normalized === '' || !/^-?\d+(\.\d+)?$/.test(normalized))
        return null;
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
}
export function parseCoordinatePairInput(latitudeInput: unknown, longitudeInput: unknown): CoordinatePairParseResult {
    const isEmpty = (value: unknown): boolean => value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '');
    const latEmpty = isEmpty(latitudeInput);
    const lngEmpty = isEmpty(longitudeInput);
    if (latEmpty && lngEmpty)
        return { ok: true, latitude: null, longitude: null };
    if (latEmpty || lngEmpty) {
        return {
            ok: false,
            error: 'Isi latitude dan longitude sekaligus, atau kosongkan keduanya.',
        };
    }
    const lat = parseFormCoordinate(latitudeInput);
    if (lat === null)
        return { ok: false, error: 'Latitude harus angka (cth. -6.20000).' };
    const lng = parseFormCoordinate(longitudeInput);
    if (lng === null)
        return { ok: false, error: 'Longitude harus angka (cth. 106.81667).' };
    if (lat < -90 || lat > 90)
        return { ok: false, error: 'Latitude harus antara -90 dan 90.' };
    if (lng < -180 || lng > 180)
        return { ok: false, error: 'Longitude harus antara -180 dan 180.' };
    return { ok: true, latitude: lat, longitude: lng };
}
export type CoordinatePairFieldResult = {
    ok: true;
    provided: false;
} | {
    ok: true;
    provided: true;
    latitude: number | null;
    longitude: number | null;
} | {
    ok: false;
    error: string;
};
function parseApiCoordinate(value: unknown): number | null | 'invalid' {
    if (value === null)
        return null;
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : 'invalid';
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '')
            return null;
        const num = Number(trimmed);
        return Number.isFinite(num) ? num : 'invalid';
    }
    return 'invalid';
}
export function validateCoordinatePairFields(latitude: unknown, longitude: unknown): CoordinatePairFieldResult {
    const latAbsent = latitude === undefined;
    const lngAbsent = longitude === undefined;
    if (latAbsent && lngAbsent)
        return { ok: true, provided: false };
    if (latAbsent !== lngAbsent) {
        return {
            ok: false,
            error: 'Isi latitude dan longitude sekaligus, atau kosongkan keduanya.',
        };
    }
    const lat = parseApiCoordinate(latitude);
    const lng = parseApiCoordinate(longitude);
    if (lat === 'invalid' || lng === 'invalid') {
        return { ok: false, error: 'latitude/longitude tidak valid (harus angka).' };
    }
    if (lat !== null && (lat < -90 || lat > 90)) {
        return { ok: false, error: 'latitude harus di antara -90 dan 90.' };
    }
    if (lng !== null && (lng < -180 || lng > 180)) {
        return { ok: false, error: 'longitude harus di antara -180 dan 180.' };
    }
    if ((lat === null) !== (lng === null)) {
        return {
            ok: false,
            error: 'Isi latitude dan longitude sekaligus, atau kosongkan keduanya.',
        };
    }
    return { ok: true, provided: true, latitude: lat, longitude: lng };
}
export function parseDistanceKm(input: unknown): number | null {
    if (input === null || input === undefined)
        return null;
    const num = typeof input === 'number' ? input : Number(input);
    if (!Number.isFinite(num) || num < 0)
        return null;
    return num;
}
export interface RateRelevantAddressFields {
    postalCode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
}
export function buildAddressRateSignature(address: RateRelevantAddressFields | null | undefined): string {
    if (!address)
        return '';
    const postal = typeof address.postalCode === 'string' ? address.postalCode.trim() : '';
    const lat = typeof address.latitude === 'number' && Number.isFinite(address.latitude)
        ? String(address.latitude)
        : '';
    const lng = typeof address.longitude === 'number' && Number.isFinite(address.longitude)
        ? String(address.longitude)
        : '';
    return `${postal}|${lat}|${lng}`;
}
export interface SnapshotSource {
    id?: string | null;
    addressId?: string | null;
    label?: unknown;
    receiverName?: unknown;
    phone?: unknown;
    province?: unknown;
    city?: unknown;
    district?: unknown;
    fullAddress?: unknown;
    note?: unknown;
    postalCode?: unknown;
    postal_code?: unknown;
    latitude?: unknown;
    longitude?: unknown;
}
export interface BuiltAddressSnapshot {
    addressId: string | null;
    label: string;
    receiverName: string;
    phone: string;
    province: string;
    city: string;
    district: string;
    fullAddress: string;
    note?: string | null;
    postalCode: string | null;
    latitude: number | null;
    longitude: number | null;
}
export function buildAddressSnapshot(source: SnapshotSource): BuiltAddressSnapshot {
    const str = (v: unknown): string => typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v);
    const postalRaw = source.postalCode ?? source.postal_code ?? null;
    const postalTrimmed = typeof postalRaw === 'string' ? postalRaw.trim() : postalRaw;
    const lat = parseCoordinate(source.latitude);
    const lng = parseCoordinate(source.longitude);
    const noteRaw = source.note;
    return {
        addressId: typeof source.addressId === 'string'
            ? source.addressId
            : typeof source.id === 'string'
                ? source.id
                : null,
        label: str(source.label),
        receiverName: str(source.receiverName),
        phone: str(source.phone),
        province: str(source.province),
        city: str(source.city),
        district: str(source.district),
        fullAddress: str(source.fullAddress),
        note: typeof noteRaw === 'string'
            ? noteRaw || null
            : noteRaw === null || noteRaw === undefined
                ? null
                : String(noteRaw),
        postalCode: typeof postalTrimmed === 'string' && postalTrimmed !== '' ? postalTrimmed : null,
        latitude: lat,
        longitude: lng,
    };
}
export function sanitizeAddressSnapshot(input: unknown): {
    snapshot?: BuiltAddressSnapshot;
    error?: string;
} {
    if (!input || typeof input !== 'object') {
        return { error: 'Alamat pengiriman wajib untuk delivery.' };
    }
    const src = input as SnapshotSource;
    const snapshot = buildAddressSnapshot(src);
    if (!snapshot.receiverName.trim() || !snapshot.fullAddress.trim() || !snapshot.district.trim()) {
        return { error: 'Alamat pengiriman tidak lengkap (nama, alamat, kecamatan wajib).' };
    }
    if (snapshot.postalCode !== null && !POSTAL_CODE_RE.test(snapshot.postalCode)) {
        return { error: 'Kode pos pada alamat tidak valid (harus 5 digit angka).' };
    }
    if (snapshot.latitude !== null && (snapshot.latitude < -90 || snapshot.latitude > 90)) {
        return { error: 'latitude pada alamat tidak valid (-90..90).' };
    }
    if (snapshot.longitude !== null && (snapshot.longitude < -180 || snapshot.longitude > 180)) {
        return { error: 'longitude pada alamat tidak valid (-180..180).' };
    }
    return { snapshot };
}
