import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
export const runtime = 'nodejs';
const ALLOWED_NEXT: Record<string, string[]> = {
    assigned: ['picked_up', 'cancelled'],
    picked_up: ['delivering', 'cancelled'],
    delivering: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
};
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const user = await getUserFromBearer(authHeader);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
        }
        const supabase = createAuthedServerClient(authHeader as string);
        const { data, error } = await supabase
            .from('delivery_assignments')
            .select('id, order_id, status, distance_km, assigned_at, picked_up_at, completed_at')
            .eq('courier_user_id', user.id)
            .order('assigned_at', { ascending: false })
            .limit(50);
        if (error) {
            console.error('[courier/assignments] gagal membaca tugas:', error.message);
            return NextResponse.json({ error: 'Gagal memuat tugas.' }, { status: 500 });
        }
        const assignments = (data ?? []) as Array<Record<string, unknown>>;
        const orderIds = assignments
            .map((row) => row.order_id)
            .filter((id): id is string => typeof id === 'string');
        const orderMap = new Map<string, Record<string, unknown>>();
        if (orderIds.length > 0) {
            const { data: orders } = await supabase
                .from('orders')
                .select('id, order_code, product_name, vendor_name, delivery_option, order_status, address_snapshot, shipping_snapshot, total_price')
                .in('id', orderIds);
            for (const row of (orders ?? []) as Array<Record<string, unknown>>) {
                orderMap.set(String(row.id), row);
            }
        }
        return NextResponse.json({
            assignments: assignments.map((row) => {
                const order = orderMap.get(String(row.order_id)) ?? null;
                return {
                    id: String(row.id),
                    orderId: String(row.order_id),
                    status: String(row.status),
                    distanceKm: row.distance_km == null ? null : Number(row.distance_km),
                    assignedAt: row.assigned_at ? String(row.assigned_at) : null,
                    pickedUpAt: row.picked_up_at ? String(row.picked_up_at) : null,
                    completedAt: row.completed_at ? String(row.completed_at) : null,
                    order: order
                        ? {
                            orderCode: String(order.order_code ?? ''),
                            productName: String(order.product_name ?? ''),
                            vendorName: String(order.vendor_name ?? ''),
                            fulfillment: order.delivery_option === 'pickup' ? 'pickup' : 'delivery',
                            orderStatus: String(order.order_status ?? ''),
                            addressSnapshot: order.address_snapshot ?? null,
                            shippingSnapshot: order.shipping_snapshot ?? null,
                        }
                        : null,
                };
            }),
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[courier/assignments] unexpected', err);
        return NextResponse.json({ error: 'Gagal memuat tugas.' }, { status: 500 });
    }
}
export async function PATCH(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const user = await getUserFromBearer(authHeader);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
        }
        let body: {
            assignmentId?: unknown;
            status?: unknown;
        };
        try {
            body = await req.json();
        }
        catch {
            return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 });
        }
        const assignmentId = typeof body.assignmentId === 'string' ? body.assignmentId.trim() : '';
        const nextStatus = typeof body.status === 'string' ? body.status.trim() : '';
        if (!assignmentId || !nextStatus) {
            return NextResponse.json({ error: 'assignmentId dan status wajib diisi.' }, { status: 400 });
        }
        const supabase = createAuthedServerClient(authHeader as string);
        const { data: current, error: readErr } = await supabase
            .from('delivery_assignments')
            .select('id, courier_user_id, status')
            .eq('id', assignmentId)
            .maybeSingle();
        if (readErr) {
            console.error('[courier/assignments] gagal membaca penugasan:', readErr.message);
            return NextResponse.json({ error: 'Gagal memuat penugasan.' }, { status: 500 });
        }
        if (!current || current.courier_user_id !== user.id) {
            return NextResponse.json({ error: 'Penugasan ini bukan milikmu.' }, { status: 403 });
        }
        const currentStatus = String(current.status);
        if (!(ALLOWED_NEXT[currentStatus] ?? []).includes(nextStatus)) {
            return NextResponse.json({ error: `Status tidak bisa diubah dari ${currentStatus} ke ${nextStatus}.` }, { status: 409 });
        }
        const now = new Date().toISOString();
        const patch: Record<string, unknown> = { status: nextStatus };
        if (nextStatus === 'picked_up')
            patch.picked_up_at = now;
        if (nextStatus === 'completed')
            patch.completed_at = now;
        const { error: updateErr } = await supabase
            .from('delivery_assignments')
            .update(patch)
            .eq('id', assignmentId)
            .eq('status', currentStatus);
        if (updateErr) {
            console.error('[courier/assignments] gagal memperbarui status:', updateErr.message);
            return NextResponse.json({ error: 'Gagal memperbarui status.' }, { status: 500 });
        }
        return NextResponse.json({ ok: true, status: nextStatus });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[courier/assignments] unexpected', err);
        return NextResponse.json({ error: 'Gagal memperbarui status.' }, { status: 500 });
    }
}
