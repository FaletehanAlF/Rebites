'use client';
import { supabase } from './supabase';
import { getSellerUmkm } from './product-storage';
import { calculateTravelMinutes } from './delivery-estimate';
export const ADMIN_FEE_RATE = 0.12;
export type OrderStatusValue = 'pending' | 'paid' | 'processing' | 'ready_for_pickup' | 'out_for_delivery' | 'completed' | 'cancelled' | 'refunded' | 'preparing' | 'ready' | 'failed';
const VALID_TRANSITIONS: Record<string, string[]> = {
    pending: ['paid', 'cancelled', 'failed'],
    paid: ['processing', 'cancelled'],
    processing: ['ready_for_pickup', 'out_for_delivery', 'cancelled'],
    ready_for_pickup: ['completed'],
    out_for_delivery: ['completed'],
    preparing: ['completed', 'cancelled', 'ready'],
    ready: ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
    refunded: [],
    failed: [],
};
export function isValidTransition(from: string, to: string): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
export function getValidActions(orderStatus: string, fulfillmentMethod: string): {
    action: string;
    label: string;
    targetStatus: string;
    description: string;
}[] {
    const actions: {
        action: string;
        label: string;
        targetStatus: string;
        description: string;
    }[] = [];
    switch (orderStatus) {
        case 'paid':
            actions.push({
                action: 'start_processing',
                label: 'Mulai Siapkan Pesanan',
                targetStatus: 'processing',
                description: 'Pesanan akan masuk status sedang disiapkan',
            });
            break;
        case 'processing':
            if (fulfillmentMethod === 'pickup') {
                actions.push({
                    action: 'mark_ready',
                    label: 'Makanan Sudah Siap',
                    targetStatus: 'ready_for_pickup',
                    description: 'Pembeli akan diberi tahu bahwa pesanan siap diambil',
                });
            }
            else {
                actions.push({
                    action: 'start_delivery',
                    label: 'Antarkan Pesanan',
                    targetStatus: 'out_for_delivery',
                    description: 'Pesanan akan masuk status sedang diantar',
                });
            }
            break;
        default:
            break;
    }
    return actions;
}
export function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
        pending: 'Menunggu Pembayaran',
        paid: 'Pembayaran Berhasil',
        processing: 'Sedang Disiapkan',
        ready_for_pickup: 'Siap Diambil',
        out_for_delivery: 'Sedang Diantar',
        completed: 'Selesai',
        cancelled: 'Dibatalkan',
        refunded: 'Dikembalikan',
        preparing: 'Sedang Disiapkan',
        ready: 'Siap Diambil',
        failed: 'Pembayaran Gagal',
    };
    return labels[status] ?? status;
}
export function getStatusColor(status: string): {
    bg: string;
    text: string;
    dot: string;
} {
    const colors: Record<string, {
        bg: string;
        text: string;
        dot: string;
    }> = {
        pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500' },
        paid: { bg: 'bg-primary/10', text: 'text-primary', dot: 'bg-primary' },
        processing: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
        ready_for_pickup: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
        out_for_delivery: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
        completed: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
        cancelled: { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive' },
        refunded: { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' },
        preparing: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning' },
        ready: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
        failed: { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive' },
    };
    return colors[status] ?? { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500' };
}
export async function transitionOrderStatus(orderId: string, newStatus: string, note?: string): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('id, order_status, order_code, buyer_id, umkm_id, product_name, vendor_name, vendor_slug, delivery_option, distance_km')
            .eq('order_code', orderId)
            .maybeSingle();
        if (fetchError || !order) {
            return { success: false, error: 'Pesanan tidak ditemukan' };
        }
        const orderRow = order as Record<string, any>;
        const currentStatus = orderRow.order_status;
        const { data: sessionData } = await supabase.auth.getUser();
        const actorId = sessionData?.user?.id ?? null;
        if (!actorId) {
            return { success: false, error: 'Sesi login tidak ditemukan' };
        }
        const isBuyer = orderRow.buyer_id === actorId;
        let isSeller = false;
        if (orderRow.umkm_id) {
            const { data: umkm } = await supabase
                .from('umkm_profiles')
                .select('user_id')
                .eq('id', orderRow.umkm_id)
                .maybeSingle();
            isSeller = (umkm as Record<string, any> | null)?.user_id === actorId;
        }
        if (!isSeller && orderRow.vendor_slug) {
            const { data: store } = await supabase
                .from('umkm_profiles')
                .select('user_id')
                .eq('slug', orderRow.vendor_slug)
                .maybeSingle();
            isSeller = (store as Record<string, any> | null)?.user_id === actorId;
        }
        if (!isBuyer && !isSeller) {
            return { success: false, error: 'Tidak berhak mengubah status pesanan ini' };
        }
        if (isBuyer && !isSeller) {
            if (newStatus === 'cancelled') {
                if (currentStatus !== 'pending') {
                    return {
                        success: false,
                        error: 'Pesanan yang sudah dibayar tidak dapat dibatalkan sendiri — hubungi penjual',
                    };
                }
            }
            else {
                if (newStatus !== 'completed') {
                    return { success: false, error: 'Pembeli hanya dapat mengonfirmasi penerimaan pesanan' };
                }
                if (currentStatus !== 'ready_for_pickup' && currentStatus !== 'out_for_delivery') {
                    return { success: false, error: 'Pesanan belum siap dikonfirmasi diterima' };
                }
            }
        }
        if (!isValidTransition(currentStatus, newStatus)) {
            return { success: false, error: `Transisi dari ${currentStatus} ke ${newStatus} tidak valid` };
        }
        const updatePayload: Record<string, unknown> = { order_status: newStatus };
        if (newStatus === 'completed') {
            updatePayload.lifecycle_status = 'completed';
            updatePayload.completed_at = new Date().toISOString();
        }
        if (newStatus === 'out_for_delivery') {
            const deliveryStartedAt = new Date();
            updatePayload.delivery_started_at = deliveryStartedAt.toISOString();
            const deliveryOption = (order as Record<string, any>).delivery_option;
            const rawDistance = (order as Record<string, any>).distance_km;
            const parsedDistance = rawDistance == null ? NaN : Number(rawDistance);
            const distanceKm = Number.isFinite(parsedDistance) && parsedDistance > 0 ? parsedDistance : null;
            const travelMinutes = distanceKm == null ? 0 : calculateTravelMinutes(distanceKm);
            if (deliveryOption !== 'pickup' && distanceKm != null && travelMinutes > 0) {
                const estimatedArrivalAt = new Date(deliveryStartedAt.getTime() + travelMinutes * 60000);
                updatePayload.estimated_arrival_at = estimatedArrivalAt.toISOString();
                updatePayload.delivery_distance_km = distanceKm;
                updatePayload.estimated_delivery_minutes = travelMinutes;
            }
        }
        const { data: updatedRows, error: updateError } = await supabase
            .from('orders')
            .update(updatePayload)
            .eq('order_code', orderId)
            .eq('order_status', currentStatus)
            .select('order_code');
        if (updateError) {
            return { success: false, error: `Gagal update status: ${updateError.message}` };
        }
        if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
            return {
                success: false,
                error: 'Status pesanan telah berubah. Muat ulang lalu coba lagi.',
            };
        }
        const { error: historyError } = await supabase.from('order_status_history').insert({
            order_id: (order as Record<string, any>).id,
            status: newStatus,
            note: note ?? null,
        });
        if (historyError) {
            console.error('[order-state-machine] gagal mencatat order_status_history', historyError.message);
        }
        return { success: true };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Terjadi kesalahan';
        return { success: false, error: msg };
    }
}
async function releaseSellerFunds(orderCode: string): Promise<void> {
    try {
        const { data: order } = await supabase
            .from('orders')
            .select('id, buyer_id, umkm_id, vendor_slug, total_price, service_fee, product_name')
            .eq('order_code', orderCode)
            .maybeSingle();
        if (!order)
            return;
        const orderRow = order as Record<string, any>;
        const orderId = orderRow.id as string;
        const totalPrice = Number(orderRow.total_price ?? 0);
        const productName = (orderRow.product_name as string) ?? 'Produk';
        let sellerUserId: string | null = null;
        if (orderRow.vendor_slug) {
            const { data: umkm } = await supabase
                .from('umkm_profiles')
                .select('user_id')
                .eq('slug', orderRow.vendor_slug)
                .maybeSingle();
            sellerUserId = (umkm as Record<string, any>)?.user_id ?? null;
        }
        if (!sellerUserId || totalPrice <= 0)
            return;
        const { data: existing } = await supabase
            .from('seller_transactions')
            .select('id')
            .eq('order_id', orderId)
            .eq('type', 'sale')
            .maybeSingle();
        if (existing)
            return;
        const storedFee = Number(orderRow.service_fee ?? 0);
        let serviceFee: number;
        if (Number.isFinite(storedFee) && storedFee > 0) {
            serviceFee = storedFee;
        }
        else if (Number.isFinite(storedFee) && storedFee === 0 && totalPrice === 0) {
            serviceFee = 0;
        }
        else {
            serviceFee = Math.round((totalPrice * ADMIN_FEE_RATE) / (1 + ADMIN_FEE_RATE));
        }
        const sellerAmount = Math.max(0, totalPrice - serviceFee);
        await supabase.from('seller_transactions').insert({
            seller_id: sellerUserId,
            order_id: orderId,
            order_code: orderCode,
            type: 'sale',
            amount: sellerAmount,
            status: 'completed',
        });
    }
    catch (err) {
        console.error('[order-state-machine] releaseSellerFunds error:', err);
    }
}
