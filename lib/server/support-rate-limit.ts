export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_TRACKED_KEYS = 5000;
const hits = new Map<string, number[]>();
export function allowSupportRequest(key: string, maxPerWindow: number, nowMs: number = Date.now()): boolean {
    const cutoff = nowMs - RATE_LIMIT_WINDOW_MS;
    let timestamps = hits.get(key);
    if (!timestamps) {
        if (hits.size >= MAX_TRACKED_KEYS)
            hits.clear();
        timestamps = [];
        hits.set(key, timestamps);
    }
    const recent = timestamps.filter((time) => time > cutoff);
    if (recent.length >= maxPerWindow) {
        hits.set(key, recent);
        return false;
    }
    recent.push(nowMs);
    hits.set(key, recent);
    return true;
}
export function clientIpFrom(headers: {
    get(name: string): string | null;
}): string {
    const forwarded = headers.get('x-forwarded-for');
    if (forwarded) {
        for (const part of forwarded.split(',')) {
            const candidate = part.trim();
            if (candidate)
                return candidate;
        }
    }
    const realIp = headers.get('x-real-ip')?.trim();
    return realIp ? realIp : 'unknown';
}
