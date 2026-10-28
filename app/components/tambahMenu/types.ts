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
  photo: string;
  // kapabilitas fulfillment. Minimal satu harus true.
  isDelivery: boolean;
  isPickup: boolean;
  // data package opsional (products.weight_gram/length_cm/width_cm/height_cm).
  // NULL = belum diketahui (produk legacy / seller belum mengisi). Tanpa default palsu.
  weightGram: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
}

/** Hasil parse input berat/dimensi opsional: ok + nilai (null = kosong), atau gagal. */
export type ShippingNumberParse =
  | { ok: true; value: number | null }
  | { ok: false };

/**
 * parse input teks berat/dimensi dari form seller.
 * - string kosong -> { ok: true, value: null } (legacy aman, tanpa angka palsu)
 * - angka positif -> { ok: true, value: int >= 1 } (DB integer)
 * - pemisah ribuan '1.000' / '1,000' -> dibaca 1000 (bukan 1)
 * - desimal '500,5' -> dibulatkan ke bawah (perilaku lama dipertahankan)
 * - 0 / negatif / bukan angka / di luar batas integer DB -> { ok: false }
 */
export function parseShippingNumber(raw: string): ShippingNumberParse {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };

  // Normalisasi yang aman sebelum Number(): digit murni, pemisah ribuan
  // '.' / ',' (grup 3 digit), atau satu pemisah desimal. Format lain
  // (huruf, notasi ilmiah, spasi di tengah) ditolak, bukan ditebak.
  let normalized: string;
  if (/^\d+$/.test(trimmed)) {
    normalized = trimmed;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(trimmed)) {
    normalized = trimmed.replace(/\./g, '');
  } else if (/^\d{1,3}(,\d{3})+$/.test(trimmed)) {
    normalized = trimmed.replace(/,/g, '');
  } else if (/^\d+[.,]\d+$/.test(trimmed)) {
    normalized = trimmed.replace(',', '.');
  } else {
    return { ok: false };
  }

  const num = Number(normalized);
  if (!Number.isFinite(num) || num <= 0) return { ok: false };
  const int = Math.floor(num);
  // Batas kolom integer Postgres (int4) agar gagal di form, bukan di DB.
  if (int < 1 || int > 2147483647) return { ok: false };
  return { ok: true, value: int };
}

/** 8 kategori website - selaras dengan lib/categories.ts CATEGORIES */
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
  photo: '',
  // default keduanya tersedia (selaras DB DEFAULT true).
  isDelivery: true,
  isPickup: true,
  // package opsional, default kosong (NULL).
  weightGram: null,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
};
