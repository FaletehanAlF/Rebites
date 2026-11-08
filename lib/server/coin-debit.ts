export type CoinDebitOutcome = 'debit_ok' | 'already_debited' | 'insufficient' | 'order_terminal' | 'rpc_error' | 'order_state_unknown';
export type CoinDebitStatus = 'pending' | 'insufficient';
export type CoinDebitReason = 'rpc_error' | 'insufficient_balance';
export interface CoinDebitVerdict {
    outcome: CoinDebitOutcome;
    status: CoinDebitStatus | null;
    reason: CoinDebitReason | null;
    debtRecorded: boolean;
    uncertain: boolean;
}
export function isTerminalOrderState(paymentStatus: string | null | undefined, orderStatus: string | null | undefined): boolean {
    const payment = (paymentStatus ?? '').trim().toLowerCase();
    const order = (orderStatus ?? '').trim().toLowerCase();
    if (order === 'cancelled' || order === 'failed' || order === 'refunded')
        return true;
    if (payment === 'failed' || payment === 'refunded')
        return true;
    return false;
}
export function classifyCoinDebitOutcome(opts: {
    data: unknown;
    error?: {
        message?: string | null;
    } | null | undefined;
    spentExistsInLedger: boolean;
    ledgerCheckFailed?: boolean;
    orderIsTerminal?: boolean | null;
}): CoinDebitVerdict {
    const hasRpcError = !!opts.error;
    if (opts.data === true) {
        return { outcome: 'debit_ok', status: null, reason: null, debtRecorded: false, uncertain: false };
    }
    if (opts.spentExistsInLedger) {
        return {
            outcome: 'already_debited',
            status: null,
            reason: null,
            debtRecorded: false,
            uncertain: false,
        };
    }
    if (opts.orderIsTerminal === true) {
        return {
            outcome: 'order_terminal',
            status: null,
            reason: null,
            debtRecorded: false,
            uncertain: false,
        };
    }
    if (opts.ledgerCheckFailed === true || hasRpcError) {
        return {
            outcome: 'rpc_error',
            status: 'pending',
            reason: 'rpc_error',
            debtRecorded: true,
            uncertain: true,
        };
    }
    if (opts.orderIsTerminal !== false) {
        return {
            outcome: 'order_state_unknown',
            status: 'pending',
            reason: 'rpc_error',
            debtRecorded: true,
            uncertain: true,
        };
    }
    return {
        outcome: 'insufficient',
        status: 'insufficient',
        reason: 'insufficient_balance',
        debtRecorded: true,
        uncertain: false,
    };
}
export function interpretDebtWriteResult(opts: {
    rowCount: number | null;
    error?: {
        message?: string | null;
    } | null | undefined;
}): {
    ok: boolean;
    detail: string | null;
} {
    if (opts.error) {
        return { ok: false, detail: opts.error.message ?? 'unknown error' };
    }
    if (opts.rowCount == null) {
        return { ok: false, detail: 'no rows returned (missing .select() or unreadable result)' };
    }
    if (opts.rowCount !== 1) {
        return { ok: false, detail: `expected exactly 1 updated row, got ${opts.rowCount}` };
    }
    return { ok: true, detail: null };
}
