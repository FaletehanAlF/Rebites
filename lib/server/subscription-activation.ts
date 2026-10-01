import type { SupabaseClient } from '@supabase/supabase-js';
import { computePeriodEnd, type BillingCycle } from '@/lib/subscription-plans';

/**
 * Helper aktivasi langganan - server only.
 *
 * Dipakai bersama oleh:
 * - Webhook Xendit (app/api/webhooks/xendit) - jalur utama.
 * - Endpoint verify (app/api/subscriptions/xendit/verify) - fallback saat
 *   webhook tidak terjangkau (mis. dev lokal / callback belum terpasang).
 *
 * Idempoten: subscription yang sudah active tidak diubah lagi.
 */

export type SubscriptionActivationResult =
  | { reason: 'activated'; subscriptionId: string; periodEnd: Date }
  | { reason: 'already_active'; subscriptionId: string }
  | { reason: 'not_found' }
  | { reason: 'update_failed' };

export async function activateSubscriptionPaid(
  service: SupabaseClient,
  invoiceId: string,
  paymentChannel: string | null
): Promise<SubscriptionActivationResult> {
  // Cari subscription pending dengan invoice id ini
  const { data: sub } = await service
    .from('subscriptions')
    .select('id, umkm_id, billing, status')
    .eq('xendit_invoice_id', invoiceId)
    .maybeSingle();

  const subRow = sub as Record<string, unknown> | null;
  if (!subRow) {
    console.warn('[subscription-activation] sub not found by invoice', invoiceId);
    return { reason: 'not_found' };
  }

  const subId = subRow.id as string;
  if (subRow.status === 'active') {
    return { reason: 'already_active', subscriptionId: subId };
  }

  const billing = ((subRow.billing as string) ?? 'monthly') as BillingCycle;
  const now = new Date();
  const periodEnd = computePeriodEnd(billing, now.getTime());
  const periodStart = now.toISOString();

  const { error } = await service
    .from('subscriptions')
    .update({
      status: 'active',
      xendit_status: 'PAID',
      current_period_start: periodStart,
      current_period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
      payment_method_id: paymentChannel ?? 'xendit',
    } as Record<string, unknown>)
    .eq('id', subId);

  if (error) {
    console.error('[subscription-activation] update error', error.message, { subId, invoiceId });
    return { reason: 'update_failed' };
  }

  // Notif seller (best-effort)
  const umkmId = subRow.umkm_id as string;
  const { data: umkm } = await service
    .from('umkm_profiles')
    .select('user_id, business_name')
    .eq('id', umkmId)
    .maybeSingle();
  if (umkm) {
    const sellerId = (umkm as Record<string, string>).user_id;
    const { error: notifErr } = await service.from('notifications').insert({
      user_id: sellerId,
      role: 'seller',
      type: 'subscription_active',
      title: 'Langganan Aktif!',
      message: `Pembayaran langganan ReBites berhasil. Paket aktif hingga ${periodEnd.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
      reference_id: invoiceId,
      href: '/dashboard/penjual/langganan',
    });
    if (notifErr) {
      console.error('[subscription-activation] notif error', notifErr.message);
    }
  }

  return { reason: 'activated', subscriptionId: subId, periodEnd };
}
