import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/server/supabase';
import { settleOrderPaid } from '@/lib/server/order-settlement';
import { activateSubscriptionPaid } from '@/lib/server/subscription-activation';
import { createBiteshipShipment } from '@/lib/server/biteship-shipment';
import { planTerminalPromoRelease, isInvoiceStateColumnMissingError } from '@/lib/server/checkout-idempotency';

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
 * attempt shipment Biteship pasca-payment (delivery only).
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
      .from('orders')        .select('order_code, payment_status, product_slug, quantity, coin_used, coin_earned, buyer_id, vendor_name, product_name, total_price, delivery_option, promo_code')
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
        // Konsisten dengan verify order: 409 Conflict (nominal bentrok dengan
        // total pesanan). Bukan 422 supaya kontrak respons antar-endpoint sama.
        return NextResponse.json({ error: 'Amount mismatch' }, { status: 409 });
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
      // settlement fresh sukses → attempt shipment (delivery only).
      // Gagal shipment tidak mengubah payment paid / respons webhook.
      await maybeCreateShipment(externalId, row.delivery_option);
    } else if (
      normalizedStatus === 'EXPIRED' ||
      normalizedStatus === 'FAILED' ||
      normalizedStatus === 'VOIDED'
    ) {
      if (currentPayment === 'paid') {
        return NextResponse.json({ received: true, already: 'paid' });
      }
      // Transisi atomik: hanya order yang masih 'unpaid' yang dibatalkan.
      // Pengembalian stok dilakukan trigger database tepat satu kali
      // (stock_released_at), sehingga webhook duplikat / verify / cancel
      // yang berjalan bersamaan tidak dapat melepas stok dua kali.
      // hold koin (reservasi saat checkout) dikembalikan via RPC
      // idempoten; trigger DB trg_orders_refund_coins menjadi jaring
      // pengaman kedua (mencakup cancel client + jalur admin).
      // Tahap C: fallback EKSKLUSIF untuk error skema yang menunjukkan kolom
      // invoice_state tidak ada (migration 2D-E belum diterapkan) —
      // isInvoiceStateColumnMissingError menolak error jaringan maupun error
      // database lain (mis. pelanggaran CHECK bernama ..._invoice_state_...).
      // Error database TIDAK ditelan: percobaan fallback dan kegagalan akhir
      // selalu dicatat.
      let { data: expiredRows, error: terminalErr } = await service
        .from('orders')
        .update({
          payment_status: 'failed',
          order_status: 'cancelled',
          invoice_state: 'failed',
          xendit_invoice_id: invoiceId,
        } as Record<string, unknown>)
        .eq('order_code', externalId)
        .eq('payment_status', 'unpaid')
        .select('order_code');
      if (terminalErr && isInvoiceStateColumnMissingError(terminalErr)) {
        console.warn('[webhook/xendit] kolom invoice_state belum tersedia; fallback terminal tanpa kolom tersebut', {
          orderCode: externalId,
          detail: terminalErr.message,
        });
        ({ data: expiredRows, error: terminalErr } = await service
          .from('orders')
          .update({
            payment_status: 'failed',
            order_status: 'cancelled',
            xendit_invoice_id: invoiceId,
          } as Record<string, unknown>)
          .eq('order_code', externalId)
          .eq('payment_status', 'unpaid')
          .select('order_code'));
      }
      if (terminalErr) {
        console.error('[webhook/xendit] transisi terminal gagal', terminalErr.message, {
          orderCode: externalId,
        });
      }
      // Pelepasan promo: HANYA pemenang transisi terminal yang boleh melepas,
      // dan hanya bila promo benar-benar terklaim (lihat planTerminalPromoRelease).
      // `release_promo` tidak idempoten -> jangan pernah dipanggil dua kali
      // oleh webhook + verify yang memproses order yang sama.
      const terminalPlan = planTerminalPromoRelease({
        updateWon: !!expiredRows && expiredRows.length > 0,
        promoCode: row.promo_code,
      });
      if (terminalPlan.release && terminalPlan.promoCode) {
        try {
          const { error: promoErr } = await service.rpc('release_promo', {
            p_code: terminalPlan.promoCode,
          });
          if (promoErr) {
            console.error('[webhook/xendit] release promo gagal', promoErr.message, { orderCode: externalId });
          }
        } catch (e) {
          console.error('[webhook/xendit] release promo melempar', e instanceof Error ? e.message : e, { orderCode: externalId });
        }
      }
      if (expiredRows && expiredRows.length > 0 && row.buyer_id) {
        try {
          await service.rpc('refund_order_coins', {
            p_user_id: row.buyer_id as string,
            p_order_code: externalId,
          });
        } catch (e) {
          console.error('[webhook/xendit] refund coins gagal', e instanceof Error ? e.message : e, { orderCode: externalId });
        }
      }
    }

    return NextResponse.json({ received: true });
  }

  if (externalId.startsWith('SUB-')) {
    if (normalizedStatus === 'PAID' || normalizedStatus === 'SETTLED') {
      const subPaidAmount =
        payload.paid_amount != null
          ? Number(payload.paid_amount)
          : payload.amount != null
            ? Number(payload.amount)
            : null;
      const result = await activateSubscriptionPaid(
        service,
        invoiceId,
        payload.payment_channel ?? payload.payment_method ?? null,
        subPaidAmount
      );
      if (result.reason === 'amount_mismatch') {
        return NextResponse.json({ error: 'Amount mismatch' }, { status: 422 });
      }
      if (result.reason === 'already_active') {
        return NextResponse.json({ received: true, already: 'active' });
      }
      if (result.reason === 'update_failed') {
        return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
      }
      // not_found → biarkan jatuh ke received (fallback verify endpoint / retry webhook)
    } else if (normalizedStatus === 'EXPIRED' || normalizedStatus === 'FAILED' || normalizedStatus === 'VOIDED') {
      // hanya langganan yang masih 'pending' yang boleh di-expire-kan.
      // Webhook lama/terlambat tidak boleh menjatuhkan subscription yang
      // sudah active (mis. EXPIRED lama datang setelah PAID).
      await service
        .from('subscriptions')
        .update({ status: 'expired', xendit_status: normalizedStatus } as Record<string, unknown>)
        .eq('xendit_invoice_id', invoiceId)
        .eq('status', 'pending');
    }

    return NextResponse.json({ received: true });
  }

  console.warn('[webhook/xendit] unknown external_id', externalId);
  return NextResponse.json({ received: true, note: 'unknown prefix' });
}
