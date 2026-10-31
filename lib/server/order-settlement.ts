import type { SupabaseClient } from '@supabase/supabase-js';
import {
  classifyCoinDebitOutcome,
  interpretDebtWriteResult,
  isTerminalOrderState,
  type CoinDebitReason,
  type CoinDebitStatus,
} from './coin-debit';

export type SettleResult = {
  settled: boolean;
  reason?: 'not_found' | 'already_paid' | 'update_failed' | 'amount_mismatch';
};

/**
 * apakah baris 'spent' untuk order ini benar-benar tercatat?
 *
 * Ledger adalah bukti yang lebih kuat daripada respons RPC: respons bisa
 * hilang SETELAH transaksi commit. Bila pemeriksaan ledger sendiri GAGAL,
 * hasilnya TIDAK boleh disimpulkan "tidak ada spent" — status 'spent'
 * menjadi tidak diketahui dan harus dilaporkan sebagai ketidakpastian.
 */
async function readSpentLedger(
  service: SupabaseClient,
  userId: string,
  orderCode: string
): Promise<{ spentExists: boolean; failed: boolean }> {
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
  return { spentExists: ((data ?? []) as Array<{ type: string }>).length > 0, failed: false };
}

/**
 * apakah order sudah terminal (void)? `null` = tidak diketahui
 * (gagal dibaca) — pemanggil tidak boleh menyimpulkan apa pun dari null.
 */
async function readOrderTerminalState(
  service: SupabaseClient,
  orderCode: string
): Promise<{ isTerminal: boolean | null }> {
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
    isTerminal: isTerminalOrderState(
      row.payment_status as string | null,
      row.order_status as string | null
    ),
  };
}

/**
 * catat utang debit Coin pada status durable yang dapat dikueri.
 *
 * Tidak pernah mengubah `orders.coin_used` (bukti diskon + aritmetika
 * order). Kegagalan pencatatan dikembalikan ke pemanggil agar bisa
 * dicatat sebagai CRITICAL — settlement TIDAK boleh gagal hanya karena
 * kolom belum tersedia (mis. migrasi P1-C belum diterapkan): dalam hal
 * itu utang tetap bisa ditemukan lewat signature ledger.
 *
 * S-2: UPDATE wajib memakai `.select('order_code')` dan dianggap berhasil
 * HANYA bila tepat satu baris dikembalikan. Tanpa baris hasil, "tidak ada
 * error" tidak membuktikan utang tercatat (filter bisa tidak cocok).
 */
async function writeCoinDebitDebt(
  service: SupabaseClient,
  orderCode: string,
  userId: string,
  debt: { status: CoinDebitStatus; reason: CoinDebitReason }
): Promise<{ ok: boolean; detail: string | null }> {
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

  // Anti-race: hanya satu pemenang yang boleh unpaid -> paid.
  // Update kondisional atomik per baris; yang kalah mendapat 0 rows lalu
  // dibaca ulang (paid => already_paid, tidak lanjut ke koin/notif).
  // Nominal sudah divalidasi di atas; yang kalah tidak memproses ganda.
  //
  // ETA DIJANGKARKAN ULANG DI SINI.
  // `estimated_completion_at` dihitung saat checkout memakai Date.now(),
  // padahal pesanan baru dibayar beberapa menit kemudian: pembeli yang
  // checkout 10 menit lalu sudah punya ETA yang 10 menit lebih awal, dan
  // penjual terlihat "lambat" bahkan sebelum dia mulai menyiapkan. Jam
  // persiapan baru berjalan setelah uang diterima, jadi ETA harus dihitung
  // dari SAAT INI.
  const paymentConfirmedAt = new Date();
  const estimatedMinutesRaw = Number(row.estimated_minutes ?? 0);
  const preparationMinutes =
    Number.isFinite(estimatedMinutesRaw) && estimatedMinutesRaw > 0
      ? Math.round(estimatedMinutesRaw)
      : null;
  // NULL bila estimasi tidak pernah tercatat (pesanan lama): jangan karang
  // angka yang tidak punya dasar.
  const reanchoredCompletionAt =
    preparationMinutes == null
      ? null
      : new Date(paymentConfirmedAt.getTime() + preparationMinutes * 60_000).toISOString();

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
    if (coinUsed > 0 && !existingTypes.has('spent')) {
      // pemotongan via RPC atomik (advisory lock + cek saldo +
      // idempoten per order). Pada alur normal hold sudah dicatat saat
      // checkout sehingga RPC ini no-op (true). Bila saldo tidak cukup
      // (mis. order legacy yang dibuat sebelum reservasi P1-A), JANGAN
      // overdraw: lewati pencatatan spent, order tetap lunas karena dana
      // Xendit sudah diterima. Tidak pernah membuat saldo negatif.
      const { data: spent, error: spendErr } = await service.rpc('spend_order_coins', {
        p_user_id: buyerId,
        p_order_code: externalId,
        p_amount: coinUsed,
      });
      if (spent !== true) {
        // debit gagal. Order TETAP 'paid' (uang Xendit sudah
        // diterima) dan orders.coin_used TIDAK diubah — ia adalah bukti
        // diskon yang belum terbayar. Yang dilakukan: verifikasi ledger,
        // lalu catat utang pada status DURABLE yang dapat dikueri.
        //
        // 'false' dari RPC tidak cukup untuk menyimpulkan "saldo kurang":
        // dengan proteksi order terminal, false juga berarti "order sudah
        // terminal" atau "order tidak ada". Karena itu ledger dan status
        // order diverifikasi lebih dulu.
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
            // Kegagalan pencatatan utang TIDAK boleh hilang diam-diam:
            // tanpa status durable, utang tidak dapat dicari/ditagih.
            console.error(
              '[order-settlement] CRITICAL: gagal mencatat utang debit Coin (rekonsiliasi manual diperlukan)',
              {
                orderCode: externalId,
                coinUsed,
                outcome: verdict.outcome,
                reason: verdict.reason,
                detail: written.detail,
              }
            );
          }
        } else {
          // Tidak ada utang: debit sudah terjadi, atau order sudah void.
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
      if (earnErr) console.error('[order-settlement] coin earn error', earnErr.message, { orderCode: externalId });
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