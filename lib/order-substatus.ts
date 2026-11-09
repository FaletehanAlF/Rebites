import type { OrderPhase } from './order-status-source';

export type OrderSubStatus =
    | 'menunggu-pembayaran'
    | 'disiapkan'
    | 'diantar'
    | 'siap-diambil'
    | 'selesai'
    | 'dibatalkan';

export function subStatusForPhase(phase: OrderPhase): OrderSubStatus {
    switch (phase) {
        case 'pending':
            return 'menunggu-pembayaran';
        case 'paid':
        case 'processing':
            return 'disiapkan';
        case 'out_for_delivery':
            return 'diantar';
        case 'ready_for_pickup':
            return 'siap-diambil';
        case 'completed':
            return 'selesai';
        case 'cancelled':
            return 'dibatalkan';
    }
}

export const SUB_STATUS_LABEL: Record<OrderSubStatus, string> = {
    'menunggu-pembayaran': 'Menunggu pembayaran',
    disiapkan: 'Sedang disiapkan',
    diantar: 'Sedang diantar',
    'siap-diambil': 'Siap diambil',
    selesai: 'Selesai',
    dibatalkan: 'Dibatalkan',
};
