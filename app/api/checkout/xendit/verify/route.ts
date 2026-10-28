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

  const body = (await req.json().catch(() => null)) as { orderCode?: string } | null;
  const orderCode = body?.orderCode?.trim();
  if (!orderCode) {
    return NextResponse.json({ error: 'orderCode wajib diisi.' }, { status: 400 });
  }

  const service = createServiceClient();
  // Tahap 2D-E: kolom invoice_state memerlukan migration 20261008000000.
  // Bila database belum migrasi, turun ke select legacy (state = null).
  let order: Record<string, unknown> | null = null;
  {
    const sel = await service
      .from('orders')
      .select('order_code, buyer_id, payment_status, xendit_invoice_id, invoice_state, promo_code')
      .eq('order_code', orderCode)
      .maybeSingle();
    if (!sel.error) {
      order = sel.data as Record<string, unknown> | null;
    } else if (isInvoiceStateColumnMissingError(sel.error)) {
      // Hanya error SKEMA yang menunjukkan kolom invoice_state tidak ada
      // (42703 / PGRST204) yang boleh memicu fallback legacy. Error jaringan
      // atau error database lain TIDAK dianggap kolom hilang.
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
    } else {
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
  // Tahap 2D-E: kolom mungkin NULL untuk order legacy (perlakukan seperti
  // attached bila invoice ID ada). JANGAN pernah menyimpulkan ID NULL =
  // invoice belum terbit (lihat state unknown di bawah).
  const invoiceState = (row.invoice_state as InvoiceState | null) ?? null;

  if (currentStatus !== 'unpaid' || !invoiceId) {
    return NextResponse.json({ orderCode, paymentStatus: currentStatus, invoiceState });
  }

  // Tahap 2D-E: hanya invoice yang TERLAMPIR yang diverifikasi ke Xendit.
  // not_started/inflight/unknown -> kembalikan status menunggu pemeriksaan
  // TANPA memanggil Xendit dan TANPA rekonsiliasi otomatis (belum teruji).
  // unknown BUKAN gagal: frontend menampilkan "menunggu pemeriksaan".
  if (invoiceState !== null && invoiceState !== 'attached') {
    return NextResponse.json({ orderCode, paymentStatus: currentStatus, invoiceState });
  }

  // Tahap 2B: batasi panggilan Xendit untuk transaksi yang tetap pending.
  // Dalam window, kembalikan status DB tanpa memanggil Xendit dan tanpa
  // mengubah apa pun. Webhook tetap jalur utama: bila webhook melunasi di
  // antara dua polling, baca DB di atas sudah mengembalikan 'paid' sebelum
  // sampai ke sini, sehingga tidak ada status yang terlewat — hanya discovery
  // via Xendit yang tertunda maksimal satu window.
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
      // Tahap 1 (fail-closed): jangan settle tanpa nominal — validasi amount
      // di settleOrderPaid hanya berlaku untuk nominal finite. Bila Xendit
      // tidak mengirim amount, serahkan ke webhook (yang mewajibkan amount)
      // atau verifikasi berikutnya.
      const paidAmount = Number(invoice.amount);
      if (!Number.isFinite(paidAmount)) {
        return NextResponse.json({
          orderCode,
          paymentStatus: currentStatus,
          verifyError: 'Nominal invoice tidak tersedia.',
        });
      }
      const result = await settleOrderPaid(
        service,
        orderCode,
        invoiceId,
        invoice.payment_channel ?? invoice.payment_method ?? null,
        paidAmount
      );
      if (result.reason === 'amount_mismatch') {
        return NextResponse.json({ error: 'Nominal invoice tidak sesuai pesanan.' }, { status: 409 });
      }
      if (result.reason === 'update_failed') {
        return NextResponse.json({ error: 'Gagal menandai pesanan lunas.' }, { status: 500 });
      }
      return NextResponse.json({ orderCode, paymentStatus: 'paid', settled: result.settled });
    }

    if (invoiceStatus === 'EXPIRED' || invoiceStatus === 'FAILED' || invoiceStatus === 'VOIDED') {
      // Sama dengan webhook (EXPIRED/FAILED/VOIDED): transisi atomik hanya
      // untuk order 'unpaid'. Order yang sudah 'paid' sudah keluar lebih awal
      // di atas sehingga tidak bisa dibatalkan callback gagal yang terlambat.
      // Stok dikembalikan trigger database tepat satu kali.
      // hold koin dikembalikan via RPC idempoten (trigger DB sebagai
      // jaring pengaman kedua).
      // Tahap C: fallback EKSKLUSIF untuk error skema yang menunjukkan kolom
      // invoice_state tidak ada (migration 2D-E belum diterapkan) —
      // isInvoiceStateColumnMissingError menolak error jaringan maupun error
      // database lain (mis. pelanggaran CHECK bernama ..._invoice_state_...).
      // Error database non-skema TIDAK diulang tanpa invoice_state, dan
      // kegagalan akhir tetap dicatat (tidak ditelan diam-diam).
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
      // Pelepasan promo: HANYA pemenang transisi terminal yang boleh melepas,
      // dan hanya bila promo benar-benar terklaim. Webhook dan verify dapat
      // memproses order yang sama; `release_promo` tidak idempoten sehingga
      // keputusan ini digerbangi `updateWon` (lihat planTerminalPromoRelease).
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
        } catch (e) {
          console.error('[checkout/xendit/verify] release promo melempar', e instanceof Error ? e.message : e, { orderCode });
        }
      }
      if (cancelled && cancelled.length > 0 && row.buyer_id) {
        try {
          await service.rpc('refund_order_coins', {
            p_user_id: row.buyer_id as string,
            p_order_code: orderCode,
          });
        } catch (e) {
          console.error('[checkout/xendit/verify] refund coins gagal', e instanceof Error ? e.message : e, { orderCode });
        }
      }
      const finalStatus = cancelled && cancelled.length > 0 ? 'failed' : currentStatus;
      return NextResponse.json({ orderCode, paymentStatus: finalStatus, invoiceStatus });
    }

    return NextResponse.json({ orderCode, paymentStatus: currentStatus, invoiceStatus });
  } catch (e: unknown) {
    
    const msg = e instanceof Error ? e.message : 'Gagal verifikasi invoice.';
    console.error('[checkout/xendit/verify] error', msg, { orderCode });
    return NextResponse.json({ orderCode, paymentStatus: currentStatus, verifyError: msg });
  }
}