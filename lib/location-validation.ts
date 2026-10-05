/**
 * 7B-1 — Validasi dasar lokasi (buyer + seller origin).
 *
 * Prinsip:
 * - postal_code Indonesia: 5 digit. String kosong TIDAK valid
 *   (kosong = NULL, bukan kode pos).
 * - latitude: numeric -90..90. longitude: numeric -180..180.
 * - TIDAK ada geocoding otomatis, TIDAK mengarang koordinat.
 * - Semua field baru NULLABLE untuk backward compat data legacy.
 */

export const POSTAL_CODE_RE = /^[0-9]{5}$/;

export function normalizePostalCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed;
}

export function isValidPostalCode(input: unknown): boolean {
  const normalized = normalizePostalCode(input);
  if (normalized === null) return false;
  return POSTAL_CODE_RE.test(normalized);
}

/** Postal opsional: NULL (kosong/legacy) boleh, isi harus 5 digit. */
export function isValidOptionalPostalCode(input: unknown): boolean {
  if (input === null || input === undefined) return true;
  if (typeof input === 'string' && input.trim() === '') return true;
  return isValidPostalCode(input);
}

export function parseCoordinate(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'string' && input.trim() === '') return null;
  const num = typeof input === 'number' ? input : Number(input);
  if (!Number.isFinite(num)) return null;
  return num;
}

export function isValidLatitude(input: unknown): boolean {
  if (input === null || input === undefined) return true;
  if (typeof input === 'string' && input.trim() === '') return true;
  const num = parseCoordinate(input);
  if (num === null) return false;
  return num >= -90 && num <= 90;
}

export function isValidLongitude(input: unknown): boolean {
  if (input === null || input === undefined) return true;
  if (typeof input === 'string' && input.trim() === '') return true;
  const num = parseCoordinate(input);
  if (num === null) return false;
  return num >= -180 && num <= 180;
}

/** Distance: bedakan "belum diketahui" (NULL) vs angka nyata. */
export function parseDistanceKm(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  const num = typeof input === 'number' ? input : Number(input);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
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

/**
 * 7B-1: bangun snapshot dari alamat terpilih. Additive + backward compat:
 * field baru selalu ada (NULL jika tidak tersedia) agar order baru konsisten,
 * order lama tanpa field baru tetap terbaca (opsional di tipe).
 */
export function buildAddressSnapshot(source: SnapshotSource): BuiltAddressSnapshot {
  const str = (v: unknown): string =>
    typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v);
  const postalRaw = source.postalCode ?? source.postal_code ?? null;
  const postalTrimmed = typeof postalRaw === 'string' ? postalRaw.trim() : postalRaw;
  const lat = parseCoordinate(source.latitude);
  const lng = parseCoordinate(source.longitude);
  const noteRaw = source.note;
  return {
    addressId:
      typeof source.addressId === 'string'
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
    note:
      typeof noteRaw === 'string'
        ? noteRaw || null
        : noteRaw === null || noteRaw === undefined
          ? null
          : String(noteRaw),
    postalCode:
      typeof postalTrimmed === 'string' && postalTrimmed !== '' ? postalTrimmed : null,
    latitude: lat,
    longitude: lng,
  };
}

/**
 * 7B-1: sanitasi + validasi snapshot di server. Legacy NULL boleh;
 * isi non-kosong harus valid. Return { snapshot } atau { error }.
 */
export function sanitizeAddressSnapshot(
  input: unknown
): { snapshot?: BuiltAddressSnapshot; error?: string } {
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
