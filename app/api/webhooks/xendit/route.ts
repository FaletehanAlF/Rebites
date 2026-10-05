import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/server/supabase';
import { settleOrderPaid } from '@/lib/server/order-settlement';
import { activateSubscriptionPaid } from '@/lib/server/subscription-activation';
import { createBiteshipShipment } from '@/lib/server/biteship-shipment';

export const runtime = 'nodejs';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

interface XenditCallback {
  id: string;
  external_id: string;
  status: string;
  amount?: number;
  paid_amount?: number;
  payment_method?: string;
  payment_channel?: string;
  payment_destination?: string;
  payer_email?: string;
}

/**
 * 7C-3C-3: attempt shipment Biteship pasca-payment (delivery only).
 * Terisolasi penuh: exception TIDAK BOLEH mengubah hasil settlement
 * (payment tetap paid, webhook tetap sukses). Pickup dilewati tanpa call.
 * Idempoten via guard internal createBiteshipShipment (already/recovered).
 */
async function maybeCreateShipment(orderCode: string, deliveryOption: unknown): Promise<void> {
  if (deliveryOption !== 'delivery') return;
  try {
    const result = await createBiteshipShipment(orderCode);
    if (!result.ok) {
      // shipment_error sudah disimpan service; log ringkas tanpa data sensitif.
      console.warn('[webhook/xendit] shipment gagal', { orderCode, reason: result.reason });
    } else {
      console.log('[webhook/xendit] shipment', { orderCode, status: result.status });
    }
  } catch (err) {
    // Isolasi: kegagalan tak terduga tidak boleh menggagalkan webhook payment.
    console.error(
      '[webhook/xendit] shipment exception',
      err instanceof Error ? err.message : 'unknown'
    );
  }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-callback-token')?.trim() ?? null;
  const rawExpected =
    process.env.XENDIT_CALLBACK_TOKEN?.trim() ||
    process.env.XENDIT_WEBHOOK_TOKEN?.trim() ||
    null;

  if (!rawExpected) {
    console.error('[webhook/xendit] XENDIT_CALLBACK_TOKEN / XENDIT_WEBHOOK_TOKEN belum di-set');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  const expected = rawExpected.trim();
  if (!token || !timingSafeEqual(token, expected)) {
    console.warn('[webhook/xendit] invalid callback token');
    return NextResponse.json({ error: 'Invalid callback token' }, { status: 401 });
  }

  let payload: XenditCallback;
  try {
    payload = (await req.json()) as XenditCallback;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id: invoiceId, external_id: externalId, status } = payload;
  if (!externalId || !invoiceId) {
    return NextResponse.json({ error: 'Missing external_id or id' }, { status: 400 });
  }

  const service = createServiceClient();
  const normalizedStatus = String(status).toUpperCase();

  if (externalId.startsWith('RB-')) {
    
    const { data: order } = await service
      .from('orders')
      .select('order_code, payment_status, product_slug, quantity, coin_used, coin_earned, buyer_id, vendor_name, product_name, total_price, delivery_option')
      .eq('order_code', externalId)
      .maybeSingle();

    if (!order) {
      console.warn('[webhook/xendit] order not found', externalId);
      return NextResponse.json({ received: true, note: 'order not found' });
    }

    const row = order as Record<string, unknown>;
    const currentPayment = row.payment_status as string;

    if (normalizedStatus === 'PAID' || normalizedStatus === 'SETTLED') {
      // Fail-closed: nominal webhook harus sama dengan total order.
      // Tanpa ini invoice salah nominal bisa menandai order lunas.
      const paidAmount =
        payload.paid_amount != null
          ? Number(payload.paid_amount)
          : payload.amount != null
            ? Number(payload.amount)
            : null;
      if (paidAmount == null || !Number.isFinite(paidAmount)) {
        console.warn('[webhook/xendit] missing amount', externalId);
        return NextResponse.json({ error: 'Missing amount' }, { status: 400 });
      }
      const result = await settleOrderPaid(
        service,
        externalId,
        invoiceId,
        payload.payment_channel ?? payload.payment_method ?? null,
        paidAmount
      );
      if (result.reason === 'amount_mismatch') {
        return NextResponse.json({ error: 'Amount mismatch' }, { status: 422 });
      }
      if (result.reason === 'already_paid') {
        // 7C-3C-3 recovery: payment sudah paid, shipment mungkin belum pernah
        // dibuat (mis. gagal sebelumnya). Guard internal mencegah duplikat.
        await maybeCreateShipment(externalId, row.delivery_option);
        return NextResponse.json({ received: true, already: 'paid' });
      }
      if (result.reason === 'not_found') {
        return NextResponse.json({ received: true, note: 'order not found' });
      }
      if (result.reason === 'update_failed') {
        return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
      }
      // 7C-3C-3: settlement fresh sukses → attempt shipment (delivery only).
      // Gagal shipment tidak mengubah payment paid / respons webhook.
      await maybeCreateShipment(externalId, row.delivery_option);
    } else if (normalizedStatus === 'EXPIRED') {
      if (currentPayment === 'paid') {
        return NextResponse.json({ received: true, already: 'paid' });
      }
      const slug = (row.product_slug as string) ?? null;
      const qty = Number(row.quantity ?? 1);
      if (slug && qty > 0) {
        await service.rpc('release_stock', { p_slug: slug, p_quantity: qty });
      }
      await service
        .from('orders')
        .update({
          payment_status: 'failed',
          order_status: 'cancelled',
          xendit_invoice_id: invoiceId,
        } as Record<string, unknown>)
        .eq('order_code', externalId);
    } else if (normalizedStatus === 'FAILED' || normalizedStatus === 'VOIDED') {
      const slug2 = (row.product_slug as string) ?? null;
      const qty2 = Number(row.quantity ?? 1);
      if (currentPayment !== 'paid' && slug2 && qty2 > 0) {
        await service.rpc('release_stock', { p_slug: slug2, p_quantity: qty2 });
      }
      await service
        .from('orders')
        .update({
          payment_status: 'failed',
          order_status: 'cancelled',
          xendit_invoice_id: invoiceId,
        } as Record<string, unknown>)
        .eq('order_code', externalId);
    }

    return NextResponse.json({ received: true });
  }

  if (externalId.startsWith('SUB-')) {
    if (normalizedStatus === 'PAID' || normalizedStatus === 'SETTLED') {
      const result = await activateSubscriptionPaid(
        service,
        invoiceId,
        payload.payment_channel ?? payload.payment_method ?? null
      );
      if (result.reason === 'already_active') {
        return NextResponse.json({ received: true, already: 'active' });
      }
      if (result.reason === 'update_failed') {
        return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
      }
      // not_found → biarkan jatuh ke received (fallback verify endpoint / retry webhook)
    } else if (normalizedStatus === 'EXPIRED' || normalizedStatus === 'FAILED' || normalizedStatus === 'VOIDED') {
      await service
        .from('subscriptions')
        .update({ status: 'expired', xendit_status: normalizedStatus } as Record<string, unknown>)
        .eq('xendit_invoice_id', invoiceId);
    }

    return NextResponse.json({ received: true });
  }

  console.warn('[webhook/xendit] unknown external_id', externalId);
  return NextResponse.json({ received: true, note: 'unknown prefix' });
}
