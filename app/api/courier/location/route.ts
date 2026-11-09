import { NextRequest, NextResponse } from 'next/server';
import { createAuthedServerClient, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
import { isValidCourierPosition } from '@/lib/courier-location';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        const user = await getUserFromBearer(authHeader);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized. Silakan login ulang.' }, { status: 401 });
        }
        let body: {
            orderId?: unknown;
            latitude?: unknown;
            longitude?: unknown;
            accuracy?: unknown;
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
        const latitude = Number(body.latitude);
        const longitude = Number(body.longitude);
        if (!isValidCourierPosition(latitude, longitude)) {
            return NextResponse.json({ error: 'Koordinat tidak valid.' }, { status: 400 });
        }
        const accuracy = typeof body.accuracy === 'number' && Number.isFinite(body.accuracy)
            ? body.accuracy
            : null;
        const supabase = createAuthedServerClient(authHeader as string);
        const { data: assignment, error: assignErr } = await supabase
            .from('delivery_assignments')
            .select('order_id, courier_user_id, status')
            .eq('order_id', orderId)
            .maybeSingle();
        if (assignErr) {
            console.error('[courier/location] gagal membaca penugasan:', assignErr.message);
            return NextResponse.json({ error: 'Gagal memuat penugasan.' }, { status: 500 });
        }
        if (!assignment || assignment.courier_user_id !== user.id) {
            return NextResponse.json({ error: 'Anda tidak ditugaskan mengantar pesanan ini.' }, { status: 403 });
        }
        if (!['assigned', 'picked_up', 'delivering'].includes(assignment.status)) {
            return NextResponse.json({ error: 'Pesanan ini tidak sedang diantar.' }, { status: 409 });
        }
        const recordedAt = new Date().toISOString();
        const { error: upsertErr } = await supabase
            .from('delivery_locations')
            .upsert({
            order_id: orderId,
            courier_user_id: user.id,
            latitude,
            longitude,
            accuracy_m: accuracy,
            recorded_at: recordedAt,
        }, { onConflict: 'order_id' });
        if (upsertErr) {
            console.error('[courier/location] gagal menyimpan posisi:', upsertErr.message);
            return NextResponse.json({ error: 'Gagal menyimpan posisi.' }, { status: 500 });
        }
        await supabase
            .from('couriers')
            .update({
            last_latitude: latitude,
            last_longitude: longitude,
            last_seen_at: recordedAt,
        })
            .eq('user_id', user.id);
        return NextResponse.json({ ok: true, recordedAt });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[courier/location] unexpected', err);
        return NextResponse.json({ error: 'Gagal mengirim posisi.' }, { status: 500 });
    }
}
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
        const supabase = createAuthedServerClient(authHeader as string);
        const { data, error } = await supabase
            .from('delivery_locations')
            .select('order_id, latitude, longitude, accuracy_m, recorded_at, courier_user_id')
            .eq('order_id', orderId)
            .maybeSingle();
        if (error) {
            console.error('[courier/location] gagal membaca posisi:', error.message);
            return NextResponse.json({ error: 'Gagal memuat posisi.' }, { status: 500 });
        }
        if (!data) {
            return NextResponse.json({ location: null });
        }
        return NextResponse.json({
            location: {
                latitude: Number(data.latitude),
                longitude: Number(data.longitude),
                accuracyM: data.accuracy_m ?? null,
                recordedAt: data.recorded_at ?? null,
            },
        });
    }
    catch (err) {
        if (isSupabaseUnavailable(err))
            return upstreamUnavailableResponse();
        console.error('[courier/location] unexpected', err);
        return NextResponse.json({ error: 'Gagal memuat posisi.' }, { status: 500 });
    }
}
