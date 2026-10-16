export interface VendorInfo {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  isRescuePartner: boolean;
}

export interface ProductDetail {
  id: string;
  slug: string;
  category: string;
  vendor: VendorInfo;
  title: string;
  images: string[];
  discountPercent: number;
  stockLabel: string;
  stockRemaining: number;
  rating: number;
  reviewCount: number;
  distanceKm: number;
  originalPrice: number;
  discountedPrice: number;
  description: string;
  pickupTime: { from: string; to: string };
  pickupLocation: string;
  consumeWindow: string;
  co2eSavedKg: number;
  packageContents: string[];
}

export interface Review {
  id: string;
  reviewerName: string;
  avatar: string;
  rating: number;
  comment: string;
  date: string;
}

export interface RelatedProduct {
  id: string;
  slug: string;
  vendorName: string;
  name: string;
  image: string;
  originalPrice: number;
  discountedPrice: number;
}

export const formatIDR = (value: number): string => value.toLocaleString('id-ID');
