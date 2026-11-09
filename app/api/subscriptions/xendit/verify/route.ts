import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getUserFromBearer } from '@/lib/server/supabase';
import { getXenditInvoice } from '@/lib/server/xendit';
import { activateSubscriptionPaid } from '@/lib/server/subscription-activation';
import { claimXenditCheck, VERIFY_CHECK_WINDOW_SECONDS } from '@/lib/server/verify-throttle';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
    const user = await getUserFromBearer(req.headers.get('authorization'));
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
    }
    const body = (await req.json().catch(() => null)) as {
        externalId?: string;
        invoiceId?: string;
    } | null;
    const externalId = body?.externalId?.trim();
    if (!externalId) {
        return NextResponse.json({ error: 'externalId wajib diisi.' }, { status: 400 });
    }
    const requestedInvoiceId = body?.invoiceId?.trim() || null;
    const service = createServiceClient();
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
        .select('id, umkm_id, status, billing, xendit_invoice_id, current_period_end, plans(slug, name)')
        .eq('umkm_id', umkmId)
        .order('created_at', { ascending: false })
        .limit(5);
    const rows = (subs ?? []) as Array<Record<string, unknown>>;
    const withInvoice = rows.filter((r) => typeof r.xendit_invoice_id === 'string' && (r.xendit_invoice_id as string).length > 0);
    if (withInvoice.length === 0) {
        return NextResponse.json({ externalId, status: 'not_found' }, { status: 404 });
    }
    let candidates = withInvoice;
    if (requestedInvoiceId) {
        candidates = withInvoice.filter((r) => r.xendit_invoice_id === requestedInvoiceId);
        if (candidates.length === 0) {
            return NextResponse.json({ error: 'Invoice tidak ditemukan untuk akun ini.' }, { status: 404 });
        }
    }
    if (!claimXenditCheck(`sub:${externalId}`)) {
        if (requestedInvoiceId) {
            const exact = candidates.find((r) => r.xendit_invoice_id === requestedInvoiceId) ?? null;
            if (exact && exact.umkm_id === umkmId) {
                const st = (exact.status as string) ?? 'pending';
                const p = exact.plans as {
                    slug?: string;
                    name?: string;
                } | null;
                return NextResponse.json({
                    externalId,
                    status: st,
                    planSlug: p?.slug ?? null,
                    planName: p?.name ?? null,
                    periodEnd: (exact.current_period_end as string) ?? null,
                    throttled: true,
                    retryAfterSeconds: VERIFY_CHECK_WINDOW_SECONDS,
                });
            }
        }
        return NextResponse.json({
            externalId,
            status: 'pending',
            throttled: true,
            retryAfterSeconds: VERIFY_CHECK_WINDOW_SECONDS,
        });
    }
    const lookups = await Promise.all(candidates.map(async (row) => {
        const invId = row.xendit_invoice_id as string;
        try {
            const inv = await getXenditInvoice(invId);
            return { row, inv };
        }
        catch (e: unknown) {
            console.error('[subscriptions/xendit/verify] lookup gagal', e instanceof Error ? e.message : e, { invoiceId: invId });
            return { row, inv: null };
        }
    }));
    const hit = lookups.find((l) => l.inv && String(l.inv.external_id ?? '') === externalId) ?? null;
    if (!hit || !hit.inv) {
        const allUnreachable = lookups.length > 0 && lookups.every((l) => !l.inv);
        if (allUnreachable) {
            return NextResponse.json({ externalId, status: 'pending', verifyError: 'Gagal menghubungi Xendit.' });
        }
        return NextResponse.json({ error: 'Invoice tidak cocok dengan langganan akun ini.' }, { status: 404 });
    }
    const target = hit.row;
    const invoice = hit.inv;
    if (target.umkm_id !== umkmId) {
        return NextResponse.json({ error: 'Invoice bukan milik akun ini.' }, { status: 403 });
    }
    const subId = target.id as string;
    const currentStatus = (target.status as string) ?? 'pending';
    const invoiceId = target.xendit_invoice_id as string | null;
    const plan = target.plans as {
        slug?: string;
        name?: string;
    } | null;
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
        const invoiceStatus = String(invoice.status ?? '').toUpperCase();
        if (invoiceStatus === 'PAID' || invoiceStatus === 'SETTLED') {
            const result = await activateSubscriptionPaid(service, invoiceId, invoice.payment_channel ?? invoice.payment_method ?? null, invoice.amount != null ? Number(invoice.amount) : null);
            if (result.reason === 'not_found') {
                return NextResponse.json({ error: 'Langganan untuk invoice ini tidak ditemukan.' }, { status: 404 });
            }
            if ((result.reason === 'activated' || result.reason === 'already_active') &&
                result.subscriptionId !== subId) {
                console.error('[subscriptions/xendit/verify] subscription mismatch', {
                    expected: subId,
                    activated: result.subscriptionId,
                    invoiceId,
                });
                return NextResponse.json({ error: 'Invoice tidak sesuai dengan langganan akun ini.' }, { status: 409 });
            }
            if (result.reason === 'amount_mismatch') {
                return NextResponse.json({ error: 'Jumlah pembayaran tidak sesuai invoice.' }, { status: 422 });
            }
            if (result.reason === 'update_failed') {
                return NextResponse.json({ error: 'Gagal mengaktifkan langganan.' }, { status: 500 });
            }
            return NextResponse.json({
                externalId,
                status: 'active',
                planSlug: plan?.slug ?? null,
                planName: plan?.name ?? null,
                periodEnd: result.reason === 'activated'
                    ? result.periodEnd.toISOString()
                    : ((target.current_period_end as string) ?? null),
                settled: result.reason === 'activated',
            });
        }
        if (invoiceStatus === 'EXPIRED') {
            await service
                .from('subscriptions')
                .update({ status: 'expired', xendit_status: 'EXPIRED' } as Record<string, unknown>)
                .eq('id', subId)
                .eq('status', 'pending');
            return NextResponse.json({ externalId, status: 'expired', invoiceStatus: 'EXPIRED' });
        }
        return NextResponse.json({ externalId, status: 'pending', invoiceStatus });
    }
    catch (e: unknown) {
        console.error('[subscriptions/xendit/verify] error', e, { externalId });
        return NextResponse.json({
            externalId,
            status: currentStatus,
            verifyError: 'Gagal memverifikasi invoice.',
        });
    }
}
