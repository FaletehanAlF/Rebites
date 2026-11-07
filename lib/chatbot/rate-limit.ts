export const CHAT_LIMIT_USER = 20;
export const CHAT_LIMIT_ANON = 8;
export const CHAT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 5000;
interface Bucket {
    count: number;
    resetAt: number;
}
const buckets = new Map<string, Bucket>();
function prune(now: number): void {
    if (buckets.size < MAX_ENTRIES)
        return;
    buckets.forEach((bucket, key) => {
        if (bucket.resetAt <= now)
            buckets.delete(key);
    });
    if (buckets.size >= MAX_ENTRIES) {
        buckets.clear();
    }
}
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
}
export function claimChatSlot(key: string, limit: number, now = Date.now()): RateLimitResult {
    prune(now);
    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + CHAT_WINDOW_MS });
        return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 };
    }
    if (existing.count >= limit) {
        return {
            allowed: false,
            remaining: 0,
            retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
        };
    }
    existing.count += 1;
    return {
        allowed: true,
        remaining: Math.max(0, limit - existing.count),
        retryAfterSeconds: 0,
    };
}
export function resetChatRateLimit(): void {
    buckets.clear();
}
