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
  // 7B-2B: kapabilitas fulfillment. Minimal satu harus true.
  isDelivery: boolean;
  isPickup: boolean;
  // 7B-2D-1: data package opsional (products.weight_gram/length_cm/width_cm/height_cm).
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
 * 7B-2D-1: parse input teks berat/dimensi dari form seller.
 * - string kosong -> { ok: true, value: null } (legacy aman, tanpa angka palsu)
 * - angka positif -> { ok: true, value: int >= 1 } (DB integer)
 * - 0 / negatif / bukan angka -> { ok: false }
 */
export function parseShippingNumber(raw: string): ShippingNumberParse {
  const trimmed = raw.trim().replace(',', '.');
  if (!trimmed) return { ok: true, value: null };
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num <= 0) return { ok: false };
  const int = Math.floor(num);
  if (int < 1) return { ok: false };
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

export interface FoodPreset {
  id: string;
  src: string;
  label: string;
}

export const FOOD_PRESETS: FoodPreset[] = [
  { id: 'ikansayur', src: '/foods/ikansayur.jpg', label: 'Ikan & sayur' },
  { id: 'supkrimlabu', src: '/foods/supkrimlabu.jpg', label: 'Sup krim labu' },
  { id: 'saladkebun', src: '/foods/saladkebun.jpg', label: 'Salad kebun' },
  { id: 'kopisusu', src: '/foods/kopisusu.jpg', label: 'Es kopi susu' },
  { id: 'boxdonat', src: '/foods/boxdonat.jpg', label: 'Donat kampung' },
];

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
  // 7B-2B: default keduanya tersedia (selaras DB DEFAULT true).
  isDelivery: true,
  isPickup: true,
  // 7B-2D-1: package opsional, default kosong (NULL).
  weightGram: null,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
};
