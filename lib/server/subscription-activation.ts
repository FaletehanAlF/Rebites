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
  | { reason: 'update_failed' }
  | { reason: 'amount_mismatch'; expected: number; actual: number | null };

export async function activateSubscriptionPaid(
  service: SupabaseClient,
  invoiceId: string,
  paymentChannel: string | null,
  paidAmount?: number | null
): Promise<SubscriptionActivationResult> {
  // Cari subscription pending dengan invoice id ini
  const { data: sub } = await service
    .from('subscriptions')
    .select('id, umkm_id, billing, status, price_paid')
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

  // amount yang dibayar harus sama dengan price_paid yang dihitung
  // server saat membuat invoice. Tanpa ini invoice selisih bisa mengaktifkan
  // subscription secara penuh.
  const expected = Number(subRow.price_paid ?? NaN);
  const actual =
    paidAmount == null ? null : Number(paidAmount);
  if (!Number.isFinite(expected) || actual == null || !Number.isFinite(actual)) {
    console.warn('[subscription-activation] missing amount', { invoiceId, expected, actual });
    return { reason: 'amount_mismatch', expected: Number.isFinite(expected) ? expected : 0, actual };
  }
  if (Math.round(actual) !== Math.round(expected)) {
    console.warn('[subscription-activation] amount mismatch', { invoiceId, expected, actual });
    return { reason: 'amount_mismatch', expected, actual };
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
    .eq('id', subId)
    .in('status', ['pending', 'expired', 'cancelled']);

  if (error) {
    console.error('[subscription-activation] update error', error.message, { subId, invoiceId });
    return { reason: 'update_failed' };
  }

  // Jika tidak ada baris yang berubah, berarti status berubah di antara
  // pembacaan dan update (mis. PAID/EXPIRED lain menang balapan). Jangan
  // memperpanjang periode dua kali.
  const { data: settled } = await service
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('id', subId)
    .maybeSingle();
  if (!settled || (settled as Record<string, unknown>).status !== 'active') {
    return { reason: 'update_failed' };
  }
  if (new Date((settled as Record<string, unknown>).current_period_end as string).getTime() !== periodEnd.getTime()) {
    // Row telah diupdate pemanggil lain: jangan lanjut notifikasi ganda.
    return { reason: 'already_active', subscriptionId: subId };
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
