import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getUserFromBearer } from '@/lib/server/supabase';
import { getXenditInvoice } from '@/lib/server/xendit';
import { activateSubscriptionPaid } from '@/lib/server/subscription-activation';

export const runtime = 'nodejs';

/**
 * POST /api/subscriptions/xendit/verify
 * Body: { externalId }
 * Auth: Authorization: Bearer <supabase access_token>
 *
 * Fallback saat webhook Xendit tidak terjangkau (mis. dev lokal): cek status
 * invoice langsung ke Xendit API dan aktifkan langganan bila sudah PAID/SETTLED.
 * Idempoten - aman dipanggil berulang dari polling client halaman sukses.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromBearer(req.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { externalId?: string } | null;
  const externalId = body?.externalId?.trim();
  if (!externalId) {
    return NextResponse.json({ error: 'externalId wajib diisi.' }, { status: 400 });
  }

  const service = createServiceClient();

  // Cari UMKM milik user - hanya pemilik yang boleh verifikasi langganannya
  const { data: umkm } = await service
    .from('umkm_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!umkm) {
    return NextResponse.json({ error: 'Profil UMKM tidak ditemukan.' }, { status: 404 });
  }
  const umkmId = (umkm as Record<string, string>).id;

  const { data: subs } = await service
    .from('subscriptions')
    .select('id, status, billing, xendit_invoice_id, current_period_end, plans(slug, name)')
    .eq('umkm_id', umkmId)
    .order('created_at', { ascending: false })
    .limit(5);

  const rows = (subs ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    return NextResponse.json({ externalId, status: 'pending' });
  }

  // Prioritas: pending terbaru; jika tidak ada, pakai baris terbaru
  const target = rows.find((r) => r.status === 'pending') ?? rows[0];
  const subId = target.id as string;
  const currentStatus = (target.status as string) ?? 'pending';
  const invoiceId = target.xendit_invoice_id as string | null;
  const plan = target.plans as { slug?: string; name?: string } | null;

  // Sudah aktif / sudah berakhir - tidak perlu cek Xendit lagi
  if (currentStatus !== 'pending' || !invoiceId) {
    return NextResponse.json({
      externalId,
      status: currentStatus,
      planSlug: plan?.slug ?? null,
      planName: plan?.name ?? null,
      periodEnd: (target.current_period_end as string) ?? null,
    });
  }

  try {
    const invoice = await getXenditInvoice(invoiceId);
    const invoiceStatus = String(invoice.status ?? '').toUpperCase();

    if (invoiceStatus === 'PAID' || invoiceStatus === 'SETTLED') {
      const result = await activateSubscriptionPaid(
        service,
        invoiceId,
        invoice.payment_channel ?? invoice.payment_method ?? null
      );
      if (result.reason === 'update_failed') {
        return NextResponse.json({ error: 'Gagal mengaktifkan langganan.' }, { status: 500 });
      }
      return NextResponse.json({
        externalId,
        status: 'active',
        planSlug: plan?.slug ?? null,
        planName: plan?.name ?? null,
        periodEnd:
          result.reason === 'activated'
            ? result.periodEnd.toISOString()
            : ((target.current_period_end as string) ?? null),
        settled: result.reason === 'activated',
      });
    }

    if (invoiceStatus === 'EXPIRED') {
      // Samakan dengan perilaku webhook: tandai expired agar client berhenti polling
      await service
        .from('subscriptions')
        .update({ status: 'expired', xendit_status: 'EXPIRED' } as Record<string, unknown>)
        .eq('id', subId);
      return NextResponse.json({ externalId, status: 'expired', invoiceStatus: 'EXPIRED' });
    }

    return NextResponse.json({ externalId, status: 'pending', invoiceStatus });
  } catch (e: unknown) {
    // Jangan gagalkan polling client - webhook tetap jadi jalur utama
    console.error('[subscriptions/xendit/verify] error', e, { externalId });
    return NextResponse.json({
      externalId,
      status: currentStatus,
      verifyError: 'Gagal memverifikasi invoice.',
    });
  }
}
