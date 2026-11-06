
/** Pajak / biaya admin 12% dari (subtotal - diskon). DB service_fee tetap integer (dibulatkan). */
export const ADMIN_FEE_RATE = 0.12;
export const DELIVERY_FEE = 8000;
export const REBITES_COIN_RATE = 0.005;
export const COIN_VALUE = 1;

export interface PricingInput {
  unitPrice: number;
  quantity: number;
  fulfillment: 'delivery' | 'pickup';
  promoPercentOff?: number; 
  useCoins: boolean;
  coinBalance: number;
  /**
   * ongkir ter-validasi server (mis. rate Biteship) untuk delivery.
   * Bila diisi, dipakai sebagai ganti DELIVERY_FEE. Pickup tetap 0.
   */
  deliveryFeeOverride?: number;
}

export interface PricingResult {
  subtotal: number;
  discount: number;
  serviceFee: number;
  deliveryFee: number;
  totalBeforeCoin: number;
  coinUsed: number;
  total: number;
  coinEarned: number;
}

export function calculatePricing(input: PricingInput): PricingResult {
  const subtotal = input.unitPrice * input.quantity;
  const discount = input.promoPercentOff
    ? Math.round((subtotal * input.promoPercentOff) / 100)
    : 0;
  // 12% dari nilai kena pajak (subtotal setelah diskon). Dibulatkan ke integer agar aman untuk kolom service_fee INT.
  const taxable = Math.max(0, subtotal - discount);
  const serviceFee = Math.round(taxable * ADMIN_FEE_RATE);
  // delivery memakai override ter-validasi bila ada; fallback flat
  // DELIVERY_FEE hanya bila override tidak diberikan. Pickup selalu 0.
  const deliveryFee =
    input.fulfillment === 'delivery' ? (input.deliveryFeeOverride ?? DELIVERY_FEE) : 0;
  const totalBeforeCoin = Math.max(
    0,
    subtotal - discount + serviceFee + deliveryFee
  );

  const coinUsed = input.useCoins
    ? Math.min(Math.max(0, Math.floor(input.coinBalance)), totalBeforeCoin)
    : 0;

  const total = Math.max(0, totalBeforeCoin - coinUsed);
  const coinEarned = Math.floor(subtotal * REBITES_COIN_RATE);

  return {
    subtotal,
    discount,
    serviceFee,
    deliveryFee,
    totalBeforeCoin,
    coinUsed,
    total,
    coinEarned,
  };
}
