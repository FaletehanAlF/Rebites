export const IN_FLIGHT_STATUSES = ['out_for_delivery', 'ready_for_pickup'] as const;
export interface ExpiryCandidate {
    status?: string;
    orderStatus?: string | null;
    estimatedCompletionAt?: string | null;
}
export function shouldAutoComplete(order: ExpiryCandidate, now: number): boolean {
    if (order.status !== 'ongoing')
        return false;
    const os = (order.orderStatus ?? '').trim();
    if (!(IN_FLIGHT_STATUSES as readonly string[]).includes(os))
        return false;
    const raw = order.estimatedCompletionAt;
    if (!raw)
        return false;
    const deadline = new Date(raw).getTime();
    if (!Number.isFinite(deadline))
        return false;
    if (!Number.isFinite(now))
        return false;
    return now >= deadline;
}
