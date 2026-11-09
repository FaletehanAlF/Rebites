import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/server/supabase';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
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
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length)
        return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}
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
    const expected = getConfiguredSecret();
    if (!expected) {
        console.error('[webhook/biteship] BITESHIP_WEBHOOK_SECRET belum di-set');
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    const headerSecret = req.headers.get('x-webhook-secret')?.trim() ?? null;
    const authHeader = req.headers.get('authorization')?.trim() ?? null;
    const bearerSecret = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null;
    const provided = headerSecret || bearerSecret;
    if (!provided || !timingSafeEqual(provided, expected)) {
        console.warn('[webhook/biteship] invalid webhook secret');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    let payload: BiteshipWebhookPayload;
    try {
        payload = (await req.json()) as BiteshipWebhookPayload;
    }
    catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    if (!payload || typeof payload !== 'object') {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
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
