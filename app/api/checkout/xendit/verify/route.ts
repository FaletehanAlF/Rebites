import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getUserFromBearer } from '@/lib/server/supabase';
import { getXenditInvoice } from '@/lib/server/xendit';
import { settleOrderPaid } from '@/lib/server/order-settlement';
import { claimXenditCheck, VERIFY_CHECK_WINDOW_SECONDS } from '@/lib/server/verify-throttle';
import { planTerminalPromoRelease, isInvoiceStateColumnMissingError, type InvoiceState } from '@/lib/server/checkout-idempotency';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
    const user = await getUserFromBearer(req.headers.get('authorization'));
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
    }
    const body = (await req.json().catch(() => null)) as {
        orderCode?: string;
    } | null;
    const orderCode = body?.orderCode?.trim();
    if (!orderCode) {
        return NextResponse.json({ error: 'orderCode wajib diisi.' }, { status: 400 });
    }
    const service = createServiceClient();
    let order: Record<string, unknown> | null = null;
    {
        const sel = await service
            .from('orders')
            .select('order_code, buyer_id, payment_status, xendit_invoice_id, invoice_state, promo_code')
            .eq('order_code', orderCode)
            .maybeSingle();
        if (!sel.error) {
            order = sel.data as Record<string, unknown> | null;
        }
        else if (isInvoiceStateColumnMissingError(sel.error)) {
            const legacy = await service
                .from('orders')
                .select('order_code, buyer_id, payment_status, xendit_invoice_id, promo_code')
                .eq('order_code', orderCode)
                .maybeSingle();
            if (legacy.error) {
                console.error('[checkout/xendit/verify] fetch error', legacy.error.message);
                return NextResponse.json({ error: 'Gagal memuat pesanan' }, { status: 500 });
            }
            order = legacy.data as Record<string, unknown> | null;
        }
        else {
            console.error('[checkout/xendit/verify] fetch error', sel.error.message);
            return NextResponse.json({ error: 'Gagal memuat pesanan' }, { status: 500 });
        }
    }
    if (!order) {
        return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
    }
    const row = order as Record<string, unknown>;
    if (row.buyer_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const currentStatus = (row.payment_status as string) ?? 'unpaid';
    const invoiceId = row.xendit_invoice_id as string | null;
    const invoiceState = (row.invoice_state as InvoiceState | null) ?? null;
    if (currentStatus !== 'unpaid' || !invoiceId) {
        return NextResponse.json({ orderCode, paymentStatus: currentStatus, invoiceState });
    }
    if (invoiceState !== null && invoiceState !== 'attached') {
        return NextResponse.json({ orderCode, paymentStatus: currentStatus, invoiceState });
    }
    if (!claimXenditCheck(`order:${orderCode}`)) {
        return NextResponse.json({
            orderCode,
            paymentStatus: currentStatus,
            throttled: true,
            retryAfterSeconds: VERIFY_CHECK_WINDOW_SECONDS,
        });
    }
    try {
        const invoice = await getXenditInvoice(invoiceId);
        const invoiceStatus = String(invoice.status ?? '').toUpperCase();
        if (invoiceStatus === 'PAID' || invoiceStatus === 'SETTLED') {
            const paidAmount = Number(invoice.amount);
            if (!Number.isFinite(paidAmount)) {
                return NextResponse.json({
                    orderCode,
                    paymentStatus: currentStatus,
                    verifyError: 'Nominal invoice tidak tersedia.',
                });
            }
            const result = await settleOrderPaid(service, orderCode, invoiceId, invoice.payment_channel ?? invoice.payment_method ?? null, paidAmount);
            if (result.reason === 'amount_mismatch') {
                return NextResponse.json({ error: 'Nominal invoice tidak sesuai pesanan.' }, { status: 409 });
            }
            if (result.reason === 'update_failed') {
                return NextResponse.json({ error: 'Gagal menandai pesanan lunas.' }, { status: 500 });
            }
            return NextResponse.json({ orderCode, paymentStatus: 'paid', settled: result.settled });
        }
        if (invoiceStatus === 'EXPIRED' || invoiceStatus === 'FAILED' || invoiceStatus === 'VOIDED') {
            let { data: cancelled, error: cancelErr } = await service
                .from('orders')
                .update({ payment_status: 'failed', order_status: 'cancelled', invoice_state: 'failed' } as Record<string, unknown>)
                .eq('order_code', orderCode)
                .eq('payment_status', 'unpaid')
                .select('order_code');
            if (cancelErr && isInvoiceStateColumnMissingError(cancelErr)) {
                console.warn('[checkout/xendit/verify] kolom invoice_state belum tersedia; fallback terminal tanpa kolom tersebut', {
                    orderCode,
                    detail: cancelErr.message,
                });
                ({ data: cancelled, error: cancelErr } = await service
                    .from('orders')
                    .update({ payment_status: 'failed', order_status: 'cancelled' } as Record<string, unknown>)
                    .eq('order_code', orderCode)
                    .eq('payment_status', 'unpaid')
                    .select('order_code'));
            }
            if (cancelErr) {
                console.error('[checkout/xendit/verify] transisi terminal gagal', cancelErr.message, { orderCode });
            }
            const terminalPlan = planTerminalPromoRelease({
                updateWon: !!cancelled && cancelled.length > 0,
                promoCode: row.promo_code,
            });
            if (terminalPlan.release && terminalPlan.promoCode) {
                try {
                    const { error: promoErr } = await service.rpc('release_promo', {
                        p_code: terminalPlan.promoCode,
                    });
                    if (promoErr) {
                        console.error('[checkout/xendit/verify] release promo gagal', promoErr.message, { orderCode });
                    }
                }
                catch (e) {
                    console.error('[checkout/xendit/verify] release promo melempar', e instanceof Error ? e.message : e, { orderCode });
                }
            }
            if (cancelled && cancelled.length > 0 && row.buyer_id) {
                try {
                    await service.rpc('refund_order_coins', {
                        p_user_id: row.buyer_id as string,
                        p_order_code: orderCode,
                    });
                }
                catch (e) {
                    console.error('[checkout/xendit/verify] refund coins gagal', e instanceof Error ? e.message : e, { orderCode });
                }
            }
            const finalStatus = cancelled && cancelled.length > 0 ? 'failed' : currentStatus;
            return NextResponse.json({ orderCode, paymentStatus: finalStatus, invoiceStatus });
        }
        return NextResponse.json({ orderCode, paymentStatus: currentStatus, invoiceStatus });
    }
    catch (e: unknown) {
        console.error('[checkout/xendit/verify] error', e, { orderCode });
        return NextResponse.json({
            orderCode,
            paymentStatus: currentStatus,
            verifyError: 'Gagal memverifikasi invoice.',
        });
    }
}
