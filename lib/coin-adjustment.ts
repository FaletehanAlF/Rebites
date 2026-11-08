export const COIN_ADJUST_MAX = 10000;
export const COIN_REASON_MIN = 10;
export interface CoinLedgerRow {
    type: string;
    amount: number;
}
export function computeCoinBalance(rows: readonly CoinLedgerRow[]): number {
    let earned = 0;
    let spent = 0;
    for (const row of rows) {
        const amount = Number(row.amount);
        if (!Number.isFinite(amount) || amount <= 0)
            continue;
        if (row.type === 'earned' || row.type === 'refund' || row.type === 'adjustment') {
            earned += amount;
        }
        else if (row.type === 'spent') {
            spent += amount;
        }
    }
    return Math.max(0, earned - spent);
}
export type AdjustmentErrorCode = 'invalid-amount' | 'amount-too-large' | 'reason-too-short' | 'insufficient-balance';
export type AdjustmentResult = {
    ok: true;
    delta: number;
    reason: string;
} | {
    ok: false;
    code: AdjustmentErrorCode;
    message: string;
};
export function validateAdjustment(input: {
    delta: number;
    reason: string;
    currentBalance: number;
}): AdjustmentResult {
    const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
    if (!Number.isFinite(input.delta) || !Number.isInteger(input.delta) || input.delta === 0) {
        return {
            ok: false,
            code: 'invalid-amount',
            message: 'Jumlah koin harus bilangan bulat dan tidak nol.',
        };
    }
    if (Math.abs(input.delta) > COIN_ADJUST_MAX) {
        return {
            ok: false,
            code: 'amount-too-large',
            message: `Maksimal ${COIN_ADJUST_MAX.toLocaleString('id-ID')} koin per aksi.`,
        };
    }
    if (reason.length < COIN_REASON_MIN) {
        return {
            ok: false,
            code: 'reason-too-short',
            message: `Alasan wajib diisi minimal ${COIN_REASON_MIN} karakter.`,
        };
    }
    const saldo = Number.isFinite(input.currentBalance) ? input.currentBalance : 0;
    if (input.delta < 0 && saldo + input.delta < 0) {
        return {
            ok: false,
            code: 'insufficient-balance',
            message: `Saldo saat ini ${saldo.toLocaleString('id-ID')} koin, tidak cukup untuk menarik ${Math.abs(input.delta).toLocaleString('id-ID')} koin.`,
        };
    }
    return { ok: true, delta: input.delta, reason };
}
export function adjustmentDescription(delta: number, reason: string): string {
    const alasan = reason.trim();
    return delta >= 0
        ? `Disesuaikan admin — ${alasan}`
        : `Ditarik admin — ${alasan}`;
}
export interface AdjustmentRow {
    type: 'adjustment' | 'spent';
    amount: number;
    description: string;
}
export function resolveAdjustmentRow(input: {
    delta: number;
    reason: string;
}): AdjustmentRow {
    return {
        type: input.delta > 0 ? 'adjustment' : 'spent',
        amount: Math.abs(input.delta),
        description: adjustmentDescription(input.delta, input.reason),
    };
}
