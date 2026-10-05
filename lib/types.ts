import type { LucideIcon } from "lucide-react";

export type FoodCategory =
  | "bakery"
  | "restoran"
  | "minuman"
  | "umkm"
  | "Makanan Berat"
  | "Roti & Kue"
  | "Buah & Sayur"
  | "Jajanan"
  | "Japanese"
  | "Makanan Cepat Saji"
  | "Dessert"
  | "Minuman"
  | "Makanan & Minuman";

export type FilterKey =
  | "terdekat"
  | "diskon-terbesar"
  | "segera-habis"
  | "umkm"
  | "bakery"
  | "restoran"
  | "minuman";

export interface FoodItem {
  id: string;
  name: string;
  vendorName: string;
  image: string;
  category: FoodCategory;
  // Rating produk dari database (products.rating). Null berarti belum ada
  // rating tercatat — UI wajib menyembunyikan, bukan mengarang angka.
  rating: number | null;
  // Jarak dari database (distance_km). Null berarti tidak diketahui —
  // UI wajib menyembunyikan, bukan mengklaim angka.
  distanceKm: number | null;
  availableFrom: string;
  availableTo: string;
  stockLabel: string;
  originalPrice: number;
  discountedPrice: number;
  discountPercent: number;
  expiresAt?: string;
}

export interface Vendor {
  id: string;
  name: string;
  image: string;
  isRescuePartner: boolean;
  isVerified?: boolean;
  rating: number;
  // Jarak dari database (umkm_profiles.distance_km). Null berarti tidak
  // diketahui — UI wajib menyembunyikan, bukan mengklaim angka.
  distanceKm: number | null;
  category: string;
  itemCount: number;
  address: string;
  openHours: string;
  isOpen: boolean;
  description: string;
  
  tagline?: string;
  tier?: string;
  followers?: number;
  memberSince?: number;
  responseTime?: string;
  porsiTerselamatkan?: number;
  co2eSavedKg?: number;
}

export interface ImpactStat {
  id: string;
  icon: LucideIcon;
  value: number;
  suffix?: string;
  label: string;
}

export type UrgentSlot = "09-12" | "12-15" | "15-18" | "18-21";

export type FulfillmentMode = "pickup" | "delivery";

export type AddressLabel = "Rumah" | "Kos" | "Sekolah" | "Lainnya";

export interface DeliveryAddress {
  id: string;
  label: AddressLabel;
  receiverName: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  fullAddress: string;
  note?: string;
  /** 7B-1: kode pos 5 digit, NULL untuk alamat legacy. */
  postalCode?: string | null;
  /** 7B-1: NULL hingga ada map-picker/geocoding. Jangan isi palsu. */
  latitude?: number | null;
  /** 7B-1: NULL hingga ada map-picker/geocoding. Jangan isi palsu. */
  longitude?: number | null;
}

/**
 * 7B-1: snapshot alamat saat checkout. Diperluas additive, semua field baru
 * opsional agar order lama (tanpa postal/latlng/addressId) tetap terbaca.
 */
export interface AddressSnapshot extends Omit<DeliveryAddress, "id"> {
  addressId?: string | null;
}

/**
 * 7B-2D-5: snapshot origin seller saat checkout. Dibangun server-side dari
 * umkm_profiles (bukan dari client). Semua field nullable kecuali nama/slug
 * yang mengikuti behavior vendor existing. Imut setelah order dibuat.
 */
export interface ShippingOriginSnapshot {
  businessName: string;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  slug: string;
}

/**
 * 7B-2D-5: snapshot package saat checkout. Dibangun server-side dari
 * products (bukan dari client). weightGram = berat PER UNIT (tidak berubah
 * arti); totalWeightGram = weightGram x quantity (null bila unknown).
 */
export interface ShippingPackageSnapshot {
  quantity: number;
  weightGram: number | null;
  totalWeightGram: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
}

/**
 * 7B-2D-5: snapshot shipping imut pada orders.shipping_snapshot (jsonb,
 * nullable untuk order legacy). Destination TIDAK diduplikasi (tetap di
 * address_snapshot). Tanpa courier/service/tracking (tahap Biteship).
 */
export interface ShippingSnapshot {
  origin: ShippingOriginSnapshot;
  package: ShippingPackageSnapshot;
}

/**
 * 7C-1: satu opsi ongkir hasil normalisasi Biteship rates
 * (POST /api/shipping/rates). Harga final per opsi (IDR).
 */
export interface ShippingRateOption {
  courierCode: string;
  serviceCode: string;
  courierName: string;
  serviceName: string;
  price: number;
  duration: string;
  serviceType: string;
}

export type OrderLifecycleStatus = "ongoing" | "completed";

