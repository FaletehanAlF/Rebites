const MINUTE_MS = 60000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
export function formatElapsedSince(fromIso: string | null | undefined, now: number): string | null {
    if (!fromIso)
        return null;
    const from = new Date(fromIso).getTime();
    if (!Number.isFinite(from))
        return null;
    if (!Number.isFinite(now))
        return null;
    const diff = now - from;
    if (diff < 0)
        return null;
    if (diff < MINUTE_MS)
        return 'kurang dari 1 menit';
    if (diff < HOUR_MS) {
        const menit = Math.floor(diff / MINUTE_MS);
        return `${menit} menit`;
    }
    if (diff < DAY_MS) {
        const jam = Math.floor(diff / HOUR_MS);
        const sisaMenit = Math.floor((diff % HOUR_MS) / MINUTE_MS);
        return sisaMenit === 0 ? `${jam} jam` : `${jam} jam ${sisaMenit} menit`;
    }
    const hari = Math.floor(diff / DAY_MS);
    const sisaJam = Math.floor((diff % DAY_MS) / HOUR_MS);
    return sisaJam === 0 ? `${hari} hari` : `${hari} hari ${sisaJam} jam`;
}
export function resolveWaitSince(order: {
    status?: string;
    orderStatus?: string;
    createdAt: string;
}, lastStatusChangeAt: string | null | undefined): string | null {
    const os = order.orderStatus ?? 'pending';
    const terminal = os === 'completed' ||
        os === 'cancelled' ||
        os === 'refunded' ||
        os === 'failed';
    if (terminal)
        return null;
    if (lastStatusChangeAt)
        return lastStatusChangeAt;
    return order.createdAt || null;
}
