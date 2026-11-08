const BITESHIP_API_BASE = 'https://api.biteship.com';
const RATES_PATH = '/v1/rates/couriers';
const REQUEST_TIMEOUT_MS = 10000;
export { BITESHIP_API_BASE, REQUEST_TIMEOUT_MS };
export function getBiteshipApiKey(): string {
    const raw = process.env.BITESHIP_API_KEY?.trim();
    if (!raw)
        throw new Error('BITESHIP_API_KEY belum di-set di environment server.');
    return raw;
}
export function getConfiguredCouriers(): string[] {
    const raw = process.env.BITESHIP_COURIERS?.trim() ?? '';
    if (!raw)
        return [];
    return raw
        .split(',')
        .map((c) => c.trim().toLowerCase())
        .filter((c) => c.length > 0);
}
export interface BiteshipRateItem {
    name: string;
    description?: string;
    category?: string;
    value: number;
    quantity: number;
    weight: number;
    length?: number;
    width?: number;
    height?: number;
}
export interface BiteshipRatesPayload {
    origin_postal_code: number;
    destination_postal_code: number;
    couriers: string;
    items: BiteshipRateItem[];
    origin_latitude?: number;
    origin_longitude?: number;
    destination_latitude?: number;
    destination_longitude?: number;
}
export interface BiteshipOptionalCoordinates {
    latitude?: unknown;
    longitude?: unknown;
}
function parseCoordinateValue(value: unknown): number | null {
    if (value === null || value === undefined)
        return null;
    if (typeof value === 'string' && value.trim() === '')
        return null;
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num))
        return null;
    return num;
}
function toPositiveIntOrNull(value: unknown): number | null {
    if (value == null)
        return null;
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num) || num <= 0)
        return null;
    const int = Math.floor(num);
    return int >= 1 ? int : null;
}
function normalizeCoordinatePair(pair: BiteshipOptionalCoordinates | null | undefined): {
    latitude: number;
    longitude: number;
} | null {
    if (!pair)
        return null;
    const latitude = parseCoordinateValue(pair.latitude);
    const longitude = parseCoordinateValue(pair.longitude);
    if (latitude === null || longitude === null)
        return null;
    if (latitude < -90 || latitude > 90)
        return null;
    if (longitude < -180 || longitude > 180)
        return null;
    return { latitude, longitude };
}
export function buildBiteshipRateItem(input: {
    name: string;
    unitValue: number;
    quantity: number;
    weightGram: number;
    lengthCm?: unknown;
    widthCm?: unknown;
    heightCm?: unknown;
}): BiteshipRateItem {
    const item: BiteshipRateItem = {
        name: input.name,
        category: 'food_and_drink',
        value: Math.round(input.unitValue),
        quantity: input.quantity,
        weight: input.weightGram,
    };
    const length = toPositiveIntOrNull(input.lengthCm);
    const width = toPositiveIntOrNull(input.widthCm);
    const height = toPositiveIntOrNull(input.heightCm);
    if (length != null)
        item.length = length;
    if (width != null)
        item.width = width;
    if (height != null)
        item.height = height;
    return item;
}
export function buildBiteshipRatesPayload(input: {
    originPostalCode: number;
    destinationPostalCode: number;
    couriers: string[];
    items: BiteshipRateItem[];
    originCoordinates?: BiteshipOptionalCoordinates | null;
    destinationCoordinates?: BiteshipOptionalCoordinates | null;
}): BiteshipRatesPayload {
    const payload: BiteshipRatesPayload = {
        origin_postal_code: input.originPostalCode,
        destination_postal_code: input.destinationPostalCode,
        couriers: input.couriers.join(','),
        items: input.items,
    };
    const origin = normalizeCoordinatePair(input.originCoordinates);
    if (origin) {
        payload.origin_latitude = origin.latitude;
        payload.origin_longitude = origin.longitude;
    }
    const destination = normalizeCoordinatePair(input.destinationCoordinates);
    if (destination) {
        payload.destination_latitude = destination.latitude;
        payload.destination_longitude = destination.longitude;
    }
    return payload;
}
export type BiteshipRatesErrorCode = 'provider_balance' | 'provider_quota';
export interface BiteshipRatesErrorInfo {
    code: BiteshipRatesErrorCode;
    message: string;
}
export function classifyBiteshipRatesError(rawMessage: string): BiteshipRatesErrorInfo | null {
    const message = typeof rawMessage === 'string' ? rawMessage : '';
    if (/no sufficient balance|insufficient balance|not enough balance|top\s*up your balance|saldo/i.test(message)) {
        return {
            code: 'provider_balance',
            message: 'Ongkir belum dapat dihitung karena saldo akun pengiriman (Biteship) tidak mencukupi. Hubungi admin agar saldo diisi, lalu coba lagi.',
        };
    }
    if (/rate limit|too many requests|quota (exceeded|is exceeded)|exceeded the quota|kuota/i.test(message)) {
        return {
            code: 'provider_quota',
            message: 'Layanan ongkir sedang dibatasi oleh penyedia (kuota/rate limit). Coba lagi beberapa saat lagi.',
        };
    }
    return null;
}
export interface BiteshipPricingEntry {
    company?: string;
    courier_name?: string;
    courier_code: string;
    courier_service_name?: string;
    courier_service_code: string;
    description?: string;
    duration?: string;
    service_type?: string;
    price: number;
    currency?: string;
}
interface BiteshipRatesResponse {
    success?: boolean;
    pricing?: BiteshipPricingEntry[];
    message?: string;
    code?: number | string;
}
function extractErrorMessage(json: unknown, fallback: string): string {
    const obj = json as {
        message?: unknown;
        error?: unknown;
        code?: unknown;
    } | null;
    if (obj && typeof obj.message === 'string' && obj.message)
        return obj.message;
    if (obj && typeof obj.error === 'string' && obj.error)
        return obj.error;
    return fallback;
}
export async function getBiteshipRates(payload: BiteshipRatesPayload): Promise<BiteshipPricingEntry[]> {
    const apiKey = getBiteshipApiKey();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let res: Response;
    try {
        res = await fetch(`${BITESHIP_API_BASE}${RATES_PATH}`, {
            method: 'POST',
            headers: {
                authorization: apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
    }
    catch (e) {
        if ((e as Error).name === 'AbortError') {
            throw new Error('Biteship timeout (10s) - coba lagi');
        }
        throw e;
    }
    finally {
        clearTimeout(timeout);
    }
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
        const msg = extractErrorMessage(json, `Biteship error ${res.status}`);
        console.error('[biteship] rates failed', { status: res.status, message: msg });
        throw new Error(msg);
    }
    const pricing = (json as BiteshipRatesResponse)?.pricing;
    if (!Array.isArray(pricing)) {
        console.error('[biteship] rates respons tanpa pricing');
        throw new Error('Respons Biteship tidak valid (tanpa pricing).');
    }
    console.log('[biteship] rates ok', { options: pricing.length });
    return pricing as BiteshipPricingEntry[];
}
