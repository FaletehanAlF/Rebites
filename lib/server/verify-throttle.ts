export const VERIFY_CHECK_WINDOW_MS = 15000;
export const VERIFY_CHECK_WINDOW_SECONDS = 15;
const MAX_ENTRIES = 2000;
const lastCheck = new Map<string, number>();
function prune(now: number): void {
    if (lastCheck.size >= MAX_ENTRIES) {
        lastCheck.clear();
        return;
    }
    const expired: string[] = [];
    lastCheck.forEach((at, key) => {
        if (now - at >= VERIFY_CHECK_WINDOW_MS)
            expired.push(key);
    });
    expired.forEach((key) => lastCheck.delete(key));
}
export function claimXenditCheck(key: string): boolean {
    const now = Date.now();
    prune(now);
    const prev = lastCheck.get(key);
    if (prev !== undefined && now - prev < VERIFY_CHECK_WINDOW_MS)
        return false;
    lastCheck.set(key, now);
    return true;
}
