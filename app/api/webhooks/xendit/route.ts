import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/server/supabase';
import { settleOrderPaid } from '@/lib/server/order-settlement';
import { activateSubscriptionPaid } from '@/lib/server/subscription-activation';

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
    
    const { data: order, error: orderErr } = await service
      .from('orders')
      .select('order_code, payment_status, product_slug, quantity, coin_used, coin_earned, buyer_id, vendor_name, product_name, total_price')
      .eq('order_code', externalId)
      .maybeSingle();

    if (orderErr) {
      // Do not ack: Xendit must retry or the payment is never settled.
      console.error('[webhook/xendit] order fetch failed', orderErr.message);
      return NextResponse.json({ error: 'DB fetch failed' }, { status: 500 });
    }

    if (!order) {
      console.warn('[webhook/xendit] order not found', externalId);
      return NextResponse.json({ received: true, note: 'order not found' });
    }

    const row = order as Record<string, unknown>;
    const currentPayment = row.payment_status as string;

    if (normalizedStatus === 'PAID' || normalizedStatus === 'SETTLED') {
      const result = await settleOrderPaid(
        service,
        externalId,
        invoiceId,
        payload.payment_channel ?? payload.payment_method ?? null
      );
      if (result.reason === 'already_paid') {
        return NextResponse.json({ received: true, already: 'paid' });
      }
      if (result.reason === 'not_found') {
        return NextResponse.json({ received: true, note: 'order not found' });
      }
      if (result.reason === 'update_failed') {
        return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
      }
    } else if (normalizedStatus === 'EXPIRED') {
      if (currentPayment === 'paid') {
        return NextResponse.json({ received: true, already: 'paid' });
      }
      const slug = (row.product_slug as string) ?? null;
      const qty = Number(row.quantity ?? 1);
      if (slug && qty > 0) {
        const { error: relErr } = await service.rpc('release_stock', { p_slug: slug, p_quantity: qty });
        if (relErr) {
          console.error('[webhook/xendit] release_stock failed', relErr.message);
          return NextResponse.json({ error: 'Stock release failed' }, { status: 500 });
        }
      }
      const { error: expErr } = await service
        .from('orders')
        .update({
          payment_status: 'failed',
          order_status: 'cancelled',
          xendit_invoice_id: invoiceId,
        } as Record<string, unknown>)
        .eq('order_code', externalId);
      if (expErr) {
        console.error('[webhook/xendit] expire update failed', expErr.message);
        return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
      }
    } else if (normalizedStatus === 'FAILED' || normalizedStatus === 'VOIDED') {
      const slug2 = (row.product_slug as string) ?? null;
      const qty2 = Number(row.quantity ?? 1);
      if (currentPayment !== 'paid' && slug2 && qty2 > 0) {
        const { error: relErr2 } = await service.rpc('release_stock', { p_slug: slug2, p_quantity: qty2 });
        if (relErr2) {
          console.error('[webhook/xendit] release_stock failed', relErr2.message);
          return NextResponse.json({ error: 'Stock release failed' }, { status: 500 });
        }
      }
      const { error: failErr } = await service
        .from('orders')
        .update({
          payment_status: 'failed',
          order_status: 'cancelled',
          xendit_invoice_id: invoiceId,
        } as Record<string, unknown>)
        .eq('order_code', externalId);
      if (failErr) {
        console.error('[webhook/xendit] fail update failed', failErr.message);
        return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
      }
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
      const { error: subErr } = await service
        .from('subscriptions')
        .update({ status: 'expired', xendit_status: normalizedStatus } as Record<string, unknown>)
        .eq('xendit_invoice_id', invoiceId);
      if (subErr) {
        console.error('[webhook/xendit] subscription update failed', subErr.message);
        return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
      }
    }

    return NextResponse.json({ received: true });
  }

  console.warn('[webhook/xendit] unknown external_id', externalId);
  return NextResponse.json({ received: true, note: 'unknown prefix' });
}
