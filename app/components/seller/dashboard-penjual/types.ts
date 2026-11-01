import type { LucideIcon } from 'lucide-react';

export interface SalesActivityPoint {
  day: string;
  terjual: number;
  tersisa: number;
}

export interface VendorStat {
  label: string;
  value: number;
  changePercent: number;
  changeDirection: 'up' | 'down';
}

export interface VendorInfo {
  storeName: string;
  ownerName: string;
  partnerTier: string;
  storeIdMasked: string;
  partnerSince: string;
}

export type OrderStatus = 'selesai' | 'menunggu-diambil' | 'dibatalkan';

export interface IncomingOrder {
  id: string;
  customerName: string;
  customerAvatar: string;
  productLabel: string;
  date: string;
  amount: number;
  status: OrderStatus;
}

export interface FavoriteCategory {
  category: string;
  percent: number;
}

export interface AchievementBadge {
  id: string;
  icon: LucideIcon;
  name: string;
  current: number;
  target: number;
  unit: string;
  unlocked: boolean;
  group: 'terkumpul' | 'sedang-diusahakan';
}

export interface MonthCategoryData {
  label: string;
  total: number;
  categories: FavoriteCategory[];
}

export interface PartnerScorePeriod {
  label: string;
  score: number;
  deltaPercent: number;
}
