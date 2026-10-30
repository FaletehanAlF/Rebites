export type BillingCycle = 'monthly' | 'yearly';

export interface SubscriptionPlan {
  slug: 'basic' | 'standar' | 'premium';
  name: string;
  tagline: string;
  monthly: number;
  yearly: number;
  features: string[];
  cta: string;
  popular: boolean;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    slug: 'basic',
    name: 'Basic',
    tagline: 'Mulai berjualan, 3 produk, riwayat 30 hari.',
    monthly: 24_999,
    yearly: 249_990,
    features: [
      'Maksimal 3 produk',
      'Riwayat penjualan 30 hari',
      'Dashboard penjualan',
    ],
    cta: 'Pilih Basic',
    popular: false,
  },
  {
    slug: 'standar',
    name: 'Standar',
    tagline: 'Untuk UMKM yang mulai aktif berjualan di ReBites.',
    monthly: 49_000,
    yearly: 490_000,
    features: [
      'Maksimal 5 produk',
      'Riwayat penjualan tanpa batas',
      'Prioritas di marketplace',
      'Laporan penjualan detail',
      'Badge UMKM Terverifikasi',
    ],
    cta: 'Pilih Standar',
    popular: false,
  },
  {
    slug: 'premium',
    name: 'Max',
    tagline: 'Akses semua fitur, maksimal 15 produk.',
    monthly: 99_000,
    yearly: 990_000,
    features: [
      'Maksimal 15 produk',
      'Akses semua fitur',
      'Promosi unggulan',
      'Analitik permintaan',
      'Dukungan prioritas',
    ],
    cta: 'Pilih Max',
    popular: true,
  },
];

export function getSubscriptionPlan(
  slug: string | null | undefined
): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((plan) => plan.slug === slug);
}

export function getPlanPrice(
  plan: SubscriptionPlan,
  billing: BillingCycle
): number {
  return billing === 'yearly' ? plan.yearly : plan.monthly;
}

/**
 * Kelipatan harga tahunan terhadap harga bulanan (mis. 10, 12, 6).
 *
 * null bila salah satu harga tidak tersedia atau tidak masuk akal (<= 0),
 * sehingga UI tidak menampilkan klaim penghematan dari angka yang tidak ada.
 * Nilai dibulatkan ke bilangan bulat agar tidak muncul "12,0×".
 */
export function getYearlyMultiplier(plan: SubscriptionPlan): number | null {
  if (!Number.isFinite(plan.monthly) || !Number.isFinite(plan.yearly)) return null;
  if (plan.monthly <= 0 || plan.yearly <= 0) return null;
  const ratio = plan.yearly / plan.monthly;
  if (!Number.isFinite(ratio) || ratio <= 0) return null;
  return Math.round(ratio);
}

/** Harga rata-rata per bulan bila membayar tahunan (dibulatkan rupiah). */
export function getYearlyPerMonth(plan: SubscriptionPlan): number | null {
  if (!Number.isFinite(plan.yearly) || plan.yearly <= 0) return null;
  return Math.round(plan.yearly / 12);
}

export function computePeriodEnd(billing: BillingCycle, from = Date.now()): Date {
  const end = new Date(from);
  if (billing === 'yearly') end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  return end;
}
