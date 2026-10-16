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
};
