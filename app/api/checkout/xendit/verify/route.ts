import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getUserFromBearer } from '@/lib/server/supabase';
import { getXenditInvoice } from '@/lib/server/xendit';
import { settleOrderPaid } from '@/lib/server/order-settlement';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { orderCode?: string } | null;
  const orderCode = body?.orderCode?.trim();
  if (!orderCode) {
    return NextResponse.json({ error: 'orderCode wajib diisi.' }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: order } = await service
    .from('orders')
    .select('order_code, buyer_id, payment_status, xendit_invoice_id')
    .eq('order_code', orderCode)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
  }
  const row = order as Record<string, unknown>;
  
  if (row.buyer_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const currentStatus = (row.payment_status as string) ?? 'unpaid';
  const invoiceId = row.xendit_invoice_id as string | null;

  if (currentStatus !== 'unpaid' || !invoiceId) {
    return NextResponse.json({ orderCode, paymentStatus: currentStatus });
  }

  try {
    const invoice = await getXenditInvoice(invoiceId);
    const invoiceStatus = String(invoice.status ?? '').toUpperCase();

    if (invoiceStatus === 'PAID' || invoiceStatus === 'SETTLED') {
      const result = await settleOrderPaid(
        service,
        orderCode,
        invoiceId,
        invoice.payment_channel ?? invoice.payment_method ?? null,
        Number(invoice.amount ?? NaN)
      );
      if (result.reason === 'amount_mismatch') {
        return NextResponse.json({ error: 'Nominal invoice tidak sesuai pesanan.' }, { status: 409 });
      }
      if (result.reason === 'update_failed') {
        return NextResponse.json({ error: 'Gagal menandai pesanan lunas.' }, { status: 500 });
      }
      return NextResponse.json({ orderCode, paymentStatus: 'paid', settled: result.settled });
    }

    if (invoiceStatus === 'EXPIRED') {
      return NextResponse.json({ orderCode, paymentStatus: currentStatus, invoiceStatus: 'EXPIRED' });
    }

    return NextResponse.json({ orderCode, paymentStatus: currentStatus, invoiceStatus });
  } catch (e: unknown) {
    
    const msg = e instanceof Error ? e.message : 'Gagal verifikasi invoice.';
    console.error('[checkout/xendit/verify] error', msg, { orderCode });
    return NextResponse.json({ orderCode, paymentStatus: currentStatus, verifyError: msg });
  }
}