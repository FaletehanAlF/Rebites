'use client';
import { supabase } from './supabase';
import { buildTimelineTimes, type OrderStatusHistoryEntry, type TimelineOrderFacts, } from './order-timeline-steps';
export { buildTimelineTimes };
export type { OrderStatusHistoryEntry };
export async function fetchOrderStatusHistory(dbId: string | null | undefined): Promise<OrderStatusHistoryEntry[]> {
    if (!dbId)
        return [];
    try {
        const { data, error } = await supabase
            .from('order_status_history')
            .select('status, created_at, note')
            .eq('order_id', dbId)
            .order('created_at', { ascending: true })
            .limit(100);
        if (error) {
            console.error('[order-status-history] gagal memuat riwayat:', error.message);
            return [];
        }
        return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
            status: String(row.status ?? ''),
            at: row.created_at ? String(row.created_at) : null,
            note: row.note ? String(row.note) : null,
        }));
    }
    catch (err) {
        console.error('[order-status-history] gagal memuat riwayat:', err);
        return [];
    }
}
export async function buildOrderTimelineTimes(dbId: string | null | undefined, order: TimelineOrderFacts): Promise<Record<string, string | null>> {
    const history = await fetchOrderStatusHistory(dbId);
    return buildTimelineTimes(order, history);
}
