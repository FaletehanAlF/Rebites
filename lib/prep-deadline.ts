export interface PrepRemaining {
    text: string;
    overdue: boolean;
}
export function formatPrepRemaining(deadlineIso: string | null | undefined, now: number): PrepRemaining | null {
    if (!deadlineIso)
        return null;
    const deadline = new Date(deadlineIso).getTime();
    if (!Number.isFinite(deadline))
        return null;
    if (!Number.isFinite(now))
        return null;
    const diffMs = deadline - now;
    const minutes = Math.round(Math.abs(diffMs) / 60000);
    if (diffMs <= 0) {
        return {
            text: minutes < 1 ? 'Lewat tenggat' : `Lewat ${minutes} menit`,
            overdue: true,
        };
    }
    if (minutes < 1)
        return { text: 'Siap dalam <1 menit', overdue: false };
    return { text: `Siap dalam ${minutes} menit`, overdue: false };
}
