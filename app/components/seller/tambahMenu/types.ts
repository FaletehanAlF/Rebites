export interface MenuFormState {
    name: string;
    category: string;
    description: string;
    normalPrice: number;
    surplusPrice: number;
    stock: number;
    startTime: string;
    endTime: string;
    isSurplusToday: boolean;
    scheduledStart?: string | null;
    scheduledEnd?: string | null;
    photo: string;
    isDelivery: boolean;
    isPickup: boolean;
    weightGram: number | null;
    lengthCm: number | null;
    widthCm: number | null;
    heightCm: number | null;
}
export type ShippingNumberParse = {
    ok: true;
    value: number | null;
} | {
    ok: false;
};
export function parseShippingNumber(raw: string): ShippingNumberParse {
    const trimmed = raw.trim();
    if (!trimmed)
        return { ok: true, value: null };
    let normalized: string;
    if (/^\d+$/.test(trimmed)) {
        normalized = trimmed;
    }
    else if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) {
        normalized = trimmed.replace(/\./g, '');
    }
    else if (/^\d{1,3}(,\d{3})+$/.test(trimmed)) {
        normalized = trimmed.replace(/,/g, '');
    }
    else if (/^\d+[.,]\d+$/.test(trimmed)) {
        normalized = trimmed.replace(',', '.');
    }
    else {
        return { ok: false };
    }
    const num = Number(normalized);
    if (!Number.isFinite(num) || num <= 0)
        return { ok: false };
    const int = Math.floor(num);
    if (int < 1 || int > 2147483647)
        return { ok: false };
    return { ok: true, value: int };
}
export const MENU_CATEGORIES = [
    'Makanan Berat',
    'Jajanan',
    'Japanese',
    'Roti & Kue',
    'Makanan Cepat Saji',
    'Dessert',
    'Buah & Sayur',
    'Minuman',
] as const;
export const DEFAULT_MENU_FORM: MenuFormState = {
    name: '',
    category: 'Makanan Berat',
    description: '',
    normalPrice: 30000,
    surplusPrice: 21000,
    stock: 4,
    startTime: '16:00',
    endTime: '19:00',
    isSurplusToday: true,
    scheduledStart: null,
    scheduledEnd: null,
    photo: '',
    isDelivery: true,
    isPickup: true,
    weightGram: null,
    lengthCm: null,
    widthCm: null,
    heightCm: null,
};
