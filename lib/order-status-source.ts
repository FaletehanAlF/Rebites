export type OrderPhase = 'pending' | 'paid' | 'processing' | 'out_for_delivery' | 'ready_for_pickup' | 'completed' | 'cancelled';
export interface OrderPhaseInput {
    status?: string;
    orderStatus?: string | null;
    progressStatus?: string | null;
}
const TERMINAL_CANCELLED = new Set(['cancelled', 'refunded', 'failed']);
const PROGRESS_ADVANCED: Record<string, OrderPhase> = {
    diantar: 'out_for_delivery',
    'siap-diambil': 'ready_for_pickup',
};
const NOT_YET_ADVANCED = new Set(['', 'paid', 'processing', 'preparing']);
export function resolveOrderPhase(order: OrderPhaseInput): OrderPhase {
    const lifecycle = order.status;
    const os = (order.orderStatus ?? '').trim();
    const ps = (order.progressStatus ?? '').trim();
    if (lifecycle === 'completed')
        return 'completed';
    if (TERMINAL_CANCELLED.has(os))
        return 'cancelled';
    if (os === 'pending')
        return 'pending';
    if (os === 'out_for_delivery')
        return 'out_for_delivery';
    if (os === 'ready_for_pickup' || os === 'ready')
        return 'ready_for_pickup';
    if (os === 'completed')
        return 'completed';
    if (NOT_YET_ADVANCED.has(os)) {
        const advanced = PROGRESS_ADVANCED[ps];
        if (advanced)
            return advanced;
    }
    if (os === 'paid')
        return 'paid';
    if (os === 'processing' || os === 'preparing')
        return 'processing';
    return 'pending';
}
export function needsSellerAction(phase: OrderPhase): boolean {
    return phase === 'paid' || phase === 'processing';
}
export interface SellerAction {
    targetStatus: 'processing' | 'out_for_delivery' | 'ready_for_pickup' | 'completed';
    label: string;
    description: string;
    tone: 'primary' | 'emerald' | 'purple';
}
export function getSellerAction(phase: OrderPhase, fulfillment: string, options?: {
    autoAdvanceTo?: 'out_for_delivery' | null;
}): SellerAction | null {
    switch (phase) {
        case 'paid':
            return {
                targetStatus: 'processing',
                label: 'Mulai Siapkan Pesanan',
                description: 'Pesanan akan masuk status sedang disiapkan',
                tone: 'primary',
            };
        case 'processing': {
            if (fulfillment === 'pickup') {
                return {
                    targetStatus: 'ready_for_pickup',
                    label: 'Makanan Sudah Siap',
                    description: 'Pembeli akan diberi tahu bahwa pesanan siap diambil',
                    tone: 'emerald',
                };
            }
            if (options?.autoAdvanceTo === 'out_for_delivery') {
                return {
                    targetStatus: 'out_for_delivery',
                    label: 'Antarkan Pesanan',
                    description: 'Kurir ditugaskan otomatis dan pesanan mulai diantar',
                    tone: 'purple',
                };
            }
            return {
                targetStatus: 'out_for_delivery',
                label: 'Antarkan Pesanan',
                description: 'Pesanan akan masuk status sedang diantar',
                tone: 'purple',
            };
        }
        case 'out_for_delivery':
        case 'ready_for_pickup':
            return {
                targetStatus: 'completed',
                label: 'Tandai Selesai',
                description: 'Pesanan ditandai selesai dan dana dilepas ke penjual',
                tone: 'emerald',
            };
        default:
            return null;
    }
}
