import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getAdminUser, getUserFromBearer, isSupabaseUnavailable, upstreamUnavailableResponse, } from '@/lib/server/supabase';
export const runtime = 'nodejs';
const ORDER_COLUMNS = [
    'id',
    'order_code',
    'buyer_id',
    'umkm_id',
    'product_id',
    'product_slug',
    'product_name',
    'quantity',
    'unit_price',
    'subtotal',
    'discount',
    'service_fee',
    'delivery_fee',
    'total_before_coin',
    'coin_used',
    'coin_earned',
    'total_price',
    'promo_code',
    'image_url',
    'delivery_option',
    'delivery_address',
    'address_snapshot',
    'note',
    'payment_method_id',
    'payment_status',
    'lifecycle_status',
    'order_status',
    'progress_status',
    'estimated_minutes',
    'estimated_completion_at',
    'completed_at',
    'distance_km',
    'preparation_minutes',
    'vendor_name',
    'vendor_slug',
    'vendor_address',
    'vendor_open_hours',
    'co2e_saved_kg',
    'delivery_distance_km',
    'estimated_delivery_minutes',
    'delivery_started_at',
    'estimated_arrival_at',
    'shipping_snapshot',
    'courier_code',
    'courier_service_code',
    'courier_service_name',
    'shipping_rate',
    'shipment_status',
    'shipment_created_at',
    'created_at',
].join(', ');
export async function GET(req: NextRequest, { params }: {
    params: {
        code: string;
    };
}) {
    try {
        const code = params.code?.trim();
        if (!code) {
            return NextResponse.json({ error: 'orderCode wajib' }, { status: 400 });
        }
        const authHeader = req.headers.get('authorization');
        const user = await getUserFromBearer(authHeader);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const service = createServiceClient();
        const { data: order, error } = await service
            .from('orders')
            .select(ORDER_COLUMNS)
            .eq('order_code', code)
            .maybeSingle();
        if (error) {
            console.error('[orders/[code]] fetch error', error.message);
            return NextResponse.json({ error: 'Gagal memuat pesanan' }, { status: 500 });
        }
        if (!order) {
            return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
        }
        const baris = order as unknown as Record<string, unknown>;
        const isBuyer = baris.buyer_id === user.id;
        let isSeller = false;
        if (!isBuyer) {
            const umkmId = baris.umkm_id as string | null;
            if (umkmId) {
                const { data: umkm } = await service
                    .from('umkm_profiles')
                    .select('user_id')
                    .eq('id', umkmId)
                    .maybeSingle();
                isSeller = (umkm as Record<string, unknown>)?.user_id === user.id;
            }
            if (!isSeller && baris.vendor_slug) {
                const slug = baris.vendor_slug as string;
                const { data: umkm2 } = await service
                    .from('umkm_profiles')
                    .select('user_id')
                    .eq('slug', slug)
                    .maybeSingle();
                isSeller = (umkm2 as Record<string, unknown>)?.user_id === user.id;
            }
        }
        if (!isBuyer && !isSeller) {
            const admin = await getAdminUser(authHeader);
            if (!admin) {
                return NextResponse.json({ error: 'Tidak berhak melihat pesanan ini' }, { status: 403 });
            }
        }
        return NextResponse.json({ order });
    }
    catch (err) {
        console.error('[orders/[code]] unexpected', err);
        return NextResponse.json({ error: 'Terjadi kesalahan saat memuat pesanan' }, { status: 500 });
    }
}
