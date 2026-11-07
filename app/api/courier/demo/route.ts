import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { demoGreeting, demoScheduleFor, resolveDemoTarget, } from '@/lib/demo-courier';
export const runtime = 'nodejs';
const DEMO_COURIER_NAME = 'Kurir Demo';
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const user = await getUserFromBearer(authHeader);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
        }
        const orderId = req.nextUrl.searchParams.get('orderId')?.trim() ?? '';
        if (!orderId) {
            return NextResponse.json({ error: 'orderId wajib diisi.' }, { status: 400 });
        }
        const service = createServiceClient();
        const { data: order, error: orderErr } = await service
            .from('orders')
            .select('id, order_code, buyer_id, order_status, delivery_option, lifecycle_status')
            .eq('id', orderId)
            .maybeSingle();
        if (orderErr) {
            console.error('[courier/demo] gagal membaca pesanan:', orderErr.message);
            return NextResponse.json({ error: 'Gagal memuat pesanan.' }, { status: 500 });
        }
        if (!order) {
            return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
        }
        if (order.buyer_id !== user.id) {
            return NextResponse.json({ error: 'Hanya pembeli pesanan ini yang dapat mengaktifkan kurir demo.' }, { status: 403 });
        }
        const { data: assignment } = await service
            .from('delivery_assignments')
            .select('id, status, is_demo, assigned_at')
            .eq('order_id', orderId)
            .maybeSingle();
        if (!assignment || !assignment.is_demo) {
            return NextResponse.json({ active: false, advanced: null });
        }
        const target = resolveDemoTarget({
            currentStatus: String(order.order_status ?? 'pending'),
            fulfillment: order.delivery_option === 'pickup' ? 'pickup' : 'delivery',
            startedAtIso: assignment.assigned_at ? String(assignment.assigned_at) : null,
            now: Date.now(),
        });
        if (!target) {
            return NextResponse.json({ active: true, advanced: null });
        }
        const { data: updatedRows, error: updErr } = await service
            .from('orders')
            .update({ order_status: target.status })
            .eq('id', orderId)
            .eq('order_status', String(order.order_status ?? 'pending'))
            .select('order_code');
        if (updErr) {
            console.error('[courier/demo] gagal memajukan status:', updErr.message);
            return NextResponse.json({ error: 'Gagal memajukan status.' }, { status: 500 });
        }
        if (!updatedRows || updatedRows.length === 0) {
            return NextResponse.json({ active: true, advanced: null });
        }
        if (target.status === 'completed') {
            await service
                .from('orders')
                .update({
                lifecycle_status: 'completed',
                completed_at: new Date().toISOString(),
            })
                .eq('id', orderId);
        }
        await service
            .from('delivery_assignments')
            .update({ status: target.assignmentStatus })
            .eq('id', assignment.id);
        await service.from('order_status_history').insert({
            order_id: orderId,
            status: target.status,
            note: target.note,
        });
        return NextResponse.json({
            active: true,
            advanced: { status: target.status, note: target.note },
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[courier/demo] unexpected', err);
        return NextResponse.json({ error: 'Gagal memeriksa demo.' }, { status: 500 });
    }
}
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const user = await getUserFromBearer(authHeader);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
        }
        let body: {
            orderId?: unknown;
        };
        try {
            body = await req.json();
        }
        catch {
            return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
        }
        const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
        if (!orderId) {
            return NextResponse.json({ error: 'orderId wajib diisi.' }, { status: 400 });
        }
        const service = createServiceClient();
        const { data: order, error: orderErr } = await service
            .from('orders')
            .select('id, order_code, buyer_id, order_status, delivery_option')
            .eq('id', orderId)
            .maybeSingle();
        if (orderErr) {
            console.error('[courier/demo] gagal membaca pesanan:', orderErr.message);
            return NextResponse.json({ error: 'Gagal memuat pesanan.' }, { status: 500 });
        }
        if (!order) {
            return NextResponse.json({ error: 'Pesanan tidak ditemukan.' }, { status: 404 });
        }
        if (order.buyer_id !== user.id) {
            return NextResponse.json({ error: 'Hanya pembeli pesanan ini yang dapat mengaktifkan kurir demo.' }, { status: 403 });
        }
        const os = String(order.order_status ?? '');
        if (!['paid', 'processing'].includes(os)) {
            return NextResponse.json({
                error: 'Kurir demo hanya bisa diaktifkan setelah pesanan dibayar dan belum diantar.',
            }, { status: 409 });
        }
        const { data: existing } = await service
            .from('delivery_assignments')
            .select('id, is_demo, courier_user_id')
            .eq('order_id', orderId)
            .maybeSingle();
        if (existing && existing.is_demo === false && existing.courier_user_id) {
            return NextResponse.json({ error: 'Pesanan ini sudah punya kurir sungguhan.' }, { status: 409 });
        }
        const nowIso = new Date().toISOString();
        const fulfillment = order.delivery_option === 'pickup' ? 'pickup' : 'delivery';
        const firstStage = demoScheduleFor(fulfillment)[0];
        if (existing) {
            await service
                .from('delivery_assignments')
                .update({
                status: firstStage.assignmentStatus,
                ...(existing.is_demo ? {} : { is_demo: true }),
                ...(existing.is_demo ? {} : { assigned_at: nowIso }),
            })
                .eq('id', existing.id);
        }
        else {
            const { error: insertErr } = await service
                .from('delivery_assignments')
                .insert({
                order_id: orderId,
                courier_user_id: null,
                is_demo: true,
                status: firstStage.assignmentStatus,
                distance_km: null,
                assigned_at: nowIso,
            });
            if (insertErr) {
                console.error('[courier/demo] gagal membuat penugasan demo:', insertErr.message);
                return NextResponse.json({ error: 'Gagal mengaktifkan kurir demo.' }, { status: 500 });
            }
        }
        const { data: existingGreeting } = await service
            .from('courier_messages')
            .select('id')
            .eq('order_id', orderId)
            .eq('sender_kind', 'demo_courier')
            .limit(1);
        if (!existingGreeting || existingGreeting.length === 0) {
            await service.from('courier_messages').insert({
                order_id: orderId,
                sender_user_id: null,
                sender_kind: 'demo_courier',
                body: demoGreeting(String(order.order_code ?? '')),
            });
        }
        return NextResponse.json({
            active: true,
            courierName: DEMO_COURIER_NAME,
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[courier/demo] unexpected', err);
        return NextResponse.json({ error: 'Gagal mengaktifkan demo.' }, { status: 500 });
    }
}
