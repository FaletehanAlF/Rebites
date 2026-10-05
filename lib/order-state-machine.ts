'use client';

import { supabase } from './supabase';
import { getSellerUmkm } from './product-storage';
import { calculateTravelMinutes } from './delivery-estimate';

/** Pajak/biaya admin 12% - selaras dengan pricing.ts & useOrderCalculation.ts. DB service_fee tetap INT (rounded). */
export const ADMIN_FEE_RATE = 0.12;
/** @deprecated nilai lama 2000, disimpan untuk kompatibilitas order lama */
export const ADMIN_FEE_AMOUNT = 2000;

export type OrderStatusValue =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'preparing'
  | 'ready'
  | 'failed';

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['paid', 'cancelled', 'failed'],
  paid: ['processing', 'cancelled'],
  processing: ['ready_for_pickup', 'out_for_delivery', 'cancelled'],
  ready_for_pickup: ['completed'],
  out_for_delivery: ['completed'],
  preparing: ['completed', 'cancelled', 'ready'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  refunded: [],
  failed: [],
};

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getValidActions(
  orderStatus: string,
  fulfillmentMethod: string
): { action: string; label: string; targetStatus: string; description: string }[] {
  const actions: { action: string; label: string; targetStatus: string; description: string }[] = [];

  switch (orderStatus) {
    case 'paid':
      actions.push({
        action: 'start_processing',
        label: 'Mulai Siapkan Pesanan',
        targetStatus: 'processing',
        description: 'Pesanan akan masuk status sedang disiapkan',
      });
      break;

    case 'processing':
      if (fulfillmentMethod === 'pickup') {
        actions.push({
          action: 'mark_ready',
          label: 'Makanan Sudah Siap',
          targetStatus: 'ready_for_pickup',
          description: 'Pembeli akan diberi tahu bahwa pesanan siap diambil',
        });
      } else {
        actions.push({
          action: 'start_delivery',
          label: 'Antarkan Pesanan',
          targetStatus: 'out_for_delivery',
          description: 'Pesanan akan masuk status sedang diantar',
        });
      }
      break;

    default:
      break;
  }

  return actions;
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Menunggu Pembayaran',
    paid: 'Pembayaran Berhasil',
    processing: 'Sedang Disiapkan',
    ready_for_pickup: 'Siap Diambil',
    out_for_delivery: 'Sedang Diantar',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
    refunded: 'Dikembalikan',
    preparing: 'Sedang Disiapkan',
    ready: 'Siap Diambil',
    failed: 'Pembayaran Gagal',
  };
  return labels[status] ?? status;
}

