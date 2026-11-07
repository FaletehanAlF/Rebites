export interface OrderStatusHistoryEntry {
    status: string;
    at: string | null;
    note: string | null;
}
export const STATUS_TO_STEPS: Record<string, string[]> = {
    paid: ['confirmed'],
    processing: ['confirmed', 'prepared'],
    preparing: ['confirmed', 'prepared'],
    ready: ['confirmed', 'prepared', 'ready'],
    ready_for_pickup: ['confirmed', 'prepared', 'ready'],
    out_for_delivery: ['confirmed', 'prepared', 'on-the-way'],
    completed: ['confirmed', 'prepared', 'on-the-way', 'arrived', 'completed'],
    cancelled: ['cancelled'],
    refunded: ['cancelled'],
    failed: ['cancelled'],
};
export interface TimelineOrderFacts {
    completedAt?: string;
    deliveryStartedAt?: string;
}
export function buildTimelineTimes(order: TimelineOrderFacts, history: readonly OrderStatusHistoryEntry[]): Record<string, string | null> {
    const times: Record<string, string | null> = {};
    for (const entry of history) {
        const steps = STATUS_TO_STEPS[entry.status];
        if (!steps || !entry.at)
            continue;
        for (const key of steps) {
            if (!times[key])
                times[key] = entry.at;
        }
    }
    if (!times.completed && order.completedAt)
        times.completed = order.completedAt;
    if (!times['on-the-way'] && order.deliveryStartedAt) {
        times['on-the-way'] = order.deliveryStartedAt;
    }
    return times;
}
