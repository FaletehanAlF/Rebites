'use client';

import { useMemo } from 'react';
import type {
  CheckoutSummary,
  FulfillmentMode,
  OrderDraft,
  PromoCode,
} from './types';

/** Pajak / biaya admin 12% dari (subtotal - diskon) - selaras dengan lib/server/pricing.ts */
export const ADMIN_FEE_RATE = 0.12;
/** @deprecated */
export const ADMIN_FEE_AMOUNT = 2000;

export const DELIVERY_FEE = 8000;

export const REBITES_COIN_RATE = 0.005;

export const COIN_VALUE = 1;

export const PICKUP_READY_ESTIMATE = '±20–30 menit';

interface OrderCalculationInput {
  draft: OrderDraft;
  quantity: number;
  fulfillment: FulfillmentMode;
  promo: PromoCode | null;

  useCoins?: boolean;

  coinBalance?: number;

  /**
   * 7C-2D: override ongkir untuk DISPLAY (mis. harga opsi Biteship terpilih).
   * Delivery memakai nilai ini bila diberikan; bila tidak diberikan, memakai
   * flat DELIVERY_FEE (behavior lama). Pickup selalu 0. Bukan source of truth
   * final order (server revalidasi).
   */
  deliveryFeeOverride?: number | null;
}

export function useOrderCalculation({
  draft,
  quantity,
  fulfillment,
  promo,
  useCoins = false,
  coinBalance = 0,
  deliveryFeeOverride = null,
}: OrderCalculationInput): CheckoutSummary {
  return useMemo(() => {
    const subtotal = draft.discountedPrice * quantity;
    const discount = promo?.isValid
      ? Math.round((subtotal * promo.percentOff) / 100)
      : 0;
    const taxable = Math.max(0, subtotal - discount);
    const serviceFee = Math.round(taxable * ADMIN_FEE_RATE);
    // 7C-2D: delivery memakai override bila diberikan (harga opsi terpilih);
    // tanpa override = flat lama. Pickup selalu 0.
    const deliveryFee =
      fulfillment === 'delivery' ? (deliveryFeeOverride ?? DELIVERY_FEE) : 0;
    const totalBeforeCoin = Math.max(
      0,
      subtotal - discount + serviceFee + deliveryFee,
    );

    const coinUsed = useCoins
      ? Math.min(Math.max(0, Math.floor(coinBalance)), totalBeforeCoin)
      : 0;
    const coinDiscount = coinUsed;
    const remainingCoin = Math.max(0, Math.floor(coinBalance) - coinUsed);
    const total = Math.max(0, totalBeforeCoin - coinDiscount);

    const coinEarned = Math.floor(subtotal * REBITES_COIN_RATE);
    const totalSavings =
      (draft.originalPrice - draft.discountedPrice) * quantity;
    const co2eSaved = draft.co2ePerUnitKg * quantity;

    return {
      subtotal,
      discount,
      serviceFee,
      deliveryFee,
      totalBeforeCoin,
      coinUsed,
      coinDiscount,
      remainingCoin,
      total,
      totalSavings,
      co2eSaved,
      coinEarned,
    };
  }, [draft, quantity, fulfillment, promo, useCoins, coinBalance, deliveryFeeOverride]);
}
