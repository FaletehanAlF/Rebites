import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/server/supabase';
import { classifyBiteshipWebhookRequest } from '@/lib/server/biteship-webhook-guard';
export const runtime = 'nodejs';
const SUPPORTED_EVENTS = ['order.status', 'order.waybill_id', 'order.price'] as const;
type SupportedEvent = (typeof SUPPORTED_EVENTS)[number];
const KNOWN_SHIPMENT_STATUSES = [
    'confirmed',
    'scheduled',
    'allocated',
    'picking_up',
    'picked',
    'cancelled',
    'on_hold',
    'in_transit',
    'dropping_off',
    'return_in_transit',
    'returned',
    'rejected',
    'disposed',
    'courier_not_found',
    'delivered',
] as const;
const TERMINAL_STATUSES = ['delivered', 'cancelled', 'rejected', 'disposed', 'returned'];
function getConfiguredSecret(): string | null {
    const raw = process.env.BITESHIP_WEBHOOK_SECRET?.trim();
    return raw || null;
}
function nonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string')
        return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}
interface BiteshipWebhookPayload {
    event?: unknown;
    order_id?: unknown;
    status?: unknown;
    courier_tracking_id?: unknown;
    courier_waybill_id?: unknown;
    price?: unknown;
    order_price?: unknown;
}
export async function POST(req: NextRequest) {
    const rawBody = await req.text();
    const headerSecret = req.headers.get('x-webhook-secret');
    const authHeader = req.headers.get('authorization');
    const bearerSecret = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null;
    const verdict = classifyBiteshipWebhookRequest({
        rawBody,
        providedSecret: headerSecret || bearerSecret,
        expectedSecret: getConfiguredSecret(),
    });
    if (verdict.action === 'probe') {
        console.log('[webhook/biteship] permintaan uji tanpa isi dijawab OK');
        return NextResponse.json({ ok: true });
    }
    if (verdict.action === 'misconfigured') {
        console.error('[webhook/biteship] BITESHIP_WEBHOOK_SECRET belum di-set');
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    if (verdict.action === 'unauthorized') {
        console.warn('[webhook/biteship] invalid webhook secret');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (verdict.action === 'invalid-json') {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const payload = verdict.payload as BiteshipWebhookPayload;
    const event = nonEmptyString(payload.event);
    const biteshipOrderId = nonEmptyString(payload.order_id);
    if (!event || !SUPPORTED_EVENTS.includes(event as SupportedEvent) || !biteshipOrderId) {
        return NextResponse.json({ error: 'Unsupported or invalid event payload' }, { status: 400 });
    }
    if (event === 'order.price') {
        console.log('[webhook/biteship] order.price', {
            order_id: biteshipOrderId,
            status: nonEmptyString(payload.status),
            price: typeof payload.price === 'number' ? payload.price : null,
        });
        return NextResponse.json({ received: true, event });
    }
    const service = createServiceClient();
    const { data: order } = await service
        .from('orders')
        .select('order_code, biteship_order_id, biteship_tracking_id, biteship_waybill_id, shipment_status')
        .eq('biteship_order_id', biteshipOrderId)
        .maybeSingle();
    if (!order) {
        console.warn('[webhook/biteship] order tidak ditemukan', { biteshipOrderId });
        return NextResponse.json({ received: true, note: 'order not found' });
    }
    const row = order as Record<string, unknown>;
    const update: Record<string, unknown> = {};
    const trackingId = nonEmptyString(payload.courier_tracking_id);
    const waybillId = nonEmptyString(payload.courier_waybill_id);
    if (trackingId && trackingId !== (row.biteship_tracking_id as string | null)) {
        update.biteship_tracking_id = trackingId;
    }
    if (waybillId && waybillId !== (row.biteship_waybill_id as string | null)) {
        update.biteship_waybill_id = waybillId;
    }
    const incomingStatus = nonEmptyString(payload.status);
    const validStatus = incomingStatus &&
        (KNOWN_SHIPMENT_STATUSES as readonly string[]).includes(incomingStatus)
        ? incomingStatus
        : null;
    if (validStatus && validStatus !== (row.shipment_status as string | null)) {
        const currentStatus = row.shipment_status as string | null;
        const currentTerminal = !!currentStatus && TERMINAL_STATUSES.includes(currentStatus);
        const incomingTerminal = TERMINAL_STATUSES.includes(validStatus);
        if (!currentTerminal || incomingTerminal) {
            update.shipment_status = validStatus;
        }
        else {
            console.log('[webhook/biteship] status lama diabaikan', {
                orderCode: row.order_code,
                current: currentStatus,
                incoming: validStatus,
            });
        }
    }
    if (Object.keys(update).length === 0) {
        return NextResponse.json({ received: true, deduped: true });
    }
    const { error: updateError } = await service
        .from('orders')
        .update(update)
        .eq('biteship_order_id', biteshipOrderId);
    if (updateError) {
        console.error('[webhook/biteship] update gagal', updateError.message, {
            orderCode: row.order_code,
        });
        return NextResponse.json({ error: 'DB update failed' }, { status: 500 });
    }
    return NextResponse.json({ received: true, event });
}
