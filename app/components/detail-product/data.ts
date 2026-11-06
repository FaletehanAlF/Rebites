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
  /** NULL = jarak belum diketahui (jangan tampilkan angka palsu). */
  distanceKm: number | null;
  /** kapabilitas fulfillment dari products.is_delivery. */
  isDelivery: boolean;
  /** kapabilitas fulfillment dari products.is_pickup. */
  isPickup: boolean;
  /** berat per kemasan (products.weight_gram). NULL = belum diketahui. */
  weightGram: number | null;
  /** panjang kemasan cm (products.length_cm). NULL = belum diketahui. */
  lengthCm: number | null;
  /** lebar kemasan cm (products.width_cm). NULL = belum diketahui. */
  widthCm: number | null;
  /** tinggi kemasan cm (products.height_cm). NULL = belum diketahui. */
  heightCm: number | null;
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
