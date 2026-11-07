import type { SupabaseClient } from '@supabase/supabase-js';
import { classifyCoinDebitOutcome, interpretDebtWriteResult, isTerminalOrderState, type CoinDebitReason, type CoinDebitStatus, } from './coin-debit';
import { sellerStorePath } from '@/lib/seller-store-path';
export type SettleResult = {
    settled: boolean;
    reason?: 'not_found' | 'already_paid' | 'update_failed' | 'amount_mismatch';
};
async function readSpentLedger(service: SupabaseClient, userId: string, orderCode: string): Promise<{
    spentExists: boolean;
    failed: boolean;
}> {
    const { data, error } = await service
        .from('coin_transactions')
        .select('type')
        .eq('user_id', userId)
        .eq('order_code', orderCode)
        .eq('type', 'spent')
        .limit(1);
    if (error) {
        return { spentExists: false, failed: true };
    }
    return { spentExists: ((data ?? []) as Array<{
            type: string;
        }>).length > 0, failed: false };
}
async function readOrderTerminalState(service: SupabaseClient, orderCode: string): Promise<{
    isTerminal: boolean | null;
}> {
    const { data, error } = await service
        .from('orders')
        .select('payment_status, order_status')
        .eq('order_code', orderCode)
        .maybeSingle();
    if (error || !data) {
        return { isTerminal: null };
    }
    const row = data as Record<string, unknown>;
    return {
        isTerminal: isTerminalOrderState(row.payment_status as string | null, row.order_status as string | null),
    };
}
async function writeCoinDebitDebt(service: SupabaseClient, orderCode: string, userId: string, debt: {
    status: CoinDebitStatus;
    reason: CoinDebitReason;
}): Promise<{
    ok: boolean;
    detail: string | null;
}> {
    const { data, error } = await service
        .from('orders')
        .update({
        coin_debit_status: debt.status,
        coin_debit_reason: debt.reason,
        coin_debit_updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
        .eq('order_code', orderCode)
        .eq('buyer_id', userId)
        .select('order_code');
    return interpretDebtWriteResult({
        rowCount: Array.isArray(data) ? data.length : null,
        error,
    });
}
export async function settleOrderPaid(service: SupabaseClient, externalId: string, invoiceId: string, paymentChannel?: string | null, paidAmount?: number | null): Promise<SettleResult> {
    const { data: order } = await service
        .from('orders')
        .select('id, order_code, payment_status, product_slug, quantity, coin_used, coin_earned, buyer_id, vendor_name, vendor_slug, product_name, total_price, estimated_minutes')
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
    const paymentConfirmedAt = new Date();
    const estimatedMinutesRaw = Number(row.estimated_minutes ?? 0);
    const preparationMinutes = Number.isFinite(estimatedMinutesRaw) && estimatedMinutesRaw > 0
        ? Math.round(estimatedMinutesRaw)
        : null;
    const reanchoredCompletionAt = preparationMinutes == null
        ? null
        : new Date(paymentConfirmedAt.getTime() + preparationMinutes * 60000).toISOString();
    const { data: updated, error: updErr } = await service
        .from('orders')
        .update({
        payment_status: 'paid',
        order_status: 'paid',
        payment_method_id: paymentChannel ?? 'xendit',
        xendit_invoice_id: invoiceId,
        ...(reanchoredCompletionAt ? { estimated_completion_at: reanchoredCompletionAt } : {}),
    } as Record<string, unknown>)
        .eq('order_code', externalId)
        .eq('payment_status', 'unpaid')
        .select('order_code');
    if (updErr) {
        console.error('[order-settlement] update paid error', updErr.message, { orderCode: externalId });
        return { settled: false, reason: 'update_failed' };
    }
    if (!updated || updated.length === 0) {
        const { data: reread } = await service
            .from('orders')
            .select('payment_status')
            .eq('order_code', externalId)
            .maybeSingle();
        if (!reread) {
            return { settled: false, reason: 'not_found' };
        }
        if ((reread as Record<string, unknown>).payment_status === 'paid') {
            return { settled: false, reason: 'already_paid' };
        }
        return { settled: false, reason: 'update_failed' };
    }
    const paidAt = new Date().toISOString();
    const orderId = row.id as string | undefined;
    if (orderId) {
        const { error: historyErr } = await service
            .from('order_status_history')
            .insert({ order_id: orderId, status: 'paid', note: null, created_at: paidAt });
        if (historyErr) {
            console.error('[order-settlement] gagal mencatat riwayat paid', historyErr.message, {
                orderCode: externalId,
            });
        }
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
        const existingTypes = new Set(((existing ?? []) as Array<{
            type: string;
        }>).map((r) => r.type));
        if (coinUsed > 0 && !existingTypes.has('spent')) {
            const { data: spent, error: spendErr } = await service.rpc('spend_order_coins', {
                p_user_id: buyerId,
                p_order_code: externalId,
                p_amount: coinUsed,
            });
            if (spent !== true) {
                const ledger = await readSpentLedger(service, buyerId, externalId);
                const orderState = await readOrderTerminalState(service, externalId);
                const verdict = classifyCoinDebitOutcome({
                    data: spent,
                    error: spendErr,
                    spentExistsInLedger: ledger.spentExists,
                    ledgerCheckFailed: ledger.failed,
                    orderIsTerminal: orderState.isTerminal,
                });
                if (verdict.debtRecorded && verdict.status !== null && verdict.reason) {
                    const written = await writeCoinDebitDebt(service, externalId, buyerId, {
                        status: verdict.status,
                        reason: verdict.reason,
                    });
                    if (!written.ok) {
                        console.error('[order-settlement] CRITICAL: gagal mencatat utang debit Coin (rekonsiliasi manual diperlukan)', {
                            orderCode: externalId,
                            coinUsed,
                            outcome: verdict.outcome,
                            reason: verdict.reason,
                            detail: written.detail,
                        });
                    }
                }
                else {
                    console.error('[order-settlement] debit Coin tidak tercatat', {
                        orderCode: externalId,
                        coinUsed,
                        outcome: verdict.outcome,
                        detail: spendErr?.message ?? null,
                    });
                }
            }
        }
        if (coinEarned > 0 && !existingTypes.has('earned')) {
            const { error: earnErr } = await service.from('coin_transactions').insert({
                user_id: buyerId,
                order_code: externalId,
                type: 'earned',
                amount: coinEarned,
                description: 'Reward pembelian',
            });
            if (earnErr)
                console.error('[order-settlement] coin earn error', earnErr.message, { orderCode: externalId });
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
        const existingTypes = new Set(((existingNotifs ?? []) as Array<{
            type: string;
        }>).map((r) => r.type));
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
                .select('id, user_id')
                .eq('slug', vendorSlug)
                .maybeSingle();
            const sellerId = umkm ? (umkm as Record<string, string>).user_id : null;
            const sellerStoreId = umkm ? (umkm as Record<string, string>).id : null;
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
                        href: sellerStorePath(sellerStoreId, 'pesanan'),
                    });
                }
            }
        }
    }
    return { settled: true };
}
