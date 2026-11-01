import type { BiteshipRatesPayload } from '@/lib/server/biteship';
import type { ShippingRateOption } from '@/lib/types';

/**
 * Cache sementara hasil tarif Biteship (per-instance, in-memory).
 *
 * Server-only. Tanpa dependency, tanpa database/migration.
 *
 * KETERBATASAN YANG DIAKUI:
 * - Cache ini per proses Node (bukan rate limit global): tiap instance
 *   punya salinan sendiri dan cold start mengosongkannya. Arah gagal aman:
 *   miss hanya berarti satu panggilan upstream tambahan, tidak pernah data
 *   salah — selama cache key mencakup SELURUH input penentu tarif.
 * - Hanya respons SUKSES yang disimpan. Error/timeout upstream tidak pernah
 *   di-cache dan tidak pernah dikembalikan sebagai tarif sukses.
 * - Ini BUKAN rate limit: tidak ada permintaan sah yang ditolak.
 */

/** TTL awal cache tarif (60 detik sesuai persyaratan tahap ini). */
export const RATES_CACHE_TTL_MS = 60_000;

/** Batas jumlah entri agar memori tidak tumbuh tanpa batas. */
const MAX_ENTRIES = 500;

interface CacheEntry {
  options: ShippingRateOption[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function prune(now: number): void {
  if (cache.size >= MAX_ENTRIES) {
    cache.clear();
    return;
  }
  const expired: string[] = [];
  cache.forEach((entry, key) => {
    if (entry.expiresAt <= now) expired.push(key);
  });
  expired.forEach((key) => cache.delete(key));
}

function normInt(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Math.round(num);
}

/** Koordinat opsional: angka finite -> nilai, selain itu null (ikut masuk key). */
function normCoord(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function normStr(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '');
}

/**
 * Bangun cache key dari payload Biteship yang dinormalisasi.
 * Semua input penentu tarif masuk ke key: postal asal & tujuan, koordinat
 * asal & tujuan (bila ada — 7C-4), daftar kurir (diurutkan + lowercase agar
 * urutan env tidak memecah cache), serta per item: nama, kategori, nilai,
 * kuantitas, berat, dan dimensi (length/width/height, default 0 bila tidak
 * dipakai).
 */
export function buildRatesCacheKey(payload: BiteshipRatesPayload): string {
  const couriers = normStr(payload.couriers)
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c.length > 0)
    .sort();
  const items = (payload.items ?? []).map((item) => ({
    category: normStr(item.category).toLowerCase(),
    height: item.height == null ? 0 : normInt(item.height),
    length: item.length == null ? 0 : normInt(item.length),
    name: normStr(item.name),
    quantity: normInt(item.quantity),
    value: normInt(item.value),
    weight: normInt(item.weight),
    width: item.width == null ? 0 : normInt(item.width),
  }));
  return JSON.stringify({
    couriers,
    dst: normInt(payload.destination_postal_code),
    dstLat: normCoord(payload.destination_latitude),
    dstLng: normCoord(payload.destination_longitude),
    items,
    org: normInt(payload.origin_postal_code),
    orgLat: normCoord(payload.origin_latitude),
    orgLng: normCoord(payload.origin_longitude),
  });
}

/** Ambil opsi tarif dari cache; null bila miss/kedaluwarsa. */
export function getCachedRates(key: string): ShippingRateOption[] | null {
  const now = Date.now();
  prune(now);
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= now) {
    if (entry) cache.delete(key);
    return null;
  }
  return entry.options.map((o) => ({ ...o }));
}

/** Simpan opsi tarif sukses ke cache (salinan agar aman dari mutasi). */
export function setCachedRates(key: string, options: ShippingRateOption[]): void {
  prune(Date.now());
  cache.set(key, {
    options: options.map((o) => ({ ...o })),
    expiresAt: Date.now() + RATES_CACHE_TTL_MS,
  });
}
