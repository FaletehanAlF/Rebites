export type SellerStatus = 'active' | 'no_subscription' | 'no_store';
export type SubscriptionLike = Record<string, unknown>;
export function isSubscriptionActivePeriod(sub: SubscriptionLike | null | undefined, now: number = Date.now()): boolean {
    if (!sub || sub.status !== 'active')
        return false;
    const end = sub.current_period_end;
    if (typeof end !== 'string' || !end)
        return false;
    const endMs = new Date(end).getTime();
    if (!Number.isFinite(endMs))
        return false;
    return endMs > now;
}
export function resolveSellerStatus(hasUmkm: boolean, latestSubscription: SubscriptionLike | null | undefined, now: number = Date.now()): SellerStatus {
    if (!hasUmkm)
        return 'no_store';
    return isSubscriptionActivePeriod(latestSubscription, now) ? 'active' : 'no_subscription';
}