export function getStatusColor(status: string): { bg: string; text: string; dot: string } {
  const colors: Record<string, { bg: string; text: string; dot: string }> = {
    pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
    paid: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    processing: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
    ready_for_pickup: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    out_for_delivery: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
    completed: { bg: 'bg-sage-100', text: 'text-charcoal-500', dot: 'bg-charcoal-500' },
    cancelled: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    refunded: { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' },
    preparing: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
    ready: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    failed: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  };
  return colors[status] ?? { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' };
}

export async function transitionOrderStatus(
  orderId: string,
  newStatus: string,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('order_status, order_code, buyer_id, umkm_id, product_name, vendor_name, vendor_slug, delivery_option, distance_km')
      .eq('order_code', orderId)
      .maybeSingle();

    if (fetchError || !order) {
      return { success: false, error: 'Pesanan tidak ditemukan' };
    }

    const currentStatus = (order as Record<string, any>).order_status;

    if (!isValidTransition(currentStatus, newStatus)) {
      return { success: false, error: `Transisi dari ${currentStatus} ke ${newStatus} tidak valid` };
    }

    const updatePayload: Record<string, unknown> = { order_status: newStatus };

    if (newStatus === 'completed') {
      updatePayload.lifecycle_status = 'completed';
      updatePayload.completed_at = new Date().toISOString();
    }

    if (newStatus === 'out_for_delivery') {
      // 7B-2C: gunakan orders.distance_km jika tersedia; NULL = unknown.
      // Jangan karang 1 km / angka dummy dan jangan hitung ETA dari jarak
      // yang tidak diketahui. Pickup tidak memakai delivery ETA.
      const deliveryStartedAt = new Date();
      updatePayload.delivery_started_at = deliveryStartedAt.toISOString();
      const deliveryOption = (order as Record<string, any>).delivery_option;
      const rawDistance = (order as Record<string, any>).distance_km;
      const parsedDistance = rawDistance == null ? NaN : Number(rawDistance);
      const distanceKm =
        Number.isFinite(parsedDistance) && parsedDistance >= 0 ? parsedDistance : null;
      if (deliveryOption !== 'pickup' && distanceKm != null) {
        const travelMinutes = calculateTravelMinutes(distanceKm);
        const estimatedArrivalAt = new Date(deliveryStartedAt.getTime() + travelMinutes * 60_000);
        updatePayload.estimated_arrival_at = estimatedArrivalAt.toISOString();
        updatePayload.delivery_distance_km = distanceKm;
        updatePayload.estimated_delivery_minutes = travelMinutes;
      }
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('order_code', orderId);

    if (updateError) {
      return { success: false, error: `Gagal update status: ${updateError.message}` };
    }

    await supabase.from('order_status_history').insert({
      order_id: (order as Record<string, any>).id,
      status: newStatus,
      note: note ?? null,
    });

    await fireNotificationsForTransition(orderId, currentStatus, newStatus, order as Record<string, any>);

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
    return { success: false, error: msg };
  }
}

async function fireNotificationsForTransition(
  orderCode: string,
  fromStatus: string,
  toStatus: string,
  order: Record<string, any>
): Promise<void> {
  const buyerId = order.buyer_id as string;
  const productName = (order.product_name as string) ?? 'Pesanan';
  const vendorName = (order.vendor_name as string) ?? 'Toko';
  const deepHref = `/riwayatPesanan?orderId=${encodeURIComponent(orderCode)}`;

  let sellerUserId: string | null = null;
  if (order.vendor_slug) {
    const { data: umkm } = await supabase
      .from('umkm_profiles')
      .select('user_id')
      .eq('slug', order.vendor_slug)
      .maybeSingle();
    sellerUserId = (umkm as Record<string, any>)?.user_id ?? null;
  }

  switch (toStatus) {
    case 'processing':
      
      if (buyerId) {
        await supabase.from('notifications').insert({
          user_id: buyerId,
          role: 'buyer',
          type: 'order_created',
          title: 'Pesanan Sedang Disiapkan',
          message: `Pesanan #${orderCode} (${productName}) dari ${vendorName} sedang disiapkan.`,
          reference_id: orderCode,
          href: deepHref,
        });
      }
      break;

    case 'ready_for_pickup':
      
      if (buyerId) {
        await supabase.from('notifications').insert({
          user_id: buyerId,
          role: 'buyer',
          type: 'order_delivering',
          title: 'Pesanan Siap Diambil!',
          message: `Pesanan #${orderCode} (${productName}) dari ${vendorName} sudah siap diambil di toko.`,
          reference_id: orderCode,
          href: deepHref,
        });
      }
      break;

    case 'out_for_delivery':
      
      if (buyerId) {
        await supabase.from('notifications').insert({
          user_id: buyerId,
          role: 'buyer',
          type: 'order_delivering',
          title: 'Pesanan Sedang Diantar!',
          message: `Pesanan #${orderCode} (${productName}) dari ${vendorName} sedang menuju alamatmu.`,
          reference_id: orderCode,
          href: deepHref,
        });
      }
      break;

    case 'completed':
      
      if (buyerId) {
        await supabase.from('notifications').insert({
          user_id: buyerId,
          role: 'buyer',
          type: 'order_completed',
          title: 'Pesanan Selesai!',
          message: `Pesanan #${orderCode} (${productName}) dari ${vendorName} telah selesai. Selamat menikmati!`,
          reference_id: orderCode,
          href: deepHref,
        });
      }
      
      if (sellerUserId) {
        await supabase.from('notifications').insert({
          user_id: sellerUserId,
          role: 'seller',
          type: 'order_completed',
          title: 'Pesanan Selesai!',
          message: `Pesanan #${orderCode} (${productName}) telah selesai. Dana akan dilepas ke saldo.`,
          reference_id: orderCode,
          href: '/dashboard/penjual/pesanan',
        });
      }
      
      await releaseSellerFunds(orderCode);
      break;

    case 'cancelled':
      
      if (buyerId) {
        await supabase.from('notifications').insert({
          user_id: buyerId,
          role: 'buyer',
          type: 'order_completed',
          title: 'Pesanan Dibatalkan',
          message: `Pesanan #${orderCode} (${productName}) telah dibatalkan.`,
          reference_id: orderCode,
          href: deepHref,
        });
      }
      break;
  }
}

async function releaseSellerFunds(orderCode: string): Promise<void> {
  try {
    const { data: order } = await supabase
      .from('orders')
      .select('id, buyer_id, umkm_id, vendor_slug, total_price, service_fee, product_name')
      .eq('order_code', orderCode)
      .maybeSingle();

    if (!order) return;

    const orderRow = order as Record<string, any>;
    const orderId = orderRow.id as string;
    const totalPrice = Number(orderRow.total_price ?? 0);
    const productName = (orderRow.product_name as string) ?? 'Produk';

    let sellerUserId: string | null = null;
    if (orderRow.vendor_slug) {
      const { data: umkm } = await supabase
        .from('umkm_profiles')
        .select('user_id')
        .eq('slug', orderRow.vendor_slug)
        .maybeSingle();
      sellerUserId = (umkm as Record<string, any>)?.user_id ?? null;
    }

    if (!sellerUserId || totalPrice <= 0) return;

    const { data: existing } = await supabase
      .from('seller_transactions')
      .select('id')
      .eq('order_id', orderId)
      .eq('type', 'sale')
      .maybeSingle();

    if (existing) return;

    // DB-aware: pakai service_fee yang tersimpan (sudah 12% saat checkout).
    // Fallback untuk order lama (fee 2000) atau jika kolom null → pakai RATE 12%.
    const storedFee = Number(orderRow.service_fee ?? 0);
    let serviceFee: number;
    if (Number.isFinite(storedFee) && storedFee > 0) {
      serviceFee = storedFee;
    } else if (Number.isFinite(storedFee) && storedFee === 0 && totalPrice === 0) {
      serviceFee = 0;
    } else {
      // Order lama tanpa service_fee terisi: hitung 12% dari totalPrice proporsional
      // totalPrice ≈ taxable*1.12 + delivery, jadi fee ≈ taxable*0.12. Estimasi sederhana:
      serviceFee = Math.round((totalPrice * ADMIN_FEE_RATE) / (1 + ADMIN_FEE_RATE));
    }
    const sellerAmount = Math.max(0, totalPrice - serviceFee);

    await supabase.from('seller_transactions').insert({
      seller_id: sellerUserId,
      order_id: orderId,
      order_code: orderCode,
      type: 'sale',
      amount: sellerAmount,
      status: 'completed',
    });
  } catch (err) {
    console.error('[order-state-machine] releaseSellerFunds error:', err);
  }
}
