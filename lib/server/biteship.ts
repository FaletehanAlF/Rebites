/**
 * 7C-1: Biteship server helper (server-only, pola lib/server/xendit.ts).
 * - API key hanya dari process.env (tanpa prefix NEXT_PUBLIC_).
 * - fetch + AbortController timeout 10 detik.
 * - API key tidak pernah di-log / dikembalikan ke client.
 * - Tahap ini hanya rates (sandbox); tanpa shipment/order/tracking.
 */

const BITESHIP_API_BASE = 'https://api.biteship.com';
const RATES_PATH = '/v1/rates/couriers';
const REQUEST_TIMEOUT_MS = 10_000;

/** 7C-3C-2: diekspor untuk shipment service (nilai sama, tanpa ubah behavior rates). */
export { BITESHIP_API_BASE, REQUEST_TIMEOUT_MS };

export function getBiteshipApiKey(): string {
  const raw = process.env.BITESHIP_API_KEY?.trim();
  if (!raw) throw new Error('BITESHIP_API_KEY belum di-set di environment server.');
  return raw;
}

/** Daftar courier dari BITESHIP_COURIERS (koma, tanpa spasi wajib). Kosong = belum dikonfigurasi. */
export function getConfiguredCouriers(): string[] {
  const raw = process.env.BITESHIP_COURIERS?.trim() ?? '';
  if (!raw) return [];
  return raw
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0);
}

export interface BiteshipRateItem {
  name: string;
  description?: string;
  /** Kategori Biteship, mis. 'food_and_drink' untuk makanan (penting untuk instant). */
  category?: string;
  /** Nilai barang per unit (IDR). */
  value: number;
  quantity: number;
  /** Berat per unit (gram). */
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
}

/** Subset field pricing Biteship yang dipakai normalisasi route. */
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
  const obj = json as { message?: unknown; error?: unknown; code?: unknown } | null;
  if (obj && typeof obj.message === 'string' && obj.message) return obj.message;
  if (obj && typeof obj.error === 'string' && obj.error) return obj.error;
  return fallback;
}

export async function getBiteshipRates(
  payload: BiteshipRatesPayload
): Promise<BiteshipPricingEntry[]> {
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
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new Error('Biteship timeout (10s) - coba lagi');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  const json: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = extractErrorMessage(json, `Biteship error ${res.status}`);
    // Jangan log API key: hanya status + pesan + kode.
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
