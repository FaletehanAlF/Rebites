import type { LucideIcon } from "lucide-react";
export type FoodCategory = "bakery" | "restoran" | "minuman" | "umkm" | "Makanan Berat" | "Roti & Kue" | "Buah & Sayur" | "Jajanan" | "Japanese" | "Makanan Cepat Saji" | "Dessert" | "Minuman" | "Makanan & Minuman";
export type FilterKey = "terdekat" | "diskon-terbesar" | "segera-habis" | "umkm" | "bakery" | "restoran" | "minuman";
export interface FoodItem {
    id: string;
    name: string;
    vendorName: string;
    image: string;
    category: FoodCategory;
    rating: number | null;
    distanceKm: number | null;
    availableFrom: string;
    availableTo: string;
    stockLabel: string;
    originalPrice: number;
    discountedPrice: number;
    discountPercent: number;
    expiresAt?: string;
    rawId?: string;
    slug?: string;
}
export interface Vendor {
    id: string;
    name: string;
    image: string;
    isRescuePartner: boolean;
    isVerified?: boolean;
    rating: number;
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
    postalCode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
}
export interface AddressSnapshot extends Omit<DeliveryAddress, "id"> {
    addressId?: string | null;
}
export interface ShippingOriginSnapshot {
    businessName: string;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    phone: string | null;
    latitude: number | null;
    longitude: number | null;
    slug: string;
    estimated?: boolean;
}
export interface ShippingPackageSnapshot {
    quantity: number;
    weightGram: number | null;
    totalWeightGram: number | null;
    lengthCm: number | null;
    widthCm: number | null;
    heightCm: number | null;
    weightEstimated?: boolean;
}
export interface ShippingSnapshot {
    origin: ShippingOriginSnapshot;
    package: ShippingPackageSnapshot;
}
export interface ShippingRateOption {
    courierCode: string;
    serviceCode: string;
    courierName: string;
    serviceName: string;
    price: number;
    distanceLabel: string;
    etaLabel: string;
    serviceType: string;
    originEstimated?: boolean;
    weightEstimated?: boolean;
}
export type OrderLifecycleStatus = "ongoing" | "completed";
export type OrderProgressStatus = "disiapkan" | "siap-diambil" | "diantar";
export interface GeoPoint {
    latitude: number;
    longitude: number;
}
export interface StoredOrder {
    orderId: string;
    dbId?: string;
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
    progressStatus?: OrderProgressStatus;
    estimatedMinutes?: number;
    estimatedCompletionAt?: string;
    completedAt?: string;
    distanceKm?: number | null;
    vendorAddress?: string;
    vendorOpenHours?: string;
    preparationMinutes?: number;
    co2eSavedKg?: number;
    deliveryDistanceKm?: number;
    estimatedDeliveryMinutes?: number;
    deliveryStartedAt?: string;
    estimatedArrivalAt?: string;
    shippingSnapshot?: ShippingSnapshot | null;
    courierCode?: string | null;
    courierServiceCode?: string | null;
    courierServiceName?: string | null;
    shippingRate?: number | null;
    biteshipOrderId?: string | null;
    biteshipTrackingId?: string | null;
    biteshipWaybillId?: string | null;
    shipmentStatus?: string | null;
    shipmentCreatedAt?: string | null;
    shipmentError?: string | null;
}
export interface OrderReview {
    orderId: string;
    userId: string;
    rating: number;
    comment: string;
    createdAt: string;
}
export type CoinTransactionType = "earned" | "spent" | "refund" | "adjustment";
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
    distanceKm?: number | null;
    isDelivery: boolean;
    isPickup: boolean;
    weightGram?: number | null;
    lengthCm?: number | null;
    widthCm?: number | null;
    heightCm?: number | null;
    pickupTime: {
        from: string;
        to: string;
    };
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