/** Status progres pesanan yang dikendalikan penjual di dashboard. */
export type OrderProgressStatus = "disiapkan" | "siap-diambil" | "diantar";

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface StoredOrder {
  orderId: string;

  userId?: string;
  productId: string;
  productName: string;
  vendorName: string;
  vendorSlug: string;
  image: string;
  quantity: number;
  fulfillment: FulfillmentMode;
  addressSnapshot: AddressSnapshot | null;
  paymentMethodId: string;
  subtotal: number;
  discount: number;
  serviceFee: number;
  deliveryFee: number;
  totalBeforeCoin?: number;
  coinUsed?: number;
  total: number;
  coinEarned: number;
  createdAt: string;

  unitPrice?: number;

  promoCode?: string | null;
  status?: OrderLifecycleStatus;

  orderStatus?: string;
  /** Di-set penjual dari dashboard; kosong = fallback estimasi timer (pesanan lama). */
  progressStatus?: OrderProgressStatus;

  estimatedMinutes?: number;

  estimatedCompletionAt?: string;
  completedAt?: string;

  /** 7B-1: NULL = belum diketahui (jangan tampilkan angka palsu). */
  distanceKm?: number | null;
  vendorAddress?: string;
  vendorOpenHours?: string;

  preparationMinutes?: number;

  co2eSavedKg?: number;

  deliveryDistanceKm?: number;
  estimatedDeliveryMinutes?: number;
  deliveryStartedAt?: string;
  estimatedArrivalAt?: string;

  /** 7B-2D-5: snapshot imut {origin, package} (orders.shipping_snapshot). NULL = order legacy. */
  shippingSnapshot?: ShippingSnapshot | null;

  /** 7C-1: pilihan kurir checkout (kolom orders, nullable untuk pickup/legacy). */
  courierCode?: string | null;
  /** 7C-1: pilihan service kurir (kolom orders, nullable untuk pickup/legacy). */
  courierServiceCode?: string | null;
  /** 7C-1: nama service kurir pilihan (kolom orders, nullable untuk pickup/legacy). */
  courierServiceName?: string | null;
  /** 7C-1: ongkir pilihan IDR (kolom orders, nullable untuk pickup/legacy). */
  shippingRate?: number | null;

  /** 7C-3C-1: ID order Biteship (kolom orders, NULL = shipment belum dibuat). */
  biteshipOrderId?: string | null;
  /** 7C-3C-1: tracking ID Biteship untuk GET /v1/trackings/:id (NULL = belum ada). */
  biteshipTrackingId?: string | null;
  /** 7C-3C-1: nomor AWB/waybill (NULL hingga tersedia). */
  biteshipWaybillId?: string | null;
  /** 7C-3C-1: status shipment Biteship terakhir (NULL = belum ada shipment). */
  shipmentStatus?: string | null;
  /** 7C-3C-1: waktu shipment berhasil dibuat (NULL = belum ada shipment). */
  shipmentCreatedAt?: string | null;
  /** 7C-3C-1: pesan error terakhir shipment (bedakan gagal vs belum dibuat). */
  shipmentError?: string | null;
}

export interface OrderReview {
  orderId: string;
  userId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export type CoinTransactionType = "earned" | "spent";

export interface CoinTransaction {
  id: string;
  orderId?: string;
  type: CoinTransactionType;
  amount: number;
  createdAt: string;
  description: string;
}

export interface OrderDraft {
  productId: string;
  productSlug: string;
  vendorName: string;
  vendorSlug: string;
  productName: string;
  image: string;
  originalPrice: number;
  discountedPrice: number;
  stockRemaining: number;
  /** 7B-1: NULL = belum diketahui. Bukan sumber kebenaran shipping. */
  distanceKm?: number | null;
  /** 7B-2B: kapabilitas fulfillment produk (sumber untuk gating UI checkout). */
  isDelivery: boolean;
  /** 7B-2B: kapabilitas fulfillment produk (sumber untuk gating UI checkout). */
  isPickup: boolean;
  /** 7B-2D-1: berat per kemasan dari products.weight_gram. NULL = belum diketahui. */
  weightGram?: number | null;
  /** 7B-2D-1: panjang kemasan dari products.length_cm. NULL = belum diketahui. */
  lengthCm?: number | null;
  /** 7B-2D-1: lebar kemasan dari products.width_cm. NULL = belum diketahui. */
  widthCm?: number | null;
  /** 7B-2D-1: tinggi kemasan dari products.height_cm. NULL = belum diketahui. */
  heightCm?: number | null;
  pickupTime: { from: string; to: string };
  pickupLocation: string;
  reservedUntil: string;
  co2ePerUnitKg: number;
}

export interface PaymentMethod {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
}

export interface PromoCode {
  code: string;
  percentOff: number;
  isValid: boolean;
}

export interface CheckoutSummary {
  subtotal: number;
  discount: number;
  serviceFee: number;
  deliveryFee: number;

  totalBeforeCoin: number;

  coinUsed: number;

  coinDiscount: number;

  remainingCoin: number;
  total: number;
  totalSavings: number;
  co2eSaved: number;
  coinEarned: number;
}

export interface UrgentItem extends FoodItem {
  expiresAt: string;
  slot: UrgentSlot;
}
