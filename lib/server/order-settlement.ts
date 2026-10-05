import type { SupabaseClient } from '@supabase/supabase-js';

export type SettleResult = {
  settled: boolean;
  reason?: 'not_found' | 'already_paid' | 'update_failed' | 'amount_mismatch';
};

export async function settleOrderPaid(
  service: SupabaseClient,
  externalId: string,
  invoiceId: string,
  paymentChannel?: string | null,
  /**
   * Jumlah yang benar-benar dibayar menurut sumber terpercaya
   * (webhook: paid_amount ?? amount; verify: invoice.amount).
   * Bila terisi dan tidak sama dengan orders.total_price, settlement
   * DITOLAK agar invoice salah nominal tidak menandai order lunas.
   */
  paidAmount?: number | null
): Promise<SettleResult> {
  const { data: order } = await service
    .from('orders')
    .select('order_code, payment_status, product_slug, quantity, coin_used, coin_earned, buyer_id, vendor_name, vendor_slug, product_name, total_price')
    .eq('order_code', externalId)
    .maybeSingle();

  if (!order) {
    return { settled: false, reason: 'not_found' };
  }

  const row = order as Record<string, unknown>;
  if (row.payment_status === 'paid') {
    return { settled: false, reason: 'already_paid' };
  }

  if (paidAmount != null && Number.isFinite(paidAmount)) {
    const expected = Number(row.total_price ?? NaN);
    if (!Number.isFinite(expected) || Math.round(paidAmount) !== Math.round(expected)) {
      console.error('[order-settlement] amount mismatch', {
        orderCode: externalId,
        expected,
        paid: paidAmount,
      });
      return { settled: false, reason: 'amount_mismatch' };
    }
  }

  const { error: updErr } = await service
    .from('orders')
    .update({
      payment_status: 'paid',
      order_status: 'paid',
      payment_method_id: paymentChannel ?? 'xendit',
      xendit_invoice_id: invoiceId,
    } as Record<string, unknown>)
    .eq('order_code', externalId);

  if (updErr) {
    console.error('[order-settlement] update paid error', updErr.message, { orderCode: externalId });
    return { settled: false, reason: 'update_failed' };
  }

  const coinUsed = Number(row.coin_used ?? 0);
  const coinEarned = Number(row.coin_earned ?? 0);
  const buyerId = row.buyer_id as string;
  if (buyerId && (coinUsed > 0 || coinEarned > 0)) {
    const { data: existing } = await service
      .from('coin_transactions')
      .select('type')
      .eq('user_id', buyerId)
      .eq('order_code', externalId);
    const existingTypes = new Set(((existing ?? []) as Array<{ type: string }>).map((r) => r.type));
    const pending: Record<string, unknown>[] = [];
    if (coinUsed > 0 && !existingTypes.has('spent')) {
      pending.push({ user_id: buyerId, order_code: externalId, type: 'spent', amount: coinUsed, description: 'Potongan pesanan' });
    }
    if (coinEarned > 0 && !existingTypes.has('earned')) {
      pending.push({ user_id: buyerId, order_code: externalId, type: 'earned', amount: coinEarned, description: 'Reward pembelian' });
    }
    if (pending.length > 0) {
      await service.from('coin_transactions').insert(pending);
    }
  }

  if (buyerId) {
    const productName = (row.product_name as string) ?? 'Pesanan';
    const vendorName = (row.vendor_name as string) ?? 'Toko';
    const totalPrice = Number(row.total_price ?? 0);
    const deepHref = `/riwayatPesanan?orderId=${encodeURIComponent(externalId)}`;
    
    const { data: existingNotifs } = await service
      .from('notifications')
      .select('type')
      .eq('user_id', buyerId)
      .eq('reference_id', externalId)
      .in('type', ['payment_success', 'order_created']);
    const existingTypes = new Set(((existingNotifs ?? []) as Array<{ type: string }>).map((r) => r.type));
    const toInsert: Record<string, unknown>[] = [];
    if (!existingTypes.has('payment_success')) {
      toInsert.push({
        user_id: buyerId,
        role: 'buyer',
        type: 'payment_success',
        title: 'Pembayaran Berhasil',
        message: `Pembayaran Rp${totalPrice.toLocaleString('id-ID')} untuk ${productName} via ${paymentChannel ?? 'Xendit'} berhasil. Pesanan sedang disiapkan.`,
        reference_id: externalId,
        href: deepHref,
      });
    }
    if (!existingTypes.has('order_created')) {
      toInsert.push({
        user_id: buyerId,
        role: 'buyer',
        type: 'order_created',
        title: 'Pesanan Sedang Disiapkan',
        message: `Pesanan #${externalId} dari ${vendorName} sedang disiapkan penjual.`,
        reference_id: externalId,
        href: deepHref,
      });
    }
    if (toInsert.length > 0) {
      await service.from('notifications').insert(toInsert);
    }

    const vendorSlug = (row as Record<string, unknown>).vendor_slug as string | undefined;
    if (vendorSlug) {
      const { data: umkm } = await service
        .from('umkm_profiles')
        .select('user_id')
        .eq('slug', vendorSlug)
        .maybeSingle();
      const sellerId = umkm ? (umkm as Record<string, string>).user_id : null;
      if (sellerId) {
        
        const { data: existingSeller } = await service
          .from('notifications')
          .select('id')
          .eq('user_id', sellerId)
          .eq('role', 'seller')
          .eq('reference_id', externalId)
          .eq('type', 'incoming_order')
          .limit(1);
        if (!existingSeller || existingSeller.length === 0) {
          await service.from('notifications').insert({
            user_id: sellerId,
            role: 'seller',
            type: 'incoming_order',
            title: 'Pesanan Masuk!',
            message: `Pesanan #${externalId}, ${productName} telah dibayar. Segera siapkan pesanan.`,
            reference_id: externalId,
            href: '/dashboard/penjual/pesanan',
          });
        }
      }
    }
  }

  return { settled: true };
}